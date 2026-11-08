// Máquina de estados da conversa: roteiro, confirmação e checagens (D3).
// Pura: não chama a IA. Quem chama a IA é o servidor, e o resultado chega aqui já estruturado
// (e é validado de novo). A árvore só roda depois da confirmação (R3).
import type {
  Achado,
  Arvore,
  Checagem,
  MensagemLevia,
  Regiao,
  RespostasConfirmadas,
  SemanaChecagem,
} from "@levia/shared";
import { ACHADOS, NOME_REGIAO, REGIOES } from "@levia/shared";
import { emergencia as detectarEmergencia, mencoes, type Emergencia } from "@levia/redflags";
import { texto as tx, type Textos } from "@levia/content";
import {
  limpar,
  numerosPorExtenso,
  lerConcordancia,
  lerDuracao,
  lerGrupo,
  lerIncomodo,
  lerNota,
  lerRegioes,
  lerSimNao,
} from "./leitor.ts";
import { detectarGuardrail, TEXTO_GUARDRAIL } from "./guardrails.ts";

export * from "./leitor.ts";
export * from "./guardrails.ts";
export { montarResultado, escolherExercicios, type DadosResultado } from "./resultado.ts";

// ---------- tipos ----------

export interface GrupoPlano {
  id: string;
  textoId: string;
  itens: { achado: Achado; perguntaUnica: string }[];
}

export type Etapa =
  | { k: "regiao" }
  | { k: "duracao" }
  | { k: "nota" }
  | { k: "alerta"; grupo: number }
  | { k: "startback"; item: number }
  | { k: "confirmacao" }
  | { k: "correcao" }
  | { k: "chk_nota" }
  | { k: "chk_trabalho" }
  | { k: "chk_recuperado" }
  | { k: "pronto" }
  | { k: "emergencia" };

export interface PerguntaUnica {
  achado: Achado;
  textoId: string;
  tentativas: number;
}

export interface Estado {
  modo: "autoanamnese" | "checagem";
  semana?: SemanaChecagem;
  etapa: Etapa;
  /** etapa para onde voltar depois das perguntas fechadas de menção/dúvida */
  fila: PerguntaUnica[];
  regioes: Regiao[];
  duracaoDias?: number;
  dorNota?: number;
  achados: Partial<Record<Achado, boolean>>;
  grupos: GrupoPlano[];
  startBack: (number | undefined)[];
  limitaTrabalho?: boolean;
  recuperado?: boolean;
  tentativas: number;
  perguntasFeitas: number;
  iaIndisponivel: boolean;
}

export type Entrada =
  | { tipo: "mapa"; regioes: Regiao[] }
  | { tipo: "texto"; texto: string; origem?: "texto" | "voz" };

/** O que a NLU devolve (já validado pelo servidor e validado de novo aqui). */
export interface RespostaNlu {
  valor: unknown;
  confianca: "alta" | "media" | "baixa";
  precisa_confirmar: boolean;
  mencoes_alerta: string[];
}

export type TipoPergunta =
  | "regioes"
  | "duracao"
  | "nota"
  | "sim_nao"
  | "grupo_alerta"
  | "concordancia"
  | "incomodo"
  | "correcao";

export interface PedidoNlu {
  perguntaId: string;
  tipo: TipoPergunta;
  /** ids possíveis (achados de um grupo, regiões) — nunca textos de outras pessoas */
  opcoes: string[];
}

export interface Saida {
  estado: Estado;
  mensagens: MensagemLevia[];
  /** Preenchido quando a pessoa confirmou: hora de rodar a árvore. */
  confirmado?: { tipo: "autoanamnese"; respostas: RespostasConfirmadas } | { tipo: "checagem"; checagem: Checagem };
  emergencia?: Emergencia;
}

export interface Contexto {
  arvore: Arvore;
  textos: Textos;
}

// ---------- montagem ----------

function msg(c: Contexto, id: string, vars?: Record<string, string | number>): MensagemLevia {
  return { tipo: "texto", textoId: id, texto: tx(c.textos, id, vars) };
}

export function planejarGrupos(arvore: Arvore, regioes: readonly Regiao[]): GrupoPlano[] {
  const vistos = new Set<Achado>();
  const out: GrupoPlano[] = [];
  for (const p of arvore.perguntas_alerta) {
    if (!p.regioes.some((r) => regioes.includes(r))) continue;
    const novos = p.itens.filter((i) => !vistos.has(i.achado));
    // Um grupo cujos itens já foram todos perguntados não se repete.
    if (novos.length === 0) continue;
    // Se só uma parte é nova, ainda usamos o texto inteiro do grupo: perguntar a mais é seguro.
    for (const i of p.itens) vistos.add(i.achado);
    out.push({
      id: p.id,
      textoId: p.texto,
      itens: p.itens.map((i) => ({ achado: i.achado, perguntaUnica: i.pergunta_unica })),
    });
  }
  return out;
}

function dorDe(regioes: readonly Regiao[]): string {
  return regioes.some((r) => r === "lombar" || r === "costas_alta") ? "dor nas costas" : "dor";
}

export function iniciar(c: Contexto): Saida {
  const estado: Estado = {
    modo: "autoanamnese",
    etapa: { k: "regiao" },
    fila: [],
    regioes: [],
    achados: {},
    grupos: [],
    startBack: [],
    tentativas: 0,
    perguntasFeitas: 1,
    iaIndisponivel: false,
  };
  return {
    estado,
    mensagens: [
      { tipo: "cartao_mapa", textoId: "pergunta.regiao", texto: tx(c.textos, "pergunta.regiao") },
    ],
  };
}

export function iniciarChecagem(c: Contexto, regioes: Regiao[], semana: SemanaChecagem): Saida {
  const estado: Estado = {
    modo: "checagem",
    semana,
    etapa: { k: "chk_nota" },
    fila: [],
    regioes,
    achados: {},
    grupos: planejarGrupos(c.arvore, regioes),
    startBack: [],
    tentativas: 0,
    perguntasFeitas: 1,
    iaIndisponivel: false,
  };
  const intro = semana === 0 ? msg(c, "piora.checagem.intro") : msg(c, "checagem.intro", { semana });
  return { estado, mensagens: [intro, msg(c, "checagem.nota")] };
}

/** "Minha dor piorou" sem plano ativo: uma autoanamnese nova, com uma frase de acolhida antes do mapa. */
export function iniciarPiora(c: Contexto): Saida {
  const s = iniciar(c);
  return { ...s, mensagens: [msg(c, "piora.nova.intro"), ...s.mensagens] };
}

/** Pergunta da etapa atual (ou da fila de perguntas fechadas). */
function perguntaAtual(c: Contexto, e: Estado, simples = false): MensagemLevia[] {
  const f = e.fila[0];
  if (f) {
    const extra = f.tentativas > 0 ? [msg(c, "alerta.repergunta.sim_nao")] : [];
    return [...extra, msg(c, f.textoId)];
  }
  const et = e.etapa;
  switch (et.k) {
    case "regiao":
      return [simples ? msg(c, "pergunta.regiao.repergunta") : { tipo: "cartao_mapa", textoId: "pergunta.regiao", texto: tx(c.textos, "pergunta.regiao") }];
    case "duracao":
      return [msg(c, simples ? "pergunta.duracao.repergunta" : "pergunta.duracao")];
    case "nota":
    case "chk_nota":
      return [msg(c, simples ? "pergunta.dor_nota.repergunta" : "pergunta.dor_nota")];
    case "alerta":
      return [msg(c, e.grupos[et.grupo]!.textoId)];
    case "startback": {
      const id = `startback.${et.item + 1}`;
      if (simples) return [msg(c, et.item === 8 ? "startback.9.repergunta" : "startback.repergunta"), msg(c, id, { dor: dorDe(e.regioes) })];
      return [msg(c, id, { dor: dorDe(e.regioes) })];
    }
    case "confirmacao":
      return [simples ? msg(c, "confirmacao.repergunta") : confirmacao(c, e)];
    case "correcao":
      return [msg(c, "confirmacao.o_que_mudar")];
    case "chk_trabalho":
      return [msg(c, simples ? "checagem.trabalho.repergunta" : "checagem.trabalho")];
    case "chk_recuperado":
      return [msg(c, "checagem.recuperado")];
    default:
      return [];
  }
}

function nomeAchado(c: Contexto, a: Achado): string {
  return tx(c.textos, `achado.${a}`);
}

export function textoDuracao(dias: number): string {
  if (dias <= 0) return "menos de 1 dia";
  if (dias === 1) return "1 dia";
  if (dias < 14) return `${dias} dias`;
  if (dias < 60) {
    const s = Math.round(dias / 7);
    return s === 1 ? "1 semana" : `${s} semanas`;
  }
  if (dias < 365) return `${Math.round(dias / 30)} meses`;
  const a = Math.round(dias / 365);
  return a === 1 ? "1 ano" : `${a} anos`;
}

function listaNatural(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
}

function confirmacao(c: Contexto, e: Estado): MensagemLevia {
  const presentes = ACHADOS.filter((a) => e.achados[a] === true);
  const alertas = presentes.length
    ? tx(c.textos, "confirmacao.com_alerta", { lista: listaNatural(presentes.map((a) => nomeAchado(c, a))) })
    : tx(c.textos, "confirmacao.sem_alerta");
  if (e.modo === "checagem") {
    return msg(c, "checagem.confirmacao", {
      nota: e.dorNota ?? 0,
      trabalho: tx(c.textos, e.limitaTrabalho ? "checagem.trabalho.sim" : "checagem.trabalho.nao"),
      alertas,
    });
  }
  const regs = e.regioes.map((r) => NOME_REGIAO[r]);
  const prefixo = e.regioes.length === 1 && e.regioes[0] === "lombar" ? "na" : "em";
  return msg(c, "confirmacao.texto", {
    regioes: `${prefixo} ${listaNatural(regs)}`,
    duracao: textoDuracao(e.duracaoDias ?? 0),
    nota: e.dorNota ?? 0,
    alertas,
  });
}

// ---------- avanço ----------

function proximaEtapa(e: Estado): Etapa {
  const et = e.etapa;
  if (e.modo === "checagem") {
    switch (et.k) {
      case "chk_nota":
        return { k: "chk_trabalho" };
      case "chk_trabalho":
        return e.grupos.length ? { k: "alerta", grupo: 0 } : e.semana === 6 ? { k: "chk_recuperado" } : { k: "confirmacao" };
      case "alerta":
        if (et.grupo + 1 < e.grupos.length) return { k: "alerta", grupo: et.grupo + 1 };
        return e.semana === 6 ? { k: "chk_recuperado" } : { k: "confirmacao" };
      case "chk_recuperado":
        return { k: "confirmacao" };
      default:
        return { k: "confirmacao" };
    }
  }
  switch (et.k) {
    case "regiao":
      return { k: "duracao" };
    case "duracao":
      return { k: "nota" };
    case "nota":
      return { k: "alerta", grupo: 0 };
    case "alerta":
      if (et.grupo + 1 < e.grupos.length) return { k: "alerta", grupo: et.grupo + 1 };
      return { k: "startback", item: 0 };
    case "startback":
      return et.item < 8 ? { k: "startback", item: et.item + 1 } : { k: "confirmacao" };
    default:
      return { k: "confirmacao" };
  }
}

function enfileirar(e: Estado, a: Achado, c: Contexto): void {
  if (e.achados[a] === true) return;
  if (e.fila.some((f) => f.achado === a)) return;
  const item = c.arvore.perguntas_alerta.flatMap((p) => p.itens).find((i) => i.achado === a);
  if (!item) return;
  e.fila.push({ achado: a, textoId: item.pergunta_unica, tentativas: 0 });
}

function clonar(e: Estado): Estado {
  return JSON.parse(JSON.stringify(e)) as Estado;
}

/** Diz se o leitor determinístico não entende o texto e a NLU pode ajudar. */
export function pedidoNlu(c: Contexto, e: Estado, texto: string): PedidoNlu | null {
  if (lerLocal(c, e, texto).ok) return null;
  const f = e.fila[0];
  if (f) return { perguntaId: `alerta.unica.${f.achado}`, tipo: "sim_nao", opcoes: ["sim", "nao", "incerto"] };
  const et = e.etapa;
  switch (et.k) {
    case "regiao":
      return { perguntaId: "regiao", tipo: "regioes", opcoes: [...REGIOES] };
    case "duracao":
      return { perguntaId: "duracao", tipo: "duracao", opcoes: [] };
    case "nota":
    case "chk_nota":
      return { perguntaId: "dor_nota", tipo: "nota", opcoes: [] };
    case "alerta":
      return { perguntaId: e.grupos[et.grupo]!.id, tipo: "grupo_alerta", opcoes: e.grupos[et.grupo]!.itens.map((i) => i.achado) };
    case "startback":
      return et.item === 8
        ? { perguntaId: "startback.9", tipo: "incomodo", opcoes: ["nada", "pouco", "moderado", "muito", "extremamente"] }
        : { perguntaId: `startback.${et.item + 1}`, tipo: "concordancia", opcoes: ["concordo", "discordo"] };
    case "chk_trabalho":
    case "chk_recuperado":
    case "confirmacao":
      return { perguntaId: et.k, tipo: "sim_nao", opcoes: ["sim", "nao", "incerto"] };
    case "correcao":
      return { perguntaId: "correcao", tipo: "correcao", opcoes: [] };
    default:
      return null;
  }
}

type Leitura = { ok: true; aplicar: (e: Estado) => void } | { ok: false };

/** Leitura determinística para a etapa atual. */
function lerLocal(c: Contexto, e: Estado, texto: string): Leitura {
  const f = e.fila[0];
  if (f) {
    const sn = lerSimNao(texto);
    if (sn === "sim") return { ok: true, aplicar: (s) => { s.achados[f.achado] = true; s.fila.shift(); } };
    if (sn === "nao") return { ok: true, aplicar: (s) => { s.achados[f.achado] = false; s.fila.shift(); } };
    return { ok: false };
  }
  const et = e.etapa;
  switch (et.k) {
    case "regiao": {
      const r = lerRegioes(texto);
      return r.length ? { ok: true, aplicar: (s) => definirRegioes(c, s, r) } : { ok: false };
    }
    case "duracao": {
      const d = lerDuracao(texto);
      return d !== null ? { ok: true, aplicar: (s) => { s.duracaoDias = d; } } : { ok: false };
    }
    case "nota":
    case "chk_nota": {
      const n = lerNota(texto);
      return n !== null ? { ok: true, aplicar: (s) => { s.dorNota = n; } } : { ok: false };
    }
    case "alerta": {
      const g = e.grupos[et.grupo]!;
      const l = lerGrupo(texto, g.itens.map((i) => i.achado));
      if (!l) return { ok: false };
      return {
        ok: true,
        aplicar: (s) => {
          for (const a of l.presentes) s.achados[a] = true;
          for (const a of l.ausentes) if (s.achados[a] !== true) s.achados[a] = false;
          for (const a of l.duvida) {
            const it = g.itens.find((i) => i.achado === a)!;
            if (s.achados[a] !== true && !s.fila.some((q) => q.achado === a))
              s.fila.push({ achado: a, textoId: it.perguntaUnica, tentativas: 0 });
          }
        },
      };
    }
    case "startback": {
      if (et.item === 8) {
        const v = lerIncomodo(texto);
        return v !== null ? { ok: true, aplicar: (s) => { s.startBack[8] = v; } } : { ok: false };
      }
      const v = lerConcordancia(texto);
      return v === 0 || v === 1 ? { ok: true, aplicar: (s) => { s.startBack[et.item] = v; } } : { ok: false };
    }
    case "chk_trabalho": {
      const sn = lerSimNao(texto);
      if (sn === "sim" || sn === "nao") return { ok: true, aplicar: (s) => { s.limitaTrabalho = sn === "sim"; } };
      return { ok: false };
    }
    case "chk_recuperado": {
      const sn = lerSimNao(texto);
      // "mais ou menos" não é recuperado (D1)
      if (sn) return { ok: true, aplicar: (s) => { s.recuperado = sn === "sim"; } };
      return { ok: false };
    }
    case "confirmacao": {
      const sn = lerSimNao(texto);
      if (sn === "sim") return { ok: true, aplicar: (s) => { s.etapa = { k: "pronto" }; } };
      if (sn === "nao" || sn === "incerto") {
        // "não, são 5 dias": tenta corrigir direto
        const cor = lerCorrecao(texto);
        if (cor) return { ok: true, aplicar: (s) => aplicarCorrecao(c, s, cor) };
        return { ok: true, aplicar: (s) => { s.etapa = { k: "correcao" }; } };
      }
      const cor = lerCorrecao(texto);
      if (cor) return { ok: true, aplicar: (s) => aplicarCorrecao(c, s, cor) };
      return { ok: false };
    }
    case "correcao": {
      const cor = lerCorrecao(texto);
      return cor ? { ok: true, aplicar: (s) => aplicarCorrecao(c, s, cor) } : { ok: false };
    }
    default:
      return { ok: false };
  }
}

interface Correcao {
  substituirRegioes?: boolean;
  regioes?: Regiao[];
  duracaoDias?: number;
  dorNota?: number;
}

function lerCorrecao(texto: string): Correcao | null {
  const out: Correcao = {};
  const r = lerRegioes(texto);
  if (r.length) out.regioes = r;
  const base = numerosPorExtenso(limpar(texto));
  const d = lerDuracao(texto);
  if (d !== null) out.duracaoDias = d;
  // A nota é lida no que sobra depois de tirar a duração ("5 dias", "1 semana").
  const semTempo = base.replace(/\d+(?:[.,]\d+)?\s*(dias?|semanas?|mes|meses|anos?|horas?)\b/g, " ");
  const n = lerNota(semTempo);
  if (n !== null) out.dorNota = n;
  if (r.length && /\b(so|apenas|somente)\b/.test(base)) out.substituirRegioes = true;
  return Object.keys(out).length ? out : null;
}

function definirRegioes(c: Contexto, s: Estado, r: Regiao[]): void {
  s.regioes = r;
  s.grupos = planejarGrupos(c.arvore, r);
}

function aplicarCorrecao(c: Contexto, s: Estado, cor: Correcao): void {
  if (cor.duracaoDias !== undefined) s.duracaoDias = cor.duracaoDias;
  if (cor.dorNota !== undefined) s.dorNota = cor.dorNota;
  if (cor.regioes && s.modo === "autoanamnese") {
    // Correção de região soma regiões; só troca se a pessoa disser "só" ou "apenas".
    const alvo = cor.substituirRegioes ? cor.regioes : [...s.regioes, ...cor.regioes.filter((r) => !s.regioes.includes(r))];
    const mudou = alvo.length !== s.regioes.length || alvo.some((r) => !s.regioes.includes(r));
    if (mudou) {
      // Região nova: os sinais de alerta da nova região têm de ser perguntados (R4).
      const jaPerguntados = new Set(Object.keys(s.achados));
      definirRegioes(c, s, alvo);
      for (const g of s.grupos)
        for (const i of g.itens)
          if (!jaPerguntados.has(i.achado) && !s.fila.some((q) => q.achado === i.achado))
            s.fila.push({ achado: i.achado, textoId: i.perguntaUnica, tentativas: 0 });
    }
  }
  s.etapa = { k: "confirmacao" };
}

/** Aplica a resposta da NLU, com as travas de segurança: a IA só acrescenta alerta, nunca remove. */
function lerNlu(c: Contexto, e: Estado, nlu: RespostaNlu): Leitura {
  if (nlu.confianca === "baixa") return { ok: false };
  const v = nlu.valor;
  const f = e.fila[0];
  if (f) {
    // Em sinal de alerta, a IA só pode dizer "sim". "Não" da IA não vale: repergunta.
    if (v === "sim") return { ok: true, aplicar: (s) => { s.achados[f.achado] = true; s.fila.shift(); } };
    return { ok: false };
  }
  const et = e.etapa;
  switch (et.k) {
    case "regiao": {
      const r = Array.isArray(v) ? v.filter((x): x is Regiao => (REGIOES as readonly string[]).includes(x as string)) : [];
      return r.length ? { ok: true, aplicar: (s) => definirRegioes(c, s, r) } : { ok: false };
    }
    case "duracao":
      return typeof v === "number" && v >= 0 && v < 36500 ? { ok: true, aplicar: (s) => { s.duracaoDias = Math.round(v); } } : { ok: false };
    case "nota":
    case "chk_nota":
      return typeof v === "number" && v >= 0 && v <= 10 ? { ok: true, aplicar: (s) => { s.dorNota = Math.ceil(v); } } : { ok: false };
    case "alerta": {
      const g = e.grupos[et.grupo]!;
      const ids = g.itens.map((i) => i.achado);
      const pres = Array.isArray(v) ? v.filter((x): x is Achado => ids.includes(x as Achado)) : [];
      // Só aceitamos presença. "Nenhuma" dita pela IA vira repergunta, um sinal por vez.
      if (pres.length) {
        return {
          ok: true,
          aplicar: (s) => {
            for (const a of pres) s.achados[a] = true;
            for (const it of g.itens)
              if (!pres.includes(it.achado) && s.achados[it.achado] !== true && !s.fila.some((q) => q.achado === it.achado))
                s.fila.push({ achado: it.achado, textoId: it.perguntaUnica, tentativas: 0 });
          },
        };
      }
      return {
        ok: true,
        aplicar: (s) => {
          for (const it of g.itens)
            if (s.achados[it.achado] !== true && !s.fila.some((q) => q.achado === it.achado))
              s.fila.push({ achado: it.achado, textoId: it.perguntaUnica, tentativas: 0 });
        },
      };
    }
    case "startback":
      if (et.item === 8) return v === 0 || v === 1 ? { ok: true, aplicar: (s) => { s.startBack[8] = v; } } : { ok: false };
      return v === 0 || v === 1 ? { ok: true, aplicar: (s) => { s.startBack[et.item] = v; } } : { ok: false };
    case "chk_trabalho":
      return v === "sim" || v === "nao" ? { ok: true, aplicar: (s) => { s.limitaTrabalho = v === "sim"; } } : { ok: false };
    case "chk_recuperado":
      return v === "sim" || v === "nao" ? { ok: true, aplicar: (s) => { s.recuperado = v === "sim"; } } : { ok: false };
    case "confirmacao":
      if (v === "sim" && !nlu.precisa_confirmar) return { ok: true, aplicar: (s) => { s.etapa = { k: "pronto" }; } };
      if (v === "nao") return { ok: true, aplicar: (s) => { s.etapa = { k: "correcao" }; } };
      return { ok: false };
    case "correcao": {
      if (!v || typeof v !== "object") return { ok: false };
      const o = v as Record<string, unknown>;
      const cor: Correcao = {};
      if (Array.isArray(o.regioes)) {
        const r = o.regioes.filter((x): x is Regiao => (REGIOES as readonly string[]).includes(x as string));
        if (r.length) cor.regioes = r;
      }
      if (typeof o.duracaoDias === "number" && o.duracaoDias >= 0) cor.duracaoDias = Math.round(o.duracaoDias);
      if (typeof o.dorNota === "number" && o.dorNota >= 0 && o.dorNota <= 10) cor.dorNota = Math.ceil(o.dorNota);
      return Object.keys(cor).length ? { ok: true, aplicar: (s) => aplicarCorrecao(c, s, cor) } : { ok: false };
    }
    default:
      return { ok: false };
  }
}

/**
 * Um passo da conversa. `nlu` é opcional: só vem quando o leitor determinístico não entendeu
 * e o servidor conseguiu falar com a IA. `iaIndisponivel` liga as reperguntas mais simples.
 */
export function passo(
  c: Contexto,
  estadoAnterior: Estado,
  entrada: Entrada,
  opcoes: { nlu?: RespostaNlu; iaIndisponivel?: boolean } = {},
): Saida {
  const e = clonar(estadoAnterior);
  if (opcoes.iaIndisponivel) e.iaIndisponivel = true;
  const mensagens: MensagemLevia[] = [];

  if (e.etapa.k === "emergencia") {
    if (entrada.tipo === "texto" && /recome[cç]ar/i.test(entrada.texto)) return iniciar(c);
    return { estado: e, mensagens: [msg(c, "emergencia.recomecar")] };
  }
  if (e.etapa.k === "pronto") return { estado: e, mensagens: [] };

  // Mapa do corpo: só vale na pergunta de região.
  if (entrada.tipo === "mapa") {
    const regs = entrada.regioes.filter((r) => (REGIOES as readonly string[]).includes(r));
    if (e.etapa.k === "regiao" && regs.length) {
      definirRegioes(c, e, regs);
      return avancar(c, e, mensagens);
    }
    if (e.etapa.k === "correcao" || e.etapa.k === "confirmacao") {
      aplicarCorrecao(c, e, { regioes: regs });
      return avancar(c, e, mensagens, true);
    }
    return { estado: e, mensagens: perguntaAtual(c, e) };
  }

  const t = entrada.texto;

  // 1. Emergência fora do escopo: interrompe tudo.
  const emg = detectarEmergencia(t);
  if (emg) {
    e.etapa = { k: "emergencia" };
    e.fila = [];
    return {
      estado: e,
      emergencia: emg,
      mensagens: [
        {
          tipo: "emergencia",
          motivo: emg,
          texto: tx(c.textos, `emergencia.${emg}`),
          telefones: emg === "autolesao" ? ["188", "192"] : ["192"],
        },
      ],
    };
  }

  // 2. Guardrails (diagnóstico, remédio, indicação...). Resposta fixa; a conversa segue.
  const g = detectarGuardrail(t);
  if (g) mensagens.push(msg(c, TEXTO_GUARDRAIL[g]));

  // 3. Alerta escondido: qualquer menção vira pergunta fechada, mesmo já respondida.
  const mencionados = new Set<Achado>(mencoes(t).positivos);
  for (const m of opcoes.nlu?.mencoes_alerta ?? []) if ((ACHADOS as readonly string[]).includes(m)) mencionados.add(m as Achado);
  const etapaAtual = e.etapa;
  const doGrupoAtual = new Set(etapaAtual.k === "alerta" ? e.grupos[etapaAtual.grupo]!.itens.map((i) => i.achado) : []);
  const filaAtual = e.fila[0]?.achado;

  // 4. Leitura da resposta: primeiro o leitor determinístico, depois a NLU.
  let leitura = lerLocal(c, e, t);
  if (!leitura.ok && opcoes.nlu) leitura = lerNlu(c, e, opcoes.nlu);

  const novasMencoes = [...mencionados].filter((a) => !doGrupoAtual.has(a) && a !== filaAtual);
  const aplicarMencoes = (s: Estado) => {
    if (novasMencoes.length) {
      const antes = s.fila.length;
      for (const a of novasMencoes) enfileirar(s, a, c);
      if (s.fila.length > antes) mensagens.push(msg(c, "alerta.mencao"));
    }
  };

  if (!leitura.ok) {
    // Pergunta fechada de alerta sem resposta clara: repergunta uma vez; na segunda, conta como presente (D1).
    const f = e.fila[0];
    if (f) {
      if (f.tentativas >= 1) {
        e.achados[f.achado] = true;
        e.fila.shift();
        aplicarMencoes(e);
        return avancar(c, e, mensagens, false, true);
      }
      f.tentativas += 1;
      aplicarMencoes(e);
      e.perguntasFeitas += 1;
      return { estado: e, mensagens: [...mensagens, ...perguntaAtual(c, e, true)] };
    }
    aplicarMencoes(e);
    if (e.fila.length) {
      e.perguntasFeitas += 1;
      return { estado: e, mensagens: [...mensagens, ...perguntaAtual(c, e)] };
    }
    if (g) {
      // Era só um pedido fora do roteiro: repete a pergunta, sem contar como erro.
      return { estado: e, mensagens: [...mensagens, ...perguntaAtual(c, e)] };
    }
    e.tentativas += 1;
    e.perguntasFeitas += 1;
    const extra = e.iaIndisponivel && e.tentativas === 1 ? [msg(c, "estado.ia_off")] : [];
    const base = e.tentativas >= 2 || e.iaIndisponivel ? [] : [msg(c, "nao_entendi")];
    return { estado: e, mensagens: [...mensagens, ...extra, ...base, ...perguntaAtual(c, e, true)] };
  }

  const tinhaFila = e.fila.length > 0;
  const etapaAntes = e.etapa.k;
  leitura.aplicar(e);
  aplicarMencoes(e);
  e.tentativas = 0;
  const veioDaCorrecao = etapaAntes === "correcao" || (etapaAntes === "confirmacao" && e.etapa.k === "confirmacao");
  if (veioDaCorrecao) mensagens.push(msg(c, "confirmacao.corrigido"));
  return avancar(c, e, mensagens, veioDaCorrecao, tinhaFila);
}

function avancar(c: Contexto, e: Estado, mensagens: MensagemLevia[], manterEtapa = false, veioDaFila = false): Saida {
  // Ainda há perguntas fechadas na fila: elas vêm antes de seguir o roteiro.
  if (e.fila.length) {
    e.perguntasFeitas += 1;
    return { estado: e, mensagens: [...mensagens, ...perguntaAtual(c, e)] };
  }
  if (e.etapa.k === "pronto") {
    return { estado: e, mensagens, confirmado: confirmar(e) };
  }
  if (e.etapa.k === "correcao") {
    e.perguntasFeitas += 1;
    return { estado: e, mensagens: [...mensagens, ...perguntaAtual(c, e)] };
  }
  // Depois de uma pergunta fechada, volta para a etapa em que estava (sem avançar de novo),
  // a não ser que essa etapa já tenha sido respondida.
  const antes = e.etapa.k;
  if (!manterEtapa && !(veioDaFila && !etapaRespondida(e))) e.etapa = proximaEtapa(e);
  const depois = e.etapa as Etapa;
  if (antes !== "startback" && depois.k === "startback" && depois.item === 0) mensagens.push(msg(c, "startback.intro"));
  e.perguntasFeitas += 1;
  return { estado: e, mensagens: [...mensagens, ...perguntaAtual(c, e)] };
}

/** A etapa atual já tem resposta? (usado ao voltar de uma pergunta fechada) */
function etapaRespondida(e: Estado): boolean {
  const et = e.etapa;
  switch (et.k) {
    case "regiao":
      return e.regioes.length > 0;
    case "duracao":
      return e.duracaoDias !== undefined;
    case "nota":
    case "chk_nota":
      return e.dorNota !== undefined;
    case "alerta":
      return e.grupos[et.grupo]!.itens.every((i) => e.achados[i.achado] !== undefined);
    case "startback":
      return e.startBack[et.item] !== undefined;
    case "chk_trabalho":
      return e.limitaTrabalho !== undefined;
    case "chk_recuperado":
      return e.recuperado !== undefined;
    case "confirmacao":
    case "correcao":
      return false;
    default:
      return true;
  }
}

function confirmar(e: Estado): Saida["confirmado"] {
  if (e.modo === "checagem") {
    const ch: Checagem = {
      semana: e.semana ?? 1,
      nota: e.dorNota ?? 10,
      limitaTrabalho: e.limitaTrabalho ?? true,
      achados: { ...e.achados },
    };
    if (e.semana === 6) ch.recuperado = e.recuperado === true;
    return { tipo: "checagem", checagem: ch };
  }
  return {
    tipo: "autoanamnese",
    respostas: {
      regioes: e.regioes,
      duracaoDias: e.duracaoDias ?? 9999,
      dorNota: e.dorNota ?? 10,
      achados: { ...e.achados },
      startBack: Array.from({ length: 9 }, (_, i) => (e.startBack[i] === 0 ? 0 : 1)),
    },
  };
}
