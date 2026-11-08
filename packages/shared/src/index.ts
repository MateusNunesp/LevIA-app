// Tipos e utilitários puros compartilhados por todos os módulos da LevIA.
// Nada aqui faz IO, lê relógio ou chama IA.

export const REGIOES = [
  "pescoco",
  "ombros",
  "costas_alta",
  "lombar",
  "cotovelos",
  "punhos_maos",
  "quadril",
  "joelhos",
  "tornozelos_pes",
] as const;
export type Regiao = (typeof REGIOES)[number];

/** Achados que a pessoa pode relatar nas perguntas de alerta e de caso complexo. */
export const ACHADOS = [
  // coluna lombar
  "urina",
  "sela",
  "forca_pernas",
  "noturna",
  "corticoide",
  // sistêmicos
  "cancer",
  "peso",
  "febre",
  // pescoço
  "bracos_ambos",
  "equilibrio_maos",
  "neuro_central",
  // fora da coluna, emergência
  "peito",
  // mecânicos / caso complexo
  "trauma",
  "piora_rapida",
  "nao_mexe",
] as const;
export type Achado = (typeof ACHADOS)[number];

export type Saida = 1 | 2 | 3;
export type RiscoStart = "baixo" | "medio" | "alto";
export type Semana = 1 | 2 | 4 | 6;

export interface StartBackResultado {
  total: number;
  psicossocial: number;
  risco: RiscoStart;
}

export interface TriageResult {
  saida: Saida;
  urgenteHoje: boolean;
  regrasDisparadas: string[];
  porque: string;
  versaoRegras: string;
  exerciciosPermitidos: boolean;
  startBack: StartBackResultado;
  /** true quando a regra pede o cartão de emergência (SAMU 192). */
  emergencia: boolean;
}

/** Respostas já confirmadas pela pessoa. A árvore só roda sobre isto. */
export interface RespostasConfirmadas {
  regioes: Regiao[];
  duracaoDias: number;
  dorNota: number;
  /** Cada achado perguntado, com true (presente) ou false (ausente). Achado não perguntado = ausente. */
  achados: Partial<Record<Achado, boolean>>;
  /** 9 itens do STarT Back, 0 ou 1 cada, na ordem do instrumento. */
  startBack: number[];
}

export interface Checagem {
  semana: Semana;
  nota: number;
  limitaTrabalho: boolean;
  achados: Partial<Record<Achado, boolean>>;
  /** Só na semana 6: a pessoa se sente recuperada? */
  recuperado?: boolean;
}

export interface EpisodioAnterior {
  inicio: string; // AAAA-MM-DD
  regioes: Regiao[];
}

export interface Historico {
  checagens: Checagem[];
  episodiosAnteriores: EpisodioAnterior[];
}

// ---------- Regras (forma validada pelo @levia/content) ----------

export type Ref = number | boolean | string; // string = "$cortes.caminho"

export interface Condicao {
  qualquer?: Achado[];
  regiao_em?: Regiao[];
  /** Todas as regiões marcadas estão na lista. "$regioes_saida1" usa a lista da árvore. */
  regioes_todas_em?: Regiao[] | "$regioes_saida1";
  dor_nota_gte?: Ref;
  dor_nota_lte?: Ref;
  dias_lte?: Ref;
  start_back_em?: RiscoStart[] | string;
  crises_12m_gte?: Ref;
  checagem_piorou?: { semana: Semana };
  checagem_queda_insuficiente?: { semana: Semana; pontos: Ref; pct: Ref };
  checagem_dor_gt?: { semana: Semana; valor: Ref };
  checagem_limita_trabalho?: { semana: Semana };
  checagem_nao_recuperado?: { semana: Semana };
  /** sempre verdadeira; usada pela regra final (D1) */
  sempre?: true;
}

export interface Regra {
  id: string;
  quando: Condicao;
  saida: Saida;
  urgente_hoje?: boolean;
  emergencia?: boolean;
  porque: string;
  /** Liga/desliga a regra por um corte booleano (D3). */
  habilitada?: Ref;
}

export interface ItemAlerta {
  achado: Achado;
  /** Pergunta de sim ou não usada na repergunta, um sinal por vez. */
  pergunta_unica: string;
}

export interface PerguntaAlerta {
  id: string;
  regioes: Regiao[];
  sinal_de_alerta: true;
  texto: string;
  itens: ItemAlerta[];
}

export interface Arvore {
  versao: number;
  status_revisao: StatusRevisao;
  revisado_por: string | null;
  revisado_em: string | null;
  cortes: Record<string, unknown>;
  regioes_saida1: Regiao[];
  regioes_coluna: Regiao[];
  perguntas_alerta: PerguntaAlerta[];
  regras: Regra[];
  /** "arvore.v1@<hash>", calculado na carga */
  versaoRegras: string;
}

export type StatusRevisao = "precisa_de_revisao" | "revisado" | "aprovado";

// ---------- Mensagens que a LevIA manda (API ⇄ app) ----------

export type MensagemLevia =
  | { tipo: "texto"; textoId: string; texto: string }
  | { tipo: "cartao_mapa"; textoId: string; texto: string }
  | {
      tipo: "resultado";
      saida: Saida;
      urgenteHoje: boolean;
      titulo: string;
      texto: string;
      porque: string;
      episodioId: string;
    }
  | { tipo: "resumo"; episodioId: string; texto: string }
  | { tipo: "exercicio"; exercicioId: string; nome: string; passos: string[]; dose: string; quandoParar: string }
  | { tipo: "emergencia"; motivo: "cardiaca" | "avc" | "autolesao" | "alerta"; texto: string; telefones: string[] };

// ---------- Utilitários puros ----------

export function normalizarTexto(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/%,.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function diasEntre(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round((db - da) / 86_400_000);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(Date.parse(data + "T00:00:00Z") + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const NOME_REGIAO: Record<Regiao, string> = {
  pescoco: "pescoço",
  ombros: "ombros",
  costas_alta: "meio das costas",
  lombar: "lombar",
  cotovelos: "cotovelos",
  punhos_maos: "punhos e mãos",
  quadril: "quadril",
  joelhos: "joelhos",
  tornozelos_pes: "tornozelos e pés",
};

export class ErroLevia extends Error {
  constructor(
    public readonly codigo: string,
    message?: string,
  ) {
    super(message ?? codigo);
  }
}
