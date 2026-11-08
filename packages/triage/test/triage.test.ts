import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ACHADOS, REGIOES, type Achado, type Regiao } from "@levia/shared";
import { calcularStartBack, nivelCuidado, triage } from "../src/index.ts";
import { arvore, base, HOJE } from "./helpers.ts";

const t = (r = base(), h?: Parameters<typeof triage>[1]) => triage(r, h, arvore, HOJE);

describe("vinheta por regra", () => {
  const urgentes: [string, Achado, Regiao][] = [
    ["RF-PEITO-EMERGENCIA", "peito", "ombros"],
    ["RF-CAUDA-EQUINA", "urina", "lombar"],
    ["RF-CAUDA-EQUINA", "sela", "lombar"],
    ["RF-CAUDA-EQUINA", "forca_pernas", "lombar"],
    ["RF-NEURO-CERVICAL", "bracos_ambos", "pescoco"],
    ["RF-NEURO-CERVICAL", "equilibrio_maos", "pescoco"],
    ["RF-NEURO-CERVICAL", "neuro_central", "pescoco"],
    ["RF-TRAUMA-COLUNA", "trauma", "lombar"],
    ["RF-SISTEMICO", "cancer", "lombar"],
    ["RF-SISTEMICO", "peso", "joelhos"],
    ["RF-SISTEMICO", "febre", "lombar"],
    ["RF-DOR-NOTURNA", "noturna", "lombar"],
    ["RF-FRATURA-FRAGILIDADE", "corticoide", "lombar"],
  ];
  for (const [regra, achado, regiao] of urgentes) {
    it(`${regra} (${achado}) -> saída 3 com vá hoje`, () => {
      const r = t(base({ regioes: [regiao], achados: { [achado]: true } }));
      expect(r.saida).toBe(3);
      expect(r.urgenteHoje).toBe(true);
      expect(r.regrasDisparadas[0]).toBe(regra);
      expect(r.exerciciosPermitidos).toBe(false);
    });
  }
  it("RF-PEITO pede o cartão de emergência", () => {
    expect(t(base({ regioes: ["ombros"], achados: { peito: true } })).emergencia).toBe(true);
  });
  it("CX-DOR-FORTE: nota 8 -> 3 sem urgência", () => {
    const r = t(base({ dorNota: 8 }));
    expect([r.saida, r.urgenteHoje, r.regrasDisparadas[0]]).toEqual([3, false, "CX-DOR-FORTE"]);
  });
  it("CX-TRAUMA fora da coluna -> 3 sem urgência", () => {
    const r = t(base({ regioes: ["joelhos"], achados: { trauma: true } }));
    expect([r.saida, r.urgenteHoje, r.regrasDisparadas[0]]).toEqual([3, false, "CX-TRAUMA"]);
  });
  it("CX-PIORA-RAPIDA e CX-NAO-MEXE -> 3", () => {
    expect(t(base({ achados: { piora_rapida: true } })).regrasDisparadas[0]).toBe("CX-PIORA-RAPIDA");
    expect(t(base({ achados: { nao_mexe: true } })).regrasDisparadas[0]).toBe("CX-NAO-MEXE");
  });
  it("S2-STARTBACK médio -> 2", () => {
    const r = t(base({ startBack: [1, 1, 1, 1, 0, 0, 0, 0, 0] }));
    expect([r.saida, r.regrasDisparadas[0], r.startBack.risco]).toEqual([2, "S2-STARTBACK", "medio"]);
  });
  it("S2-STARTBACK alto -> 2", () => {
    const r = t(base({ startBack: [0, 0, 0, 0, 1, 1, 1, 1, 0] }));
    expect([r.saida, r.startBack.risco]).toEqual([2, "alto"]);
  });
  it("S2-D3 semana 1 piorou", () => {
    const r = t(base(), { checagens: [{ semana: 1, nota: 5, limitaTrabalho: false, achados: {} }], episodiosAnteriores: [] });
    expect(r.regrasDisparadas[0]).toBe("S2-D3-SEMANA1-PIOROU");
  });
  it("S2-D3 semana 2: caiu 1 ponto de 4 (25%) -> 2; caiu 2 -> segue 1", () => {
    const h = (nota: number) => ({ checagens: [{ semana: 2 as const, nota, limitaTrabalho: false, achados: {} }], episodiosAnteriores: [] });
    expect(t(base(), h(3)).regrasDisparadas[0]).toBe("S2-D3-SEMANA2-SEM-QUEDA");
    expect(t(base(), h(2)).saida).toBe(1);
  });
  it("S2-D3 semana 2: 30% basta mesmo com queda < 2 pontos", () => {
    const h = { checagens: [{ semana: 2 as const, nota: 2, limitaTrabalho: false, achados: {} }], episodiosAnteriores: [] };
    expect(t(base({ dorNota: 3 }), h).saida).toBe(1);
  });
  it("S2-D3 semana 4: nota 4 -> 2; nota 3 -> 1; limita trabalho -> 2", () => {
    const h = (nota: number, lim = false) => ({ checagens: [{ semana: 4 as const, nota, limitaTrabalho: lim, achados: {} }], episodiosAnteriores: [] });
    expect(t(base({ dorNota: 6 }), h(4)).regrasDisparadas[0]).toBe("S2-D3-SEMANA4-DOR");
    expect(t(base({ dorNota: 6 }), h(3)).saida).toBe(1);
    expect(t(base({ dorNota: 6 }), h(2, true)).regrasDisparadas[0]).toBe("S2-D3-SEMANA4-TRABALHO");
  });
  it("S2-D3 semana 6: não recuperado -> 2", () => {
    const h = { checagens: [{ semana: 6 as const, nota: 1, limitaTrabalho: false, achados: {}, recuperado: false }], episodiosAnteriores: [] };
    expect(t(base(), h).regrasDisparadas[0]).toBe("S2-D3-SEMANA6");
  });
  it("checagem com sinal novo -> 3 com vá hoje", () => {
    const h = { checagens: [{ semana: 2 as const, nota: 1, limitaTrabalho: false, achados: { sela: true } }], episodiosAnteriores: [] };
    const r = t(base(), h);
    expect([r.saida, r.urgenteHoje]).toEqual([3, true]);
  });
  it("checagem com piora forte (nota 9) -> 3", () => {
    const h = { checagens: [{ semana: 1 as const, nota: 9, limitaTrabalho: true, achados: {} }], episodiosAnteriores: [] };
    expect(t(base(), h).regrasDisparadas[0]).toBe("CX-DOR-FORTE");
  });
  it("S2-RECORRENCIA: 3ª crise na mesma região em 12 meses", () => {
    const ep = (inicio: string, regioes: Regiao[] = ["lombar"]) => ({ inicio, regioes });
    expect(t(base(), { checagens: [], episodiosAnteriores: [ep("2026-03-01"), ep("2026-07-01")] }).regrasDisparadas[0]).toBe("S2-RECORRENCIA");
    expect(t(base(), { checagens: [], episodiosAnteriores: [ep("2025-03-01"), ep("2026-07-01")] }).saida).toBe(1);
    expect(t(base(), { checagens: [], episodiosAnteriores: [ep("2026-03-01", ["joelhos"]), ep("2026-07-01")] }).saida).toBe(1);
  });
  it("S1-AUTOCUIDADO: lombar leve e recente -> 1 com exercícios", () => {
    const r = t();
    expect([r.saida, r.urgenteHoje, r.exerciciosPermitidos, r.regrasDisparadas[0]]).toEqual([1, false, true, "S1-AUTOCUIDADO"]);
  });
  it("S2-SEM-REGRA: nota 7 (entre os cortes) -> 2", () => {
    expect(t(base({ dorNota: 7 })).regrasDisparadas[0]).toBe("S2-SEM-REGRA");
  });
  it("S2-SEM-REGRA: mais de 6 semanas -> 2", () => {
    expect(t(base({ duracaoDias: 43 })).saida).toBe(2);
    expect(t(base({ duracaoDias: 42 })).saida).toBe(1);
  });
  it("S2-SEM-REGRA: região sem catálogo (joelho) -> 2, nunca 1", () => {
    expect(t(base({ regioes: ["joelhos"] })).saida).toBe(2);
    expect(t(base({ regioes: ["lombar", "joelhos"] })).saida).toBe(2);
  });
  it("versão das regras vem com hash", () => {
    expect(t().versaoRegras).toMatch(/^arvore\.v1@[0-9a-f]{12}$/);
  });
});

describe("checagem extra (minha dor piorou, semana 0)", () => {
  const extra = (nota: number, achados = {}, limitaTrabalho = false) => ({
    checagens: [{ semana: 0 as const, nota, limitaTrabalho, achados }],
    episodiosAnteriores: [],
  });
  it("não dispara regras de semana da D3 (piora leve mantém a saída 1)", () => {
    const r = t(base({ dorNota: 3 }), extra(5, {}, true));
    expect(r.saida).toBe(1);
    expect(r.regrasDisparadas.some((x) => x.startsWith("S2-D3"))).toBe(false);
  });
  it("nota 7 sai da saída 1 pela regra existente (S1 exige nota <= 6)", () => {
    expect(t(base(), extra(7)).regrasDisparadas[0]).toBe("S2-SEM-REGRA");
  });
  it("nota 8 é caso complexo; sinal novo é saída 3 com vá hoje", () => {
    expect(t(base(), extra(8)).regrasDisparadas[0]).toBe("CX-DOR-FORTE");
    const r = t(base(), extra(4, { urina: true }));
    expect([r.saida, r.urgenteHoje]).toEqual([3, true]);
  });
});

describe("vinhetas do lab/c.html", () => {
  it("dor 4 -> saída 1", () => expect(t(base({ dorNota: 4 })).saida).toBe(1));
  it("dor 8 -> saída 3", () => expect(t(base({ dorNota: 8 })).saida).toBe(3));
  it("alerta escondido (dor 4 + perda de controle do xixi) -> 3 com vá hoje", () => {
    const r = t(base({ dorNota: 4, achados: { urina: true } }));
    expect([r.saida, r.urgenteHoje]).toEqual([3, true]);
  });
});

describe("STarT Back", () => {
  it.each([
    [[0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 0, "baixo"],
    [[1, 1, 1, 0, 0, 0, 0, 0, 0], 3, 0, "baixo"],
    [[1, 1, 1, 1, 0, 0, 0, 0, 0], 4, 0, "medio"],
    [[1, 1, 1, 1, 1, 1, 1, 0, 0], 7, 3, "medio"],
    [[0, 0, 0, 0, 1, 1, 1, 1, 0], 4, 4, "alto"],
    [[1, 1, 1, 1, 1, 1, 1, 1, 1], 9, 5, "alto"],
  ])("%j -> total %i, psico %i, %s", (itens, total, psico, risco) => {
    expect(calcularStartBack(itens)).toEqual({ total, psicossocial: psico, risco });
  });
  it("item faltante conta como 1 (D1)", () => {
    expect(calcularStartBack([0, 0, 0]).total).toBe(6);
  });
});

// ---------- propriedades ----------

const arbAchados = fc.dictionary(fc.constantFrom(...ACHADOS), fc.boolean()) as fc.Arbitrary<Partial<Record<Achado, boolean>>>;
const arbRespostas = fc.record({
  regioes: fc.uniqueArray(fc.constantFrom(...REGIOES), { minLength: 1, maxLength: 3 }),
  duracaoDias: fc.integer({ min: 0, max: 400 }),
  dorNota: fc.integer({ min: 0, max: 10 }),
  achados: arbAchados,
  startBack: fc.array(fc.integer({ min: 0, max: 1 }), { minLength: 9, maxLength: 9 }),
});

describe("propriedades", () => {
  it("determinismo (M11): mesma entrada -> mesma saída", () => {
    fc.assert(fc.property(arbRespostas, (r) => {
      expect(t(structuredClone(r))).toEqual(t(structuredClone(r)));
    }), { numRuns: 500 });
  });
  it("monotonicidade: acrescentar um sinal nunca leva a saída menos cuidadosa", () => {
    fc.assert(fc.property(arbRespostas, fc.constantFrom(...ACHADOS), (r, a) => {
      const antes = t(r);
      const depois = t({ ...r, achados: { ...r.achados, [a]: true } });
      expect(nivelCuidado(depois)).toBeGreaterThanOrEqual(nivelCuidado(antes));
    }), { numRuns: 1000 });
  });
  it("M1: qualquer sinal de alerta da coluna -> 3 com vá hoje, em qualquer combinação", () => {
    const alertas: Achado[] = ["urina", "sela", "forca_pernas", "noturna", "corticoide", "cancer", "peso", "febre", "bracos_ambos", "equilibrio_maos", "neuro_central", "peito"];
    fc.assert(fc.property(arbRespostas, fc.constantFrom(...alertas), (r, a) => {
      const res = t({ ...r, achados: { ...r.achados, [a]: true } });
      expect(res.saida).toBe(3);
      expect(res.urgenteHoje).toBe(true);
    }), { numRuns: 1000 });
  });
  it("urgenteHoje só com saída 3; exercícios só na saída 1", () => {
    fc.assert(fc.property(arbRespostas, (r) => {
      const res = t(r);
      if (res.urgenteHoje) expect(res.saida).toBe(3);
      expect(res.exerciciosPermitidos).toBe(res.saida === 1);
    }), { numRuns: 500 });
  });
  it("saída 1 só com nota <= 6, até 42 dias, STarT baixo e sem nenhum achado", () => {
    fc.assert(fc.property(arbRespostas, (r) => {
      const res = t(r);
      if (res.saida === 1) {
        expect(r.dorNota).toBeLessThanOrEqual(6);
        expect(r.duracaoDias).toBeLessThanOrEqual(42);
        expect(res.startBack.risco).toBe("baixo");
        expect(Object.values(r.achados).some(Boolean)).toBe(false);
      }
    }), { numRuns: 1000 });
  });
  it("sem regra -> 2: uma árvore só com a regra final dá sempre 2", () => {
    const vazia = { ...arvore, regras: arvore.regras.slice(-1) };
    fc.assert(fc.property(arbRespostas, (r) => {
      expect(triage(r, undefined, vazia, HOJE).saida).toBe(2);
    }), { numRuns: 200 });
    // e mesmo sem nenhuma regra, a defesa interna dá 2
    expect(triage(base(), undefined, { ...arvore, regras: [] }, HOJE).saida).toBe(2);
  });
});
