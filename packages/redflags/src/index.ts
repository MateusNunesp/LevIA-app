// Detector determinístico de menções a sinais de alerta e a emergências.
// Roda em TODO texto livre. Uma menção não marca o sinal como presente: ela faz
// a conversa perguntar a pergunta fechada correspondente na hora ("alerta escondido").
// Emergências fora do escopo (peito + falta de ar/suor, AVC, autolesão) interrompem o fluxo.
import type { Achado } from "@levia/shared";
import { normalizarTexto } from "@levia/shared";

/** Expressões já normalizadas (minúsculas, sem acento). Regex com limites de palavra. */
export const EXPRESSOES: Record<Achado, string[]> = {
  urina: [
    "xixi", "urina\\w*", "urinar", "mijar", "bexiga", "coco", "evacua\\w*", "fezes", "intestino",
    "fazer numero (1|2|um|dois)", "segurar o xixi", "escapando xixi", "perdi o controle",
  ],
  sela: ["virilha\\w*", "entre as pernas", "em sela", "sela", "regiao intima", "parte intima", "genita\\w*", "bumbum dormente"],
  forca_pernas: [
    "fraqueza nas? pernas?", "pernas? fracas?", "perdi (a )?forca", "perda de forca", "perdendo (a )?forca",
    "sem forca nas? pernas?", "pernas? bambas?", "pernas? falhando", "perna fraqueja\\w*", "fraqueza",
  ],
  noturna: [
    "dor (a|de) noite", "doi (a|de) noite", "piora (a|de) noite", "forte (a|de) noite", "noite toda", "noite inteira",
    "madrugada", "nao consigo dormir", "acordo (de|com) dor", "a noite", "de noite", "noturna",
  ],
  corticoide: ["corticoide\\w*", "cortisona", "prednisona", "dexametasona", "osteoporose", "osso fraco", "ossos fracos"],
  cancer: ["cancer", "tumor\\w*", "quimio\\w*", "radioterapia", "metastase\\w*"],
  peso: ["perdi peso", "perda de peso", "perdendo peso", "emagreci\\w*", "emagrecendo", "emagrecer sem"],
  febre: ["febre\\w*", "febril", "calafrio\\w*", "temperatura alta"],
  bracos_ambos: [
    "dois bracos", "ambos os bracos", "os bracos (dormentes|fracos|formigando)", "bracos dormentes", "bracos fracos",
    "bracos formigando", "formigamento nos bracos",
  ],
  equilibrio_maos: [
    "equilibrio", "desequilibr\\w*", "cambalea\\w*", "maos desajeitadas", "mao desajeitada", "deixo cair as coisas",
    "derrubando as coisas", "derrubo as coisas", "tropeca\\w*",
  ],
  neuro_central: [
    "tontura\\w*", "tonto", "tonta", "visao dupla", "vendo dobrado", "vista dupla", "fala enrolada", "enrolando a fala",
    "dificuldade (para|pra) engolir", "engolir", "engasga\\w*",
  ],
  peito: ["peito", "aperto no peito", "falta de ar", "sem ar", "suor frio", "suando frio", "mandibula", "queixo doendo"],
  trauma: [
    "queda", "cai", "caiu", "levei um tombo", "tombo", "batida\\w*", "bati", "pancada", "acidente", "escorreguei",
    "trombada", "atropela\\w*", "porrada",
  ],
  piora_rapida: [
    "piorando rapido", "piora rapido", "piorou rapido", "piorou muito", "piorando muito", "cada vez pior", "so piora",
    "piorando a cada",
  ],
  nao_mexe: [
    "nao consigo (mexer|apoiar|andar|pisar|levantar|virar|dobrar)", "nao da (pra|para) (mexer|apoiar|andar|pisar)",
    "travad[oa]", "travei", "nao mexe", "nao apoia", "sem conseguir (mexer|apoiar|andar)",
  ],
};

const NEGADORES = /(^|\s)(nao|nem|sem|nunca|nenhum|nenhuma)(\s|$)/;

function compilar(lista: string[]): RegExp[] {
  return lista.map((e) => new RegExp(`(^|[^a-z0-9])(${e})(?=$|[^a-z0-9])`, "g"));
}
const COMPILADO = Object.fromEntries(
  Object.entries(EXPRESSOES).map(([k, v]) => [k, compilar(v)]),
) as Record<Achado, RegExp[]>;

/** "não consigo segurar", "não sinto a perna": a negação faz parte do sintoma. */
const NEGACAO_DE_SINTOMA = /\b(nao|nem) (consigo|consegue|conseguia|seguro|segura|segurar|controlo|controla|aguento|aguenta|sinto (a|as|o|os|minha|minhas|meu|meus)|mexo|mexe|paro de)\b/g;

/** A menção está negada se um negador aparece logo antes na mesma oração, ou logo depois ("febre não"). */
function negada(t: string, inicio: number, fim?: number): boolean {
  const antes = t.slice(Math.max(0, inicio - 40), inicio).replace(NEGACAO_DE_SINTOMA, " ");
  const oracao = antes.split(/[,.;!?]|\bmas\b|\bporem\b|\be\s+tenho\b|\bso\b/).pop() ?? "";
  if (NEGADORES.test(oracao)) return true;
  if (fim !== undefined && /^\s+(nao|nunca)\s*($|,|\.|;|e\b|mas\b|tenho\b)/.test(t.slice(fim))) return true;
  return false;
}

export interface Mencoes {
  positivos: Achado[];
  negados: Achado[];
}

/** Lista os achados citados no texto, separando citação afirmativa de negada. */
export function mencoes(texto: string): Mencoes {
  const t = normalizarTexto(texto);
  const pos = new Set<Achado>();
  const neg = new Set<Achado>();
  for (const achado of Object.keys(COMPILADO) as Achado[]) {
    for (const re of COMPILADO[achado]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const ini = m.index + (m[1]?.length ?? 0);
        if (negada(t, ini, ini + (m[2]?.length ?? 0))) neg.add(achado);
        else pos.add(achado);
      }
    }
  }
  for (const a of pos) neg.delete(a);
  return { positivos: [...pos], negados: [...neg] };
}

export type Emergencia = "cardiaca" | "avc" | "autolesao";

const RE_CARDIACO_LOCAL = /(peito|braco esquerdo|mandibula)/;
const RE_CARDIACO_SINAL = /(falta de ar|sem ar|suor|suando|suado|suada|sufoca\w*)/;
const RE_AVC = /(\bavc\b|derrame|(rosto|boca|cara) (ficou |esta |ta )?(torta|torto|caida|caido)|fala enrolada|enrolando a fala|fraqueza (de|em|num|no) (um|1) lado|um lado do corpo (fraco|dormente|paralisado)|lado do corpo (fraco|dormente|paralisado))/;
const RE_AUTOLESAO = /(me matar|suicid\w*|tirar (a )?minha (propria )?vida|nao quero mais viver|quero morrer|me machucar de proposito|vontade de me machucar|acabar com (a minha vida|tudo)|me cortar|sumir do mundo)/;

/** Detecta emergência fora do escopo. Menção negada ("não tenho falta de ar") não conta. */
export function emergencia(texto: string): Emergencia | null {
  const t = normalizarTexto(texto);
  const afirmativo = (re: RegExp): boolean => {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(t))) if (!negada(t, m.index)) return true;
    return false;
  };
  if (afirmativo(RE_AUTOLESAO)) return "autolesao";
  if (afirmativo(RE_AVC)) return "avc";
  if (afirmativo(RE_CARDIACO_LOCAL) && afirmativo(RE_CARDIACO_SINAL)) return "cardiaca";
  return null;
}

/** Atalho: tudo o que o detector achou num texto livre. */
export function detectar(texto: string): { achados: Achado[]; emergencia: Emergencia | null } {
  return { achados: mencoes(texto).positivos, emergencia: emergencia(texto) };
}
