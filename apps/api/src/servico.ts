// Regras de aplicação do servidor: sessões, episódios, planos, checagens, Ritmo, dados, retenção.
// Nada aqui escreve texto livre para o funcionário: só templates aprovados (via conversation/content).
import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import type { Conteudo } from "@levia/content";
import { texto as tx } from "@levia/content";
import {
  escolherExercicios,
  iniciar,
  iniciarChecagem,
  montarResultado,
  passo,
  pedidoNlu,
  detectarGuardrail,
  type Contexto,
  type Entrada,
  type Estado,
} from "@levia/conversation";
import { NluIndisponivel, type NluProvider } from "@levia/nlu";
import { iniciarPiora } from "@levia/conversation";
import { placar, validarRegistro, constanciaPessoa, type DiaPessoa } from "@levia/ritmo";
import type { FonteRh } from "@levia/privacy";
import { triage } from "@levia/triage";
import type { Achado, Checagem, EpisodioAnterior, MensagemLevia, Regiao, RespostasConfirmadas, Semana, TriageResult } from "@levia/shared";
import { ACHADOS, somarDias, diasEntre } from "@levia/shared";
import type { DadosResumo } from "@levia/summary";
import type { Db } from "./db/index.ts";
import { schema } from "./db/index.ts";
import type { Cifra } from "./cripto.ts";

const S = schema;
export const SEMANAS: Semana[] = [1, 2, 4, 6];

export class ErroHttp extends Error {
  constructor(public readonly status: number, public readonly codigo: string) {
    super(codigo);
  }
}

export interface Relogio {
  hoje(): string; // AAAA-MM-DD
  agora(): string; // ISO
}

export const relogioReal: Relogio = {
  hoje: () => process.env.LEVIA_HOJE ?? new Date().toISOString().slice(0, 10),
  agora: () => new Date().toISOString(),
};

interface DadosEpisodio {
  regioes: Regiao[];
  saida: 1 | 2 | 3;
  urgenteHoje: boolean;
  regrasDisparadas: string[];
  porque: string;
  startBack: TriageResult["startBack"];
  respostas: RespostasConfirmadas;
}

type DadosChecagem = Checagem;

export interface Metrica {
  evento: string;
  [k: string]: string | number | boolean;
}

export class Servico {
  readonly ctx: Contexto;
  constructor(
    readonly db: Db,
    readonly conteudo: Conteudo,
    readonly cifra: Cifra,
    readonly nlu: NluProvider | null,
    readonly relogio: Relogio = relogioReal,
    /** log sem dado de saúde: só ids e códigos de evento */
    readonly log: (m: Metrica) => void = () => {},
  ) {
    this.ctx = { arvore: conteudo.arvore, textos: conteudo.textos };
  }

  // ---------- identidade provisória (TODO(login)) ----------

  registrarDispositivo(id: string, empresaId: string, setorId: string): { papel: "funcionario" | "rh"; novo: boolean } {
    const ja = this.db.select().from(S.pessoa).where(eq(S.pessoa.idPseudonimo, id)).get();
    if (ja) return { papel: ja.papel, novo: false };
    const setor = this.db.select().from(S.setor).where(eq(S.setor.id, setorId)).get();
    if (!setor || setor.empresaId !== empresaId) throw new ErroHttp(500, "empresa_padrao_invalida");
    this.db.insert(S.pessoa).values({ idPseudonimo: id, empresaId, setorId, papel: "funcionario", criadoEm: this.relogio.agora() }).run();
    this.log({ evento: "dispositivo_registrado" });
    return { papel: "funcionario", novo: true };
  }

  pessoa(id: string) {
    const p = this.db.select().from(S.pessoa).where(eq(S.pessoa.idPseudonimo, id)).get();
    if (!p) throw new ErroHttp(401, "dispositivo_desconhecido");
    return p;
  }

  tocarUso(id: string): void {
    const em = this.relogio.hoje();
    this.db.insert(S.ultimoUso).values({ idPseudonimo: id, em }).onConflictDoUpdate({ target: S.ultimoUso.idPseudonimo, set: { em } }).run();
  }

  // ---------- consentimento ----------

  consentimentoAtivo(id: string, tipo: "triagem" | "ritmo"): boolean {
    return !!this.db
      .select()
      .from(S.consentimento)
      .where(and(eq(S.consentimento.idPseudonimo, id), eq(S.consentimento.tipo, tipo), isNull(S.consentimento.revogadoEm)))
      .get();
  }

  consentir(id: string, tipo: "triagem" | "ritmo", versao: number): void {
    if (this.consentimentoAtivo(id, tipo)) return;
    // Dar de novo no mesmo instante de uma revogação reaproveita a linha (a chave é pessoa + tipo + data).
    this.db.$client
      .prepare(
        `INSERT INTO consentimento (id_pseudonimo, tipo, versao_texto, dado_em) VALUES (?, ?, ?, ?)
         ON CONFLICT(id_pseudonimo, tipo, dado_em) DO UPDATE SET revogado_em = NULL, versao_texto = excluded.versao_texto`,
      )
      .run(id, tipo, versao, this.relogio.agora());
    this.log({ evento: "consentimento", tipo });
  }

  revogar(id: string, tipo: "triagem" | "ritmo"): void {
    this.db
      .update(S.consentimento)
      .set({ revogadoEm: this.relogio.agora() })
      .where(and(eq(S.consentimento.idPseudonimo, id), eq(S.consentimento.tipo, tipo), isNull(S.consentimento.revogadoEm)))
      .run();
    if (tipo === "triagem") this.apagarSaude(id); // D12: revogou a triagem, apaga na hora
    if (tipo === "ritmo") this.sairRitmo(id);
    this.log({ evento: "revogacao", tipo });
  }

  // ---------- conversa ----------

  private salvarSessao(id: string, dono: string, modo: string, estado: Estado, extra: { episodioId?: string | null; terminada?: boolean } = {}): void {
    const valores = {
      id,
      idPseudonimo: dono,
      modo,
      estadoCifrado: this.cifra.cifrar(estado),
      episodioId: extra.episodioId ?? null,
      terminada: extra.terminada ? 1 : 0,
      atualizadoEm: this.relogio.agora(),
    };
    this.db.insert(S.sessao).values(valores).onConflictDoUpdate({ target: S.sessao.id, set: valores }).run();
  }

  private exigirTriagem(id: string): void {
    if (!this.consentimentoAtivo(id, "triagem")) throw new ErroHttp(403, "consentimento_triagem_ausente");
  }

  novaSessao(dono: string, modo: "autoanamnese" | "checagem" | "piora" = "autoanamnese"): { id: string; mensagens: MensagemLevia[] } {
    this.exigirTriagem(dono);
    this.tocarUso(dono);
    const id = randomUUID();
    if (modo === "piora") {
      // D3: "qualquer dia, piora forte ou sinal novo -> a árvore reavalia". Com plano ativo, checagem extra agora
      // (nota, trabalho e sinais de alerta de novo); sem plano, uma autoanamnese nova.
      const p = this.planoAtivo(dono);
      if (p) {
        const s = iniciarChecagem(this.ctx, this.episodio(dono, p.episodioId).regioes, 0);
        this.salvarSessao(id, dono, "checagem", s.estado, { episodioId: p.episodioId });
        this.log({ evento: "sessao_iniciada", modo: "piora_checagem" });
        return { id, mensagens: s.mensagens };
      }
      const s = iniciarPiora(this.ctx);
      this.salvarSessao(id, dono, "autoanamnese", s.estado);
      this.log({ evento: "sessao_iniciada", modo: "piora_nova" });
      return { id, mensagens: s.mensagens };
    }
    if (modo === "checagem") {
      const pend = this.checagemPendente(dono);
      if (!pend) throw new ErroHttp(409, "sem_checagem_pendente");
      const s = iniciarChecagem(this.ctx, pend.regioes, pend.semana);
      this.salvarSessao(id, dono, "checagem", s.estado, { episodioId: pend.episodioId });
      return { id, mensagens: s.mensagens };
    }
    const s = iniciar(this.ctx);
    this.salvarSessao(id, dono, "autoanamnese", s.estado);
    this.log({ evento: "sessao_iniciada", modo });
    return { id, mensagens: s.mensagens };
  }

  async mensagem(dono: string, sessaoId: string, entrada: Entrada): Promise<{ mensagens: MensagemLevia[]; terminada: boolean; tokens: { entrada: number; saida: number }; novaSessaoId?: string }> {
    this.exigirTriagem(dono);
    this.tocarUso(dono);
    const linha = this.db.select().from(S.sessao).where(eq(S.sessao.id, sessaoId)).get();
    if (!linha || linha.idPseudonimo !== dono) throw new ErroHttp(404, "sessao_inexistente");
    const tokens = { entrada: 0, saida: 0 };

    if (linha.terminada) {
      // Depois do resultado: "por quê?" mostra a regra; "recomeçar" abre conversa nova.
      if (entrada.tipo === "texto" && /recome[cç]ar|nova conversa|outra dor/i.test(entrada.texto)) {
        const n = this.novaSessao(dono);
        return { mensagens: n.mensagens, terminada: false, tokens, novaSessaoId: n.id };
      }
      if (entrada.tipo === "texto" && detectarGuardrail(entrada.texto) === "porque" && linha.episodioId) {
        const ep = this.episodio(dono, linha.episodioId);
        return { mensagens: [{ tipo: "texto", textoId: ep.porque, texto: tx(this.conteudo.textos, ep.porque) }], terminada: true, tokens };
      }
      const g = entrada.tipo === "texto" ? detectarGuardrail(entrada.texto) : null;
      const ms: MensagemLevia[] = [];
      if (g && g !== "porque") ms.push({ tipo: "texto", textoId: `guardrail.${g}`, texto: tx(this.conteudo.textos, `guardrail.${g}`) });
      ms.push({ tipo: "texto", textoId: "sessao.fim", texto: tx(this.conteudo.textos, "sessao.fim") });
      return { mensagens: ms, terminada: true, tokens };
    }

    const estado = this.cifra.decifrar<Estado>(linha.estadoCifrado);
    let nlu;
    let iaIndisponivel = false;
    if (entrada.tipo === "texto") {
      const pedido = pedidoNlu(this.ctx, estado, entrada.texto);
      if (pedido && this.nlu) {
        try {
          const r = await this.nlu.extrair(pedido, entrada.texto);
          nlu = r.resposta;
          tokens.entrada += r.uso.tokensEntrada;
          tokens.saida += r.uso.tokensSaida;
          if (!r.uso.cacheAplicacao) this.registrarUsoIa(r.uso.tokensEntrada, r.uso.tokensSaida, r.uso.cacheHit);
        } catch (e) {
          // IA fora do ar nunca bloqueia a triagem: segue com o leitor determinístico.
          iaIndisponivel = true;
          this.log({ evento: "nlu_indisponivel", codigo: e instanceof NluIndisponivel ? e.message : "erro" });
        }
      } else if (pedido && !this.nlu) iaIndisponivel = true;
    }
    // O texto livre bruto não é guardado em lugar nenhum: só o estado estruturado (D12).
    const s = passo(this.ctx, estado, entrada, { nlu, iaIndisponivel });
    if (s.emergencia) this.log({ evento: "emergencia", motivo: s.emergencia });

    if (!s.confirmado) {
      this.salvarSessao(sessaoId, dono, linha.modo, s.estado, { episodioId: linha.episodioId });
      return { mensagens: s.mensagens, terminada: false, tokens };
    }

    let mensagens = [...s.mensagens];
    let episodioId: string | null = linha.episodioId;
    if (s.confirmado.tipo === "autoanamnese") {
      const r = this.concluirAutoanamnese(dono, s.confirmado.respostas);
      episodioId = r.episodioId;
      mensagens = [...mensagens, ...r.mensagens];
    } else if (linha.episodioId) {
      mensagens = [...mensagens, ...this.concluirChecagem(dono, linha.episodioId, s.confirmado.checagem)];
    }
    this.salvarSessao(sessaoId, dono, linha.modo, s.estado, { episodioId, terminada: true });
    return { mensagens, terminada: true, tokens };
  }

  private registrarUsoIa(entrada: number, saida: number, cacheHit: boolean): void {
    const dia = this.relogio.hoje();
    this.db.$client
      .prepare(
        `INSERT INTO uso_ia (dia, chamadas, tokens_entrada, tokens_saida, cache_hits) VALUES (?, 1, ?, ?, ?)
         ON CONFLICT(dia) DO UPDATE SET chamadas = chamadas + 1, tokens_entrada = tokens_entrada + excluded.tokens_entrada,
         tokens_saida = tokens_saida + excluded.tokens_saida, cache_hits = cache_hits + excluded.cache_hits`,
      )
      .run(dia, entrada, saida, cacheHit ? 1 : 0);
  }

  // ---------- episódios, planos e checagens ----------

  private episodiosDe(dono: string) {
    return this.db
      .select()
      .from(S.episodio)
      .where(eq(S.episodio.idPseudonimo, dono))
      .all()
      .map((e) => ({ ...e, dados: this.cifra.decifrar<DadosEpisodio>(e.dadosCifrado) }));
  }

  episodio(dono: string, id: string): DadosEpisodio & { id: string; inicio: string; versaoRegras: string } {
    const e = this.db.select().from(S.episodio).where(eq(S.episodio.id, id)).get();
    if (!e || e.idPseudonimo !== dono) throw new ErroHttp(404, "episodio_inexistente");
    return { id: e.id, inicio: e.inicio, versaoRegras: e.versaoRegras, ...this.cifra.decifrar<DadosEpisodio>(e.dadosCifrado) };
  }

  private pausarPlanos(dono: string): void {
    this.db
      .update(S.plano)
      .set({ status: "pausado", pausadoEm: this.relogio.hoje() })
      .where(and(eq(S.plano.idPseudonimo, dono), eq(S.plano.status, "ativo")))
      .run();
  }

  concluirAutoanamnese(dono: string, respostas: RespostasConfirmadas): { episodioId: string; mensagens: MensagemLevia[]; resultado: TriageResult } {
    const hoje = this.relogio.hoje();
    const anteriores: EpisodioAnterior[] = this.episodiosDe(dono).map((e) => ({ inicio: e.inicio, regioes: e.dados.regioes }));
    const r = triage(respostas, { checagens: [], episodiosAnteriores: anteriores }, this.conteudo.arvore, hoje);
    const id = randomUUID();
    const dados: DadosEpisodio = {
      regioes: respostas.regioes,
      saida: r.saida,
      urgenteHoje: r.urgenteHoje,
      regrasDisparadas: r.regrasDisparadas,
      porque: r.porque,
      startBack: r.startBack,
      respostas,
    };
    this.db.insert(S.episodio).values({ id, idPseudonimo: dono, inicio: hoje, versaoRegras: r.versaoRegras, dadosCifrado: this.cifra.cifrar(dados) }).run();
    // D4: qualquer plano antigo é pausado quando há um episódio novo; o novo só é criado na saída 1.
    this.pausarPlanos(dono);
    let proxima: string | undefined;
    if (r.saida === 1) {
      const exs = escolherExercicios(this.conteudo.catalogo, respostas.regioes);
      const checagens = SEMANAS.map((s) => ({ semana: s, data: somarDias(hoje, s * 7) }));
      proxima = checagens[0]!.data;
      this.db
        .insert(S.plano)
        .values({ id: randomUUID(), episodioId: id, idPseudonimo: dono, exercicios: JSON.stringify(exs.map((e) => e.id)), status: "ativo", criadoEm: hoje, checagens: JSON.stringify(checagens) })
        .run();
    }
    const { mensagens } = montarResultado(r, this.conteudo, { episodioId: id, regioes: respostas.regioes, ...(proxima ? { proximaChecagem: proxima } : {}) });
    this.log({ evento: "episodio_concluido", saida: r.saida, urgente: r.urgenteHoje });
    return { episodioId: id, mensagens, resultado: r };
  }

  planoAtivo(dono: string) {
    return this.db.select().from(S.plano).where(and(eq(S.plano.idPseudonimo, dono), eq(S.plano.status, "ativo"))).get() ?? null;
  }

  checagensFeitas(episodioId: string): DadosChecagem[] {
    return this.db
      .select()
      .from(S.checagem)
      .where(eq(S.checagem.episodioId, episodioId))
      .all()
      .sort((a, b) => a.feitaEm.localeCompare(b.feitaEm))
      .map((c) => this.cifra.decifrar<DadosChecagem>(c.dadosCifrado));
  }

  /** Próxima checagem vencida do plano ativo (semanas 1, 2, 4, 6). */
  checagemPendente(dono: string): { episodioId: string; semana: Semana; regioes: Regiao[]; data: string } | null {
    const p = this.planoAtivo(dono);
    if (!p) return null;
    const feitas = new Set(this.checagensFeitas(p.episodioId).map((c) => c.semana));
    const lista = JSON.parse(p.checagens) as { semana: Semana; data: string }[];
    const prox = lista.find((c) => !feitas.has(c.semana));
    if (!prox || prox.data > this.relogio.hoje()) return null;
    const ep = this.episodio(dono, p.episodioId);
    return { episodioId: p.episodioId, semana: prox.semana, regioes: ep.regioes, data: prox.data };
  }

  concluirChecagem(dono: string, episodioId: string, ch: Checagem): MensagemLevia[] {
    const ep = this.episodio(dono, episodioId);
    this.db.insert(S.checagem).values({ id: randomUUID(), episodioId, semana: ch.semana, feitaEm: this.relogio.agora(), dadosCifrado: this.cifra.cifrar(ch) }).run();
    const historico = { checagens: this.checagensFeitas(episodioId), episodiosAnteriores: [] };
    const r = triage(ep.respostas, historico, this.conteudo.arvore, ep.inicio);
    const plano = this.planoAtivo(dono);
    if (r.saida !== 1) {
      this.pausarPlanos(dono); // D4
      const dados = { ...ep, saida: r.saida, urgenteHoje: r.urgenteHoje, regrasDisparadas: r.regrasDisparadas, porque: r.porque };
      const { id: _i, inicio: _n, versaoRegras: _v, ...semMeta } = dados;
      this.db.update(S.episodio).set({ dadosCifrado: this.cifra.cifrar(semMeta) }).where(eq(S.episodio.id, episodioId)).run();
      this.log({ evento: "checagem_transbordo", saida: r.saida });
      return montarResultado(r, this.conteudo, { episodioId, regioes: ep.regioes }).mensagens;
    }
    const lista = plano ? (JSON.parse(plano.checagens) as { semana: Semana; data: string }[]) : [];
    const feitas = new Set<number>(historico.checagens.map((c) => c.semana));
    const prox = lista.find((c) => !feitas.has(c.semana));
    if (ch.semana === 0) {
      // checagem extra: o plano segue; a agenda das semanas 1, 2, 4 e 6 não muda
      return [{ tipo: "texto", textoId: "piora.continua", texto: tx(this.conteudo.textos, "piora.continua") }];
    }
    if (!prox && plano) {
      this.db.update(S.plano).set({ status: "encerrado", encerradoEm: this.relogio.hoje() }).where(eq(S.plano.id, plano.id)).run();
      return [{ tipo: "texto", textoId: "checagem.fim", texto: tx(this.conteudo.textos, "checagem.fim") }];
    }
    const [a, m, d] = (prox?.data ?? this.relogio.hoje()).split("-");
    return [{ tipo: "texto", textoId: "checagem.continua", texto: tx(this.conteudo.textos, "checagem.continua", { data: `${d}/${m}/${a}` }) }];
  }

  meuPlano(dono: string) {
    const p = this.db
      .select()
      .from(S.plano)
      .where(eq(S.plano.idPseudonimo, dono))
      .all()
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    if (!p) return { status: "nenhum" as const, exercicios: [], checagens: [], checagemPendente: null, registrosHoje: [] };
    // D4: plano pausado não mostra exercício nenhum
    const ids = p.status === "ativo" ? (JSON.parse(p.exercicios) as string[]) : [];
    const exercicios = ids
      .map((id) => this.conteudo.catalogo.exercicios.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ id: e.id, nome: e.nome, objetivo: e.objetivo, passos: e.passos, dose: e.dose, quandoParar: e.quando_parar, midia: e.midia }));
    const hoje = this.relogio.hoje();
    const registrosHoje = this.db
      .select()
      .from(S.registroExercicio)
      .where(and(eq(S.registroExercicio.planoId, p.id), eq(S.registroExercicio.dia, hoje)))
      .all()
      .map((r) => ({ exercicioId: r.exercicioId, quantidade: r.quantidade }));
    const pend = this.checagemPendente(dono);
    return {
      status: p.status,
      exercicios,
      checagens: JSON.parse(p.checagens) as { semana: number; data: string }[],
      checagemPendente: pend ? { semana: pend.semana, data: pend.data } : null,
      registrosHoje,
    };
  }

  registrar(dono: string, novo: { exercicioId: string; dia: string; quantidade: number }) {
    this.tocarUso(dono);
    const p = this.planoAtivo(dono);
    const plano = p
      ? {
          status: p.status,
          exercicios: (JSON.parse(p.exercicios) as string[]).map((id) => ({
            id,
            maximoPorDia: this.conteudo.catalogo.exercicios.find((e) => e.id === id)?.dose.maximo_por_dia ?? 0,
          })),
        }
      : null;
    const existentes = p
      ? this.db.select().from(S.registroExercicio).where(eq(S.registroExercicio.planoId, p.id)).all()
      : [];
    const v = validarRegistro(plano, existentes, novo, this.relogio.hoje());
    if (!v.ok) {
      this.log({ evento: "registro_recusado", motivo: v.motivo });
      return { aceito: false as const, motivo: v.motivo };
    }
    this.db.insert(S.registroExercicio).values({ planoId: p!.id, exercicioId: novo.exercicioId, dia: novo.dia, quantidade: novo.quantidade }).run();
    return { aceito: true as const };
  }

  // ---------- resumo ----------

  dadosResumo(dono: string, episodioId: string): DadosResumo {
    const ep = this.episodio(dono, episodioId);
    const t = this.conteudo.textos;
    const perguntados = (Object.entries(ep.respostas.achados) as [Achado, boolean][])
      .filter(([a]) => (ACHADOS as readonly string[]).includes(a))
      .map(([achado, presente]) => ({ achado, nome: tx(t, `achado.${achado}`), presente }));
    return {
      data: ep.inicio,
      regioes: ep.regioes,
      duracaoDias: ep.respostas.duracaoDias,
      dorNota: ep.respostas.dorNota,
      achadosPerguntados: perguntados,
      // TODO(D5): STarT Back foi validado para lombar; fora dela vai marcado no resumo.
      startBack: { total: ep.startBack.total, risco: ep.startBack.risco },
      startBackForaDaLombar: ep.regioes.some((r) => r !== "lombar"),
      saida: ep.saida,
      tituloSaida: tx(t, `saida${ep.saida}.titulo`),
      versaoRegras: ep.versaoRegras,
      avisoFixo: tx(t, "aviso.fixo"),
    };
  }

  // ---------- Ritmo ----------

  entrarRitmo(dono: string, apelido: string): void {
    if (!this.consentimentoAtivo(dono, "ritmo")) throw new ErroHttp(403, "consentimento_ritmo_ausente");
    const p = this.pessoa(dono);
    // Apelido único dentro da equipe (sem diferença de maiúsculas e acentos), para ninguém ser confundido.
    const chave = (a: string) => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const colegas = this.db.select().from(S.ritmoMembro).where(and(eq(S.ritmoMembro.setorId, p.setorId), isNull(S.ritmoMembro.saiuEm))).all();
    if (colegas.some((m) => m.idPseudonimo !== dono && chave(m.apelido) === chave(apelido))) throw new ErroHttp(409, "apelido_em_uso");
    const ja = colegas.find((m) => m.idPseudonimo === dono);
    if (ja) {
      this.db.update(S.ritmoMembro).set({ apelido }).where(and(eq(S.ritmoMembro.idPseudonimo, dono), isNull(S.ritmoMembro.saiuEm))).run();
      return;
    }
    const hoje = this.relogio.hoje();
    const deHoje = this.db
      .select()
      .from(S.ritmoMembro)
      .where(and(eq(S.ritmoMembro.idPseudonimo, dono), eq(S.ritmoMembro.setorId, p.setorId), eq(S.ritmoMembro.entrouEm, hoje)))
      .get();
    if (deHoje) {
      // saiu e voltou no mesmo dia: reabre a mesma participação (a chave é setor + pessoa + data de entrada)
      this.db
        .update(S.ritmoMembro)
        .set({ apelido, saiuEm: null })
        .where(and(eq(S.ritmoMembro.idPseudonimo, dono), eq(S.ritmoMembro.setorId, p.setorId), eq(S.ritmoMembro.entrouEm, hoje)))
        .run();
      return;
    }
    this.db.insert(S.ritmoMembro).values({ setorId: p.setorId, idPseudonimo: dono, apelido, entrouEm: hoje }).run();
  }

  sairRitmo(dono: string): void {
    this.db.update(S.ritmoMembro).set({ saiuEm: this.relogio.hoje() }).where(and(eq(S.ritmoMembro.idPseudonimo, dono), isNull(S.ritmoMembro.saiuEm))).run();
  }

  /** Dias da pessoa nos últimos 28 dias desde que entrou no Ritmo. */
  private diasRitmo(id: string, desde: string): DiaPessoa[] {
    const hoje = this.relogio.hoje();
    const inicio = [desde, somarDias(hoje, -27)].sort().at(-1)!;
    const planos = this.db.select().from(S.plano).where(eq(S.plano.idPseudonimo, id)).all();
    const regs = new Set<string>();
    for (const p of planos)
      for (const r of this.db.select().from(S.registroExercicio).where(eq(S.registroExercicio.planoId, p.id)).all()) regs.add(r.dia);
    const out: DiaPessoa[] = [];
    for (let d = inicio; d <= hoje; d = somarDias(d, 1)) {
      const ativo = planos.some((p) => p.criadoEm <= d && (!p.pausadoEm || d < p.pausadoEm) && (!p.encerradoEm || d < p.encerradoEm));
      out.push({ dia: d, planoAtivo: ativo, cumpriu: ativo && regs.has(d) });
    }
    return out;
  }

  /**
   * Atividades da própria pessoa nos últimos `dias` dias (o mais antigo primeiro), para o mapa de calor do Ritmo.
   * quantidade = soma dos registros do dia; planoAtivo = false nos dias sem plano ou em pausa (D4/D6: neutros).
   * Só vai para a própria pessoa: nunca para a equipe nem para o RH.
   */
  atividadesRecentes(dono: string, dias = 14): { dia: string; quantidade: number; planoAtivo: boolean }[] {
    const hoje = this.relogio.hoje();
    const planos = this.db.select().from(S.plano).where(eq(S.plano.idPseudonimo, dono)).all();
    const porDia = new Map<string, number>();
    for (const p of planos)
      for (const r of this.db.select().from(S.registroExercicio).where(eq(S.registroExercicio.planoId, p.id)).all())
        porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.quantidade);
    const out: { dia: string; quantidade: number; planoAtivo: boolean }[] = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = somarDias(hoje, -i);
      const ativo = planos.some((p) => p.criadoEm <= d && (!p.pausadoEm || d < p.pausadoEm) && (!p.encerradoEm || d < p.encerradoEm));
      out.push({ dia: d, quantidade: porDia.get(d) ?? 0, planoAtivo: ativo });
    }
    return out;
  }

  placarRitmo(dono: string) {
    const eu = this.pessoa(dono);
    const p = this.db.select().from(S.pessoa).all();
    const setores = this.db.select().from(S.setor).where(eq(S.setor.empresaId, eu.empresaId)).all();
    const membros = this.db.select().from(S.ritmoMembro).where(isNull(S.ritmoMembro.saiuEm)).all();
    const equipes = setores.map((s) => ({
      setorId: s.id,
      nome: s.nome,
      membros: membros
        .filter((m) => m.setorId === s.id && p.some((x) => x.idPseudonimo === m.idPseudonimo && x.empresaId === eu.empresaId))
        .map((m) => this.diasRitmo(m.idPseudonimo, m.entrouEm)),
    }));
    const meu = membros.find((m) => m.idPseudonimo === dono);
    const hoje = this.relogio.hoje();
    const minha = meu ? constanciaPessoa(this.diasRitmo(dono, meu.entrouEm), hoje) : null;
    return {
      participando: !!meu,
      apelido: meu?.apelido ?? null,
      // só equipes (D6); equipes < 5 não aparecem (D11)
      equipes: placar(equipes, undefined, hoje).map((e) => ({ nome: e.nome, constancia: e.constancia, participantes: e.participantes, minha: e.setorId === eu.setorId })),
      // progresso individual: só para a própria pessoa
      meuProgresso: minha ? { diasCumpridos: minha.cumpridos, diasQueContam: minha.contam } : null,
      // mapa de calor das 2 últimas semanas: só para a própria pessoa (participe ou não do Ritmo)
      minhasAtividades: this.atividadesRecentes(dono, 14),
      hoje,
      // apelidos da própria equipe, sem pontuação
      minhaEquipe: meu
        ? membros
            .filter((m) => m.setorId === eu.setorId)
            .map((m) => m.apelido)
            .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }))
        : [],
    };
  }

  // ---------- RH (só via privacy) ----------

  fonteRh(): FonteRh {
    const mes = (d: string) => d.slice(0, 7);
    return {
      setores: (empresaId) => this.db.select({ id: S.setor.id, nome: S.setor.nome }).from(S.setor).where(eq(S.setor.empresaId, empresaId)).all(),
      usos: (empresaId) => this.episodiosDaEmpresa(empresaId).map((e) => ({ pessoa: e.pessoa, setorId: e.setorId, mes: mes(e.inicio) })),
      episodios: (empresaId) => this.episodiosDaEmpresa(empresaId).map((e) => ({ pessoa: e.pessoa, setorId: e.setorId, mes: mes(e.inicio), regioes: e.dados.regioes, saida: e.dados.saida })),
      ritmo: (empresaId) => {
        const pessoas = this.db.select().from(S.pessoa).where(eq(S.pessoa.empresaId, empresaId)).all();
        const membros = this.db.select().from(S.ritmoMembro).where(isNull(S.ritmoMembro.saiuEm)).all();
        return membros
          .filter((m) => pessoas.some((p) => p.idPseudonimo === m.idPseudonimo))
          .map((m) => {
            const c = constanciaPessoa(this.diasRitmo(m.idPseudonimo, m.entrouEm), this.relogio.hoje());
            return { pessoa: m.idPseudonimo, setorId: m.setorId, mes: mes(this.relogio.hoje()), constancia: c.contam ? c.cumpridos / c.contam : 0 };
          });
      },
    };
  }

  private episodiosDaEmpresa(empresaId: string) {
    const pessoas = this.db.select().from(S.pessoa).where(and(eq(S.pessoa.empresaId, empresaId), eq(S.pessoa.papel, "funcionario"))).all();
    const setorDe = new Map(pessoas.map((p) => [p.idPseudonimo, p.setorId]));
    return this.db
      .select()
      .from(S.episodio)
      .all()
      .filter((e) => setorDe.has(e.idPseudonimo))
      .map((e) => ({ pessoa: e.idPseudonimo, setorId: setorDe.get(e.idPseudonimo)!, inicio: e.inicio, dados: this.cifra.decifrar<DadosEpisodio>(e.dadosCifrado) }));
  }

  // ---------- meus dados (LGPD) ----------

  meusDados(dono: string) {
    const p = this.pessoa(dono);
    return {
      pessoa: { setor: this.db.select().from(S.setor).where(eq(S.setor.id, p.setorId)).get()?.nome ?? null, desde: p.criadoEm },
      consentimentos: this.db.select().from(S.consentimento).where(eq(S.consentimento.idPseudonimo, dono)).all().map((c) => ({ tipo: c.tipo, versao: c.versaoTexto, dadoEm: c.dadoEm, revogadoEm: c.revogadoEm })),
      episodios: this.episodiosDe(dono).map((e) => ({ id: e.id, inicio: e.inicio, versaoRegras: e.versaoRegras, ...e.dados, checagens: this.checagensFeitas(e.id) })),
      planos: this.db.select().from(S.plano).where(eq(S.plano.idPseudonimo, dono)).all().map((pl) => ({
        status: pl.status,
        exercicios: JSON.parse(pl.exercicios) as string[],
        criadoEm: pl.criadoEm,
        registros: this.db.select().from(S.registroExercicio).where(eq(S.registroExercicio.planoId, pl.id)).all().map((r) => ({ exercicioId: r.exercicioId, dia: r.dia, quantidade: r.quantidade })),
      })),
      ritmo: this.db.select().from(S.ritmoMembro).where(eq(S.ritmoMembro.idPseudonimo, dono)).all().map((m) => ({ apelido: m.apelido, entrouEm: m.entrouEm, saiuEm: m.saiuEm })),
    };
  }

  /** Apaga todos os dados de saúde da pessoa (episódios, checagens, planos, registros, sessões, Ritmo). */
  apagarSaude(dono: string): void {
    this.db.$client.transaction(() => {
      const eps = this.db.select({ id: S.episodio.id }).from(S.episodio).where(eq(S.episodio.idPseudonimo, dono)).all();
      for (const e of eps) {
        const pls = this.db.select({ id: S.plano.id }).from(S.plano).where(eq(S.plano.episodioId, e.id)).all();
        for (const pl of pls) this.db.delete(S.registroExercicio).where(eq(S.registroExercicio.planoId, pl.id)).run();
        this.db.delete(S.plano).where(eq(S.plano.episodioId, e.id)).run();
        this.db.delete(S.checagem).where(eq(S.checagem.episodioId, e.id)).run();
      }
      this.db.delete(S.episodio).where(eq(S.episodio.idPseudonimo, dono)).run();
      this.db.delete(S.sessao).where(eq(S.sessao.idPseudonimo, dono)).run();
      this.db.delete(S.ritmoMembro).where(eq(S.ritmoMembro.idPseudonimo, dono)).run();
    })();
  }

  /** "Apagar tudo" (R15): saúde, Ritmo, consentimentos e a própria pessoa. */
  apagarTudo(dono: string): void {
    this.apagarSaude(dono);
    this.db.delete(S.consentimento).where(eq(S.consentimento.idPseudonimo, dono)).run();
    this.db.delete(S.ultimoUso).where(eq(S.ultimoUso.idPseudonimo, dono)).run();
    this.db.delete(S.pessoa).where(eq(S.pessoa.idPseudonimo, dono)).run();
    this.log({ evento: "apagar_tudo" });
  }

  /** Job diário (D12): apaga dados de saúde 12 meses após o último uso. */
  retencao(): number {
    const limite = somarDias(this.relogio.hoje(), -365);
    const velhos = this.db.select().from(S.ultimoUso).where(lt(S.ultimoUso.em, limite)).all();
    for (const v of velhos) this.apagarSaude(v.idPseudonimo);
    // sessões abandonadas há mais de 1 dia também saem (estado parcial é dado de saúde)
    const ontem = new Date(Date.parse(this.relogio.agora()) - 86_400_000).toISOString();
    this.db.delete(S.sessao).where(lt(S.sessao.atualizadoEm, ontem)).run();
    this.log({ evento: "retencao", apagados: velhos.length });
    return velhos.length;
  }

  /**
   * Uso de IA por dia, sem conteúdo (M8). O preço por token é parâmetro pendente (seção 12):
   * LEVIA_PRECO_TOKEN_ENTRADA e LEVIA_PRECO_TOKEN_SAIDA, em reais por token. TODO(M8): definir.
   */
  usoIaResumo() {
    const pe = Number(process.env.LEVIA_PRECO_TOKEN_ENTRADA ?? NaN);
    const ps = Number(process.env.LEVIA_PRECO_TOKEN_SAIDA ?? NaN);
    return this.db.select().from(S.usoIa).all().map((u) => ({
      ...u,
      custoReais: Number.isFinite(pe) && Number.isFinite(ps) ? u.tokensEntrada * pe + u.tokensSaida * ps : null,
    }));
  }
}

export { diasEntre };
