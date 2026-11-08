import { describe, expect, it } from "vitest";
import { detectar, emergencia, mencoes } from "../src/index.ts";

describe("menções a sinais de alerta (alerta escondido)", () => {
  it.each([
    ["perdi força na perna", "forca_pernas"],
    ["minha virilha está dormente", "sela"],
    ["não consigo segurar o xixi", "urina"],
    ["tô com febre desde ontem", "febre"],
    ["levei um tombo na escada", "trauma"],
    ["emagreci muito sem fazer dieta", "peso"],
    ["já fiz quimio", "cancer"],
    ["tomo prednisona faz anos", "corticoide"],
    ["os dois braços estão formigando", "bracos_ambos"],
    ["fico tonto e vendo dobrado", "neuro_central"],
    ["piora a noite toda", "noturna"],
    ["estou travado, não consigo mexer", "nao_mexe"],
  ])("%s -> %s", (t, a) => {
    expect(mencoes(t).positivos).toContain(a);
  });
  it("negação não conta como menção", () => {
    expect(mencoes("não tenho febre").positivos).not.toContain("febre");
    expect(mencoes("não tenho febre").negados).toContain("febre");
    expect(mencoes("sem dormência na virilha").positivos).not.toContain("sela");
  });
  it("afirmação depois de negação conta", () => {
    const m = mencoes("febre não, mas perdi peso");
    expect(m.positivos).toContain("peso");
    expect(m.negados).toContain("febre");
  });
  it("texto comum não dispara nada (M4)", () => {
    expect(detectar("dói quando fico muito tempo sentado no trabalho").achados).toEqual([]);
    expect(detectar("há uns 3 dias").achados).toEqual([]);
  });
});

describe("emergências fora do escopo", () => {
  it("peito + falta de ar", () => expect(emergencia("dor no peito e falta de ar")).toBe("cardiaca"));
  it("braço esquerdo + suor", () => expect(emergencia("dói o braço esquerdo e estou suando frio")).toBe("cardiaca"));
  it("peito sozinho não é emergência (vira pergunta fechada)", () => {
    expect(emergencia("dói um pouco no peito")).toBeNull();
    expect(mencoes("dói um pouco no peito").positivos).toContain("peito");
  });
  it("peito sem falta de ar (negado) não é emergência", () => expect(emergencia("dor no peito mas não tenho falta de ar")).toBeNull());
  it("AVC", () => {
    expect(emergencia("acordei com a boca torta")).toBe("avc");
    expect(emergencia("estou com a fala enrolada")).toBe("avc");
    expect(emergencia("fraqueza de um lado do corpo")).toBe("avc");
  });
  it("autolesão", () => {
    expect(emergencia("tenho vontade de me machucar")).toBe("autolesao");
    expect(emergencia("não quero mais viver")).toBe("autolesao");
    expect(emergencia("penso em suicídio")).toBe("autolesao");
  });
});
