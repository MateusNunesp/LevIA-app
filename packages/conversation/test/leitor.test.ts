import { describe, expect, it } from "vitest";
import { lerConcordancia, lerDuracao, lerGrupo, lerIncomodo, lerNota, lerRegioes, lerSimNao } from "../src/leitor.ts";

describe("duração", () => {
  it.each([
    ["há 3 dias", 3], ["uns 3 dias", 3], ["três dias", 3], ["faz uma semana", 7], ["2 semanas", 14],
    ["duas semanas", 14], ["um mês", 30], ["ontem", 1], ["hoje", 0], ["desde hoje cedo, umas horas", 0],
    ["2 ou 3 semanas", 21], ["mais de um mês", 31], ["vinte e cinco dias", 25], ["3 dais", 3], ["1 semanna", 7],
    ["faz um ano", 365], ["semana passada", 7], ["uma semana e meia", 7],
  ])("%s -> %i", (t, d) => expect(lerDuracao(t)).toBe(d));
  it.each(["faz tempo", "sei lá", "muito"])("%s -> não entendeu", (t) => expect(lerDuracao(t)).toBeNull());
});

describe("nota", () => {
  it.each([["4", 4], ["quatro", 4], ["nota 7", 7], ["uns 5", 5], ["4/10", 4], ["entre 4 e 5", 5], ["10", 10], ["zero", 0], ["sem dor", 0], ["6 de 10", 6], ["seis", 6]])(
    "%s -> %i", (t, n) => expect(lerNota(t)).toBe(n),
  );
  it.each(["15", "muito", "dói bastante"])("%s -> não entendeu", (t) => expect(lerNota(t)).toBeNull());
});

describe("sim/não", () => {
  it.each([["sim", "sim"], ["Sim!", "sim"], ["siiim", "sim"], ["isso", "sim"], ["tá certo", "sim"], ["não", "nao"], ["nao", "nao"], ["naum", "nao"], ["nenhuma", "nao"], ["acho que não", "incerto"], ["acho que sim", "sim"], ["talvez", "incerto"], ["não sei", "incerto"]])(
    "%s -> %s", (t, r) => expect(lerSimNao(t)).toBe(r),
  );
});

describe("grupo de alerta", () => {
  const itens = ["urina", "sela", "forca_pernas"] as const;
  it("nenhuma -> todos ausentes", () => expect(lerGrupo("nenhuma", itens)).toEqual({ presentes: [], ausentes: [...itens], duvida: [] }));
  it("não tenho nada disso -> todos ausentes", () => expect(lerGrupo("não tenho nada disso", itens)?.ausentes.length).toBe(3));
  it("cita um -> presente", () => expect(lerGrupo("tenho dormência na virilha", itens)?.presentes).toEqual(["sela"]));
  it("'sim' sozinho -> repergunta um por vez", () => expect(lerGrupo("sim", itens)?.duvida).toEqual([...itens]));
  it("'acho que não' -> repergunta um por vez", () => expect(lerGrupo("acho que não", itens)?.duvida).toEqual([...itens]));
  it("nega só um -> pergunta os outros", () => expect(lerGrupo("não tenho fraqueza nas pernas", itens)).toEqual({ presentes: [], ausentes: ["forca_pernas"], duvida: ["urina", "sela"] }));
  it("texto sem sentido -> null (vai para a NLU)", () => expect(lerGrupo("hmm deixa eu ver", itens)).toBeNull());
});

describe("STarT Back", () => {
  it.each([["concordo", 1], ["discordo", 0], ["sim", 1], ["não", 0], ["não concordo", 0], ["concordo sim", 1], ["concrdo", 1], ["discordo totalmente", 0]])(
    "%s -> %s", (t, v) => expect(lerConcordancia(t)).toBe(v),
  );
  it.each([["nada", 0], ["um pouco", 0], ["muito pouco", 0], ["moderado", 0], ["muito", 1], ["extremamente", 1], ["demais", 1]])(
    "%s -> %i", (t, v) => expect(lerIncomodo(t)).toBe(v),
  );
});

describe("regiões", () => {
  it.each([
    ["lombar", ["lombar"]], ["dor nas costas", ["lombar"]], ["meio das costas", ["costas_alta"]], ["pescoço e ombro", ["pescoco", "ombros"]],
    ["no punho", ["punhos_maos"]], ["joelho", ["joelhos"]], ["pescoso", ["pescoco"]], ["lombra", ["lombar"]],
  ])("%s -> %j", (t, r) => expect(lerRegioes(t)).toEqual(r));
  it("'mais ou menos' não vira mãos", () => expect(lerRegioes("mais ou menos")).toEqual([]));
});
