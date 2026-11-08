// Leitor determinístico das respostas escritas ou faladas.
// É a primeira tentativa de entender a pessoa (e a maior economia da M8).
// Se ele não entender, a conversa pede ajuda à NLU; se nada entender, repergunta mais simples.
import type { Achado, Regiao } from "@levia/shared";
import { normalizarTexto } from "@levia/shared";
import { mencoes } from "@levia/redflags";

// ---------- correção de erros de digitação ----------

const VOCAB = [
  "dia", "dias", "semana", "semanas", "mes", "meses", "ano", "anos", "hora", "horas", "ontem", "anteontem", "hoje",
  "zero", "um", "uma", "dois", "duas", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze",
  "treze", "quatorze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte", "trinta",
  "quarenta", "cinquenta", "sessenta",
  "lombar", "costas", "pescoco", "nuca", "ombro", "ombros", "cotovelo", "cotovelos", "punho", "punhos", "pulso", "pulsos",
  "mao", "maos", "dedos", "quadril", "joelho", "joelhos", "tornozelo", "tornozelos", "calcanhar",
  "sim", "nao", "nenhuma", "nenhum", "isso", "certo", "correto", "exato", "concordo", "discordo", "talvez",
  "nada", "pouco", "muito", "moderado", "medio", "extremamente", "demais", "bastante",
];
const VOCAB_SET = new Set(VOCAB);

/** Distância de edição com transposição (Damerau, versão OSA). */
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i]![0] = i;
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  return d[a.length]![b.length]!;
}

/** Palavras comuns que nunca são "corrigidas". */
const NAO_CORRIGIR = new Set([
  "mais", "menos", "muita", "pouca", "acho", "tenho", "estou", "esta", "isso", "essa", "agora", "antes", "depois",
  "quando", "porque", "sempre", "nunca", "coisa", "coisas", "forte", "fraco", "fraca", "perna", "pernas", "braco",
  "bracos", "cabeca", "barriga", "peito", "dores", "doendo", "doeu", "medico", "medica", "contas", "dados", "certa",
  "minha", "minhas", "nossa", "outro", "outra", "todos", "todas", "tambem", "ainda", "desde", "quase", "cinta",
]);
const APELIDOS: Record<string, string> = { dais: "dias", dis: "dias", diaa: "dia", smana: "semana", smanas: "semanas", semans: "semanas", mse: "mes", mezes: "meses", naum: "nao", nops: "nao", simm: "sim" };

/** Normaliza e corrige palavras com 1 erro (2 em palavras longas), só contra o vocabulário fixo. */
export function limpar(texto: string): string {
  const t = normalizarTexto(texto).replace(/[.,;!?]/g, " ");
  return t
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      if (w in APELIDOS) return APELIDOS[w]!;
      if (VOCAB_SET.has(w) || /\d/.test(w) || NAO_CORRIGIR.has(w)) return w;
      const r = w.replace(/(.)\1+/g, "$1"); // "siiim", "naaao"
      if (VOCAB_SET.has(r)) return r;
      if (w.length < 5) return w;
      const lim = w.length >= 7 ? 2 : 1;
      let melhor = w;
      let dMelhor = lim + 1;
      for (const v of VOCAB) {
        if (v.length < 5) continue;
        const dd = distancia(w, v);
        if (dd < dMelhor) {
          dMelhor = dd;
          melhor = v;
        }
      }
      return melhor;
    })
    .join(" ");
}

// ---------- números ----------

const UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60 };

/** Troca números por extenso por dígitos ("vinte e cinco" -> "25"). */
export function numerosPorExtenso(t: string): string {
  const palavras = t.split(" ");
  const out: string[] = [];
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i]!;
    if (w in DEZENAS) {
      let v = DEZENAS[w]!;
      if (palavras[i + 1] === "e" && palavras[i + 2]! in UNIDADES && UNIDADES[palavras[i + 2]!]! < 10) {
        v += UNIDADES[palavras[i + 2]!]!;
        i += 2;
      }
      out.push(String(v));
    } else if (w in UNIDADES) out.push(String(UNIDADES[w]));
    else out.push(w);
  }
  return out.join(" ");
}

// ---------- duração ----------

/** Lê há quanto tempo dói, em dias. Faixas ("2 ou 3 semanas") usam o maior valor (D1). */
export function lerDuracao(texto: string): number | null {
  let t = numerosPorExtenso(limpar(texto));
  t = t.replace(/\bmeia\b/g, "0.5").replace(/\bmeio\b/g, "0.5");
  if (/\b(hoje|agora|agorinha|horas?|minutos?|hj)\b/.test(t) && !/\b(dias?|semanas?|mes|meses|anos?)\b/.test(t)) return 0;
  if (/\banteontem\b/.test(t)) return 2;
  if (/\bontem\b/.test(t)) return 1;
  if (/\bsemana passada\b/.test(t)) return 7;
  if (/\bmes passado\b/.test(t)) return 30;
  if (/\bano passado\b/.test(t)) return 365;
  const fator = (u: string): number =>
    u.startsWith("dia") ? 1 : u.startsWith("semana") ? 7 : u.startsWith("mes") ? 30 : u.startsWith("ano") ? 365 : 0;
  const re = /(\d+(?:[.,]\d+)?)(?:\s*(?:ou|a|e|-)\s*(\d+(?:[.,]\d+)?))?\s*(?:e\s+(?:0\.5|meio|meia)\s+)?(dias?|semanas?|mes|meses|anos?)\b/g;
  let maior: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = parseFloat(m[1]!.replace(",", "."));
    const b = m[2] ? parseFloat(m[2].replace(",", ".")) : a;
    const v = Math.round(Math.max(a, b) * fator(m[3]!));
    maior = maior === null ? v : Math.max(maior, v);
  }
  if (maior !== null) {
    if (/\bmais de\b/.test(t)) maior += 1;
    return maior;
  }
  // "uma semana", "um mês" sem número: o 1 vem de "um/uma" já convertido; "semanas" sozinho é vago.
  return null;
}

// ---------- nota 0..10 ----------

export function lerNota(texto: string): number | null {
  let t = numerosPorExtenso(limpar(texto));
  if (/\bsem dor\b/.test(t) && !/\d/.test(t)) return 0;
  t = t.replace(/\b(\d+)\s*(\/|de|em)\s*10\b/g, "$1");
  const nums = [...t.matchAll(/(?<![\d.])(\d{1,2})(?:[.,](\d))?(?![\d])/g)].map((m) =>
    m[2] ? Math.ceil(parseFloat(`${m[1]}.${m[2]}`)) : parseInt(m[1]!, 10),
  );
  const validos = nums.filter((n) => n >= 0 && n <= 10);
  if (validos.length === 0 || validos.length !== nums.length) return null;
  // "entre 4 e 5": vale a maior (D1)
  return Math.max(...validos);
}

// ---------- sim / não ----------

export type SimNao = "sim" | "nao" | "incerto";

export function lerSimNao(texto: string): SimNao | null {
  const t = limpar(texto);
  if (!t) return null;
  if (/\b(acho que|talvez|nao sei|sei la|mais ou menos|as vezes|nao tenho certeza|pode ser|meio que|nao lembro|depende)\b/.test(t)) {
    if (/\bacho que sim\b/.test(t)) return "sim";
    return "incerto";
  }
  const neg = /^(n|nao|nao nao|nenhuma|nenhum|nada|nunca|negativo|nao tenho|nao sinto|de jeito nenhum|nem um pouco)\b/.test(t)
    || /^(nao|n)$/.test(t);
  const pos = /^(s|sim|isso|certo|correto|exato|exatamente|ta certo|esta certo|ta|aham|uhum|claro|positivo|tenho|sinto|ok|beleza|sim sim|e sim|com certeza|verdade)\b/.test(t);
  if (pos && !neg) return "sim";
  if (neg && !pos) return "nao";
  return null;
}

/** Resposta negativa total para um grupo de sinais ("nenhuma", "não tenho nada disso"). */
export function negativaTotal(texto: string): boolean {
  const t = limpar(texto);
  return /^(n|nao|nenhuma|nenhum|nada|nada disso|nenhuma delas|nenhum deles|nao tenho|nao tenho nada|nao tenho nenhuma|nao tenho nenhum|nao nenhuma|nao nada|nada nao|nenhuma nao|nenhum desses|nenhuma dessas|nao tenho nada disso|nao nenhuma delas|negativo|tudo bem|nao sinto nada disso)( disso| delas| deles| dessas| desses)?$/.test(
    t,
  );
}

export interface LeituraGrupo {
  presentes: Achado[];
  ausentes: Achado[];
  /** Itens que precisam ser reperguntados um por vez. */
  duvida: Achado[];
}

/** Lê a resposta a uma pergunta de alerta agrupada. null = não entendeu. */
export function lerGrupo(texto: string, itens: readonly Achado[]): LeituraGrupo | null {
  if (negativaTotal(texto)) return { presentes: [], ausentes: [...itens], duvida: [] };
  const sn = lerSimNao(texto);
  const m = mencoes(texto);
  const pos = itens.filter((a) => m.positivos.includes(a));
  const neg = itens.filter((a) => m.negados.includes(a));
  if (pos.length > 0) {
    // A pessoa disse quais tem. Os não citados contam como ausentes.
    return { presentes: pos, ausentes: itens.filter((a) => !pos.includes(a)), duvida: [] };
  }
  if (neg.length > 0) {
    const resto = itens.filter((a) => !neg.includes(a));
    return { presentes: [], ausentes: neg, duvida: resto };
  }
  // "sim", "tenho", "acho que não", "uma delas": ambíguo -> um por vez
  if (sn === "sim" || sn === "incerto") return { presentes: [], ausentes: [], duvida: [...itens] };
  return null;
}

// ---------- STarT Back ----------

export type Concordancia = 0 | 1 | "incerto";

export function lerConcordancia(texto: string): Concordancia | null {
  const t = limpar(texto);
  if (/\b(discordo|nao concordo|discordo totalmente)\b/.test(t)) return 0;
  if (/\b(concordo|concordo totalmente|e verdade|verdade)\b/.test(t)) return 1;
  const sn = lerSimNao(texto);
  if (sn === "sim") return 1;
  if (sn === "nao") return 0;
  if (sn === "incerto") return "incerto";
  return null;
}

/** Item 9: nada/pouco/moderado = 0; muito/extremamente = 1. */
export function lerIncomodo(texto: string): 0 | 1 | null {
  const t = limpar(texto);
  if (/\b(muito pouco|pouco|pouquinho|nada|nenhum|moderado|moderadamente|medio|mais ou menos|razoavel|um pouco)\b/.test(t)) return 0;
  if (/\b(muito|muitissimo|extremamente|demais|bastante|horrivel|insuportavel|extremo)\b/.test(t)) return 1;
  return null;
}

// ---------- regiões ----------

const REGIAO_EXPR: [RegExp, Regiao][] = [
  [/\b(meio das costas|costas alta|parte de cima das costas|alto das costas|entre os ombros|toracica|omoplata|escapula)\b/, "costas_alta"],
  [/\b(lombar|lombo|parte de baixo das costas|fim das costas|final das costas|cadeiras|costas|coluna|lumbago)\b/, "lombar"],
  [/\b(pescoco|nuca|cervical)\b/, "pescoco"],
  [/\b(ombros?)\b/, "ombros"],
  [/\b(cotovelos?)\b/, "cotovelos"],
  [/\b(punhos?|pulsos?|maos?|dedos?)\b/, "punhos_maos"],
  [/\b(quadril|bacia|anca)\b/, "quadril"],
  [/\b(joelhos?)\b/, "joelhos"],
  [/\b(tornozelos?|pes?|calcanhar|calcanhares)\b/, "tornozelos_pes"],
];

export function lerRegioes(texto: string): Regiao[] {
  let t = limpar(texto);
  const achadas: Regiao[] = [];
  for (const [re, reg] of REGIAO_EXPR) {
    if (re.test(t)) {
      if (!achadas.includes(reg)) achadas.push(reg);
      // "meio das costas" não deve também virar "lombar"
      t = t.replace(new RegExp(re.source, "g"), " ");
    }
  }
  return achadas;
}
