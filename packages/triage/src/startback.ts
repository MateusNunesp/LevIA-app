import type { StartBackResultado } from "@levia/shared";

/**
 * STarT Back (9 itens). Cada item vale 0 ou 1.
 * Total 0–3 = baixo; total >= 4 com subescala psicossocial (itens 5–9) <= 3 = médio; subescala >= 4 = alto.
 * Itens faltantes contam como 1 (D1: na dúvida, a saída mais cuidadosa).
 */
export function calcularStartBack(itens: readonly number[]): StartBackResultado {
  const v: number[] = Array.from({ length: 9 }, (_, i) => (itens[i] === 0 ? 0 : 1));
  const total = v.reduce((a, b) => a + b, 0);
  const psicossocial = v.slice(4).reduce((a, b) => a + b, 0);
  let risco: StartBackResultado["risco"] = "baixo";
  if (total >= 4) risco = psicossocial >= 4 ? "alto" : "medio";
  return { total, psicossocial, risco };
}
