import { describe, expect, it } from "vitest";
import { agregadosRh, CAMPOS_PERMITIDOS, csvNr1, K_MINIMO, type FatoEpisodio, type FonteRh } from "../src/index.ts";
import type { Regiao, Saida } from "@levia/shared";

/** Empresa de teste com setores pequenos, de propósito. */
function empresa(tamanhos: Record<string, number>, mes = "2026-10"): { fonte: FonteRh; eps: FatoEpisodio[] } {
  const setores = Object.keys(tamanhos).map((s) => ({ id: s, nome: `Setor ${s}` }));
  const eps: FatoEpisodio[] = [];
  let i = 0;
  for (const [s, n] of Object.entries(tamanhos))
    for (let k = 0; k < n; k++, i++)
      eps.push({ pessoa: `p${i}`, setorId: s, mes, regioes: [(["lombar", "pescoco", "ombros"] as Regiao[])[i % 3]!], saida: ((i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1) as Saida) });
  return { eps, fonte: { setores: () => setores, usos: () => eps, episodios: () => eps, ritmo: () => eps.map((e) => ({ ...e, constancia: 0.5 })) } };
}

describe("agregados do RH (M7)", () => {
  it("só os campos permitidos saem; nenhum id ou pseudônimo", () => {
    const { fonte } = empresa({ a: 15, b: 3 });
    const out = agregadosRh(fonte, "e1");
    for (const c of out) expect(Object.keys(c).sort()).toEqual([...CAMPOS_PERMITIDOS].sort());
    expect(JSON.stringify(out)).not.toMatch(/"p\d+"/);
  });
  it("célula com menos de 10 pessoas aparece como suprimida", () => {
    const { fonte } = empresa({ a: 15, b: 3 });
    const c = agregadosRh(fonte, "e1").find((x) => x.setor === "Setor b" && x.indicador === "pessoas_ativas")!;
    expect(c).toMatchObject({ valor: null, suprimido: true });
  });
  it("ataque por subtração falha: total − setores visíveis nunca revela grupo < 10", () => {
    for (const tamanhos of <Record<string, number>[]>[{ a: 15, b: 3 }, { a: 12, b: 11, c: 4 }, { a: 30, b: 1, c: 2 }, { a: 9, b: 9, c: 9 }, { a: 25, b: 10, c: 6, d: 14 }]) {
      const out = agregadosRh(empresa(tamanhos).fonte, "e1");
      const grupos = new Map<string, typeof out>();
      for (const c of out) {
        const k = `${c.mes}|${c.indicador}`;
        grupos.set(k, [...(grupos.get(k) ?? []), c]);
      }
      for (const [k, g] of grupos) {
        if (k.endsWith("ritmo_constancia_pct")) continue; // média, não soma
        const total = g.find((c) => c.setor === "Toda a empresa")!;
        const visiveis = g.filter((c) => c.setor !== "Toda a empresa" && !c.suprimido);
        const escondidas = g.filter((c) => c.setor !== "Toda a empresa" && c.suprimido);
        // nenhuma célula visível com valor 1..9
        for (const c of g) if (!c.suprimido && c.indicador !== "ritmo_constancia_pct") expect(c.valor === 0 || (c.valor ?? 0) >= K_MINIMO, `${k} ${c.setor}`).toBe(true);
        if (!total.suprimido && escondidas.length) {
          const resto = total.valor! - visiveis.reduce((a, c) => a + c.valor!, 0);
          expect(resto === 0 || resto >= K_MINIMO, `${JSON.stringify(tamanhos)} ${k} resto=${resto}`).toBe(true);
          // uma só célula escondida seria deduzida exatamente
          expect(escondidas.length).not.toBe(1);
        }
      }
    }
  });
  it("CSV do NR-1 traz rodapé e 'menos de 10'", () => {
    const csv = csvNr1(agregadosRh(empresa({ a: 15, b: 3 }).fonte, "e1"));
    expect(csv).toContain("menos de 10");
    expect(csv).toContain("Não substitui a avaliação ergonômica.");
    expect(csv).not.toMatch(/p\d+/);
  });
});
