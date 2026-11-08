// Motor da árvore de decisão da LevIA. PURO: sem IO, sem IA, sem relógio.
// triage(respostas_confirmadas, historico, regras, hoje) -> resultado
// Mesma entrada -> mesma saída, sempre (M11).
import type {
  Achado,
  Arvore,
  Checagem,
  Condicao,
  Historico,
  Ref,
  Regra,
  RespostasConfirmadas,
  RiscoStart,
  StartBackResultado,
  TriageResult,
} from "@levia/shared";
import { diasEntre } from "@levia/shared";

export { calcularStartBack } from "./startback.ts";
import { calcularStartBack } from "./startback.ts";

const HISTORICO_VAZIO: Historico = { checagens: [], episodiosAnteriores: [] };

export function resolverRef(ref: Ref, cortes: Record<string, unknown>): number | boolean | string {
  if (typeof ref !== "string" || !ref.startsWith("$cortes.")) return ref;
  const caminho = ref.slice("$cortes.".length).split(".");
  let atual: unknown = cortes;
  for (const parte of caminho) {
    if (atual && typeof atual === "object" && parte in (atual as Record<string, unknown>)) {
      atual = (atual as Record<string, unknown>)[parte];
    } else {
      throw new Error(`corte inexistente: ${ref}`);
    }
  }
  if (typeof atual === "number" || typeof atual === "boolean" || typeof atual === "string") return atual;
  if (Array.isArray(atual)) return atual.join(",");
  throw new Error(`corte com tipo inválido: ${ref}`);
}

function num(ref: Ref, cortes: Record<string, unknown>): number {
  const v = resolverRef(ref, cortes);
  if (typeof v !== "number") throw new Error(`corte não numérico: ${String(ref)}`);
  return v;
}

interface Contexto {
  respostas: RespostasConfirmadas;
  historico: Historico;
  achados: Set<Achado>;
  notaAtual: number;
  startBack: StartBackResultado;
  crises12m: number;
  cortes: Record<string, unknown>;
  regioesSaida1: readonly string[];
}

function checagemDa(ctx: Contexto, semana: number): Checagem | undefined {
  // a mais recente daquela semana
  const lista = ctx.historico.checagens.filter((c) => c.semana === semana);
  return lista[lista.length - 1];
}

function avaliar(c: Condicao, ctx: Contexto): boolean {
  const { cortes } = ctx;
  const testes: boolean[] = [];
  if (c.sempre) testes.push(true);
  if (c.qualquer) testes.push(c.qualquer.some((a) => ctx.achados.has(a)));
  if (c.regiao_em) testes.push(ctx.respostas.regioes.some((r) => c.regiao_em!.includes(r)));
  if (c.regioes_todas_em) {
    const lista = c.regioes_todas_em === "$regioes_saida1" ? ctx.regioesSaida1 : c.regioes_todas_em;
    testes.push(ctx.respostas.regioes.length > 0 && ctx.respostas.regioes.every((r) => lista.includes(r)));
  }
  if (c.dor_nota_gte !== undefined) testes.push(ctx.notaAtual >= num(c.dor_nota_gte, cortes));
  if (c.dor_nota_lte !== undefined) testes.push(ctx.notaAtual <= num(c.dor_nota_lte, cortes));
  if (c.dias_lte !== undefined) testes.push(ctx.respostas.duracaoDias <= num(c.dias_lte, cortes));
  if (c.start_back_em !== undefined) {
    const lista: string[] =
      typeof c.start_back_em === "string"
        ? String(resolverRef(c.start_back_em, cortes)).split(",")
        : c.start_back_em;
    testes.push(lista.includes(ctx.startBack.risco));
  }
  if (c.crises_12m_gte !== undefined) testes.push(ctx.crises12m >= num(c.crises_12m_gte, cortes));
  if (c.checagem_piorou) {
    const ch = checagemDa(ctx, c.checagem_piorou.semana);
    testes.push(!!ch && ch.nota > ctx.respostas.dorNota);
  }
  if (c.checagem_queda_insuficiente) {
    const p = c.checagem_queda_insuficiente;
    const ch = checagemDa(ctx, p.semana);
    if (!ch) testes.push(false);
    else {
      const inicial = ctx.respostas.dorNota;
      const queda = inicial - ch.nota;
      const pct = inicial > 0 ? (queda / inicial) * 100 : 100;
      // passa se caiu pelo menos N pontos OU pelo menos X% (D3)
      const melhorou = queda >= num(p.pontos, cortes) || pct >= num(p.pct, cortes);
      testes.push(!melhorou);
    }
  }
  if (c.checagem_dor_gt) {
    const ch = checagemDa(ctx, c.checagem_dor_gt.semana);
    testes.push(!!ch && ch.nota > num(c.checagem_dor_gt.valor, cortes));
  }
  if (c.checagem_limita_trabalho) {
    const ch = checagemDa(ctx, c.checagem_limita_trabalho.semana);
    testes.push(!!ch && ch.limitaTrabalho);
  }
  if (c.checagem_nao_recuperado) {
    const ch = checagemDa(ctx, c.checagem_nao_recuperado.semana);
    testes.push(!!ch && ch.recuperado !== true);
  }
  // Condição vazia nunca casa (só "sempre" casa sem testes).
  return testes.length > 0 && testes.every(Boolean);
}

function regraHabilitada(r: Regra, cortes: Record<string, unknown>): boolean {
  if (r.habilitada === undefined) return true;
  return resolverRef(r.habilitada, cortes) === true;
}

export function triage(
  respostas: RespostasConfirmadas,
  historico: Historico | undefined,
  arvore: Arvore,
  hoje: string,
): TriageResult {
  const hist = historico ?? HISTORICO_VAZIO;
  const achados = new Set<Achado>();
  for (const [k, v] of Object.entries(respostas.achados)) if (v) achados.add(k as Achado);
  for (const ch of hist.checagens) for (const [k, v] of Object.entries(ch.achados)) if (v) achados.add(k as Achado);

  const ultima = hist.checagens[hist.checagens.length - 1];
  const notaAtual = ultima ? ultima.nota : respostas.dorNota;

  const anteriores = hist.episodiosAnteriores.filter((e) => {
    const d = diasEntre(e.inicio, hoje);
    return d >= 0 && d <= 365 && e.regioes.some((r) => respostas.regioes.includes(r));
  }).length;

  const ctx: Contexto = {
    respostas,
    historico: hist,
    achados,
    notaAtual,
    startBack: calcularStartBack(respostas.startBack),
    crises12m: anteriores + 1,
    cortes: arvore.cortes,
    regioesSaida1: arvore.regioes_saida1,
  };

  // A primeira regra que casar decide. As de alerta vêm primeiro no arquivo,
  // e o carregador recusa um arquivo que não termine com a regra "sempre" (D1).
  // regrasDisparadas: a regra que decidiu, seguida das outras que casaram e levam à mesma saída.
  const disparadas: string[] = [];
  let escolhida: Regra | undefined;
  for (const r of arvore.regras) {
    if (!regraHabilitada(r, arvore.cortes)) continue;
    if (escolhida && r.saida !== escolhida.saida) continue;
    if (avaliar(r.quando, ctx)) {
      if (!escolhida) escolhida = r;
      if (r.id !== "S2-SEM-REGRA" || disparadas.length === 0) disparadas.push(r.id);
    }
  }
  if (!escolhida) {
    // Defesa extra: sem regra -> saída 2 (D1).
    escolhida = { id: "S2-SEM-REGRA", quando: { sempre: true }, saida: 2, porque: "porque.saida2.sem_regra" };
    disparadas.push(escolhida.id);
  }

  const urgente = escolhida.saida === 3 && escolhida.urgente_hoje === true;
  return {
    saida: escolhida.saida,
    urgenteHoje: urgente,
    regrasDisparadas: disparadas,
    porque: escolhida.porque,
    versaoRegras: arvore.versaoRegras,
    exerciciosPermitidos: escolhida.saida === 1,
    startBack: ctx.startBack,
    emergencia: escolhida.emergencia === true,
  };
}

/** Ordem de cuidado: usada nos testes de monotonicidade. */
export function nivelCuidado(r: Pick<TriageResult, "saida" | "urgenteHoje">): number {
  return r.saida * 2 + (r.urgenteHoje ? 1 : 0);
}

export type { RiscoStart };
