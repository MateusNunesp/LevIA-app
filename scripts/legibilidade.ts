// Mede a legibilidade de todos os textos de content/textos (M12).
// Índice de Flesch adaptado ao português (Martins et al., 1996):
//   IF = 248,835 − 1,015 × (palavras/frases) − 84,6 × (sílabas/palavras)
// Faixas usuais: 75–100 muito fácil (1º–5º ano); 50–75 fácil (6º–9º ano); 25–50 difícil; 0–25 muito difícil.
// Alvo "até 8º ano": IF >= 50 em cada texto. TODO(D5): confirmar o corte com a revisão.
import { carregarConteudo } from "@levia/content";

export const CORTE = 50;
/** O índice não é confiável em fragmentos curtos (rótulos, títulos): só medimos textos com 6+ palavras. */
export const MINIMO_PALAVRAS = 6;

export function silabas(palavra: string): number {
  const w = palavra.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  if (!w) return 0;
  // grupos de vogais; ditongos e tritongos comuns contam como uma sílaba
  const grupos = w.replace(/(qu|gu)(?=[aeiou])/g, "q").match(/[aeiouy]+/g) ?? [];
  let n = 0;
  for (const g of grupos) {
    if (g.length === 1) n += 1;
    else if (/^(ai|au|ei|eu|oi|ou|ui|iu|ae|ao|oe)$/.test(g)) n += 1;
    else n += Math.ceil(g.length / 2);
  }
  return Math.max(1, n);
}

export function flesch(texto: string): number {
  const limpo = texto.replace(/\{[a-z_]+\}/g, "algo").replace(/\d+/g, "dez");
  const frases = Math.max(1, (limpo.match(/[.!?]+(\s|$)/g) ?? []).length || 1);
  const palavras = limpo.split(/\s+/).filter((p) => /[a-zA-Zà-úÀ-Ú]/.test(p));
  if (!palavras.length) return 100;
  const sil = palavras.reduce((a, p) => a + silabas(p), 0);
  return 248.835 - 1.015 * (palavras.length / frases) - 84.6 * (sil / palavras.length);
}

const executado = process.argv[1]?.endsWith("legibilidade.ts");
if (executado) {
  const { textos } = carregarConteudo();
  const ruins: [string, number][] = [];
  let soma = 0;
  const entradas = Object.entries(textos.textos);
  let curtos = 0;
  let medidos = 0;
  for (const [id, t] of entradas) {
    if (id.startsWith("achado.") || t.split(/\s+/).length < MINIMO_PALAVRAS) {
      curtos++;
      continue;
    }
    medidos++;
    const f = flesch(t);
    soma += f;
    if (f < CORTE) ruins.push([id, Math.round(f)]);
  }
  process.stdout.write(`legibilidade: ${medidos} textos medidos (${curtos} curtos demais para medir), média ${Math.round(soma / Math.max(1, medidos))}, corte ${CORTE}\n`);
  for (const [id, f] of ruins) process.stdout.write(`  abaixo do corte: ${id} = ${f}\n`);
  if (ruins.length) process.exit(1);
}
