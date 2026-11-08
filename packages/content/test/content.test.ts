import { describe, expect, it } from "vitest";
import { carregarConteudo, pendenciasRevisao, preencher, validarCoerencia } from "../src/index.ts";

describe("conteúdo", () => {
  const c = carregarConteudo();
  it("carrega e valida árvore, catálogo e textos", () => {
    expect(c.arvore.regras.length).toBeGreaterThan(10);
    expect(c.catalogo.exercicios.length).toBeGreaterThanOrEqual(10);
    expect(c.catalogo.exercicios.length).toBeLessThanOrEqual(15);
  });
  it("tudo continua marcado como precisa_de_revisao (D5)", () => {
    expect(pendenciasRevisao(c)).toContain("content/arvore/arvore.v1.yaml");
  });
  it("recusa árvore sem a regra final 'sempre -> 2' (D1)", () => {
    expect(() => validarCoerencia({ ...c.arvore, regras: c.arvore.regras.slice(0, -1) }, c.catalogo, c.textos)).toThrow(/D1/);
  });
  it("recusa regra de alerta depois de regra comum (M1)", () => {
    const [primeira, ...resto] = c.arvore.regras;
    expect(() => validarCoerencia({ ...c.arvore, regras: [...resto.slice(0, -1), primeira!, resto[resto.length - 1]!] }, c.catalogo, c.textos)).toThrow(/M1/);
  });
  it("recusa texto inexistente", () => {
    const regras = c.arvore.regras.map((r, i) => (i === 0 ? { ...r, porque: "nao.existe" } : r));
    expect(() => validarCoerencia({ ...c.arvore, regras }, c.catalogo, c.textos)).toThrow(/texto ausente/);
  });
  it("template sem variável é erro, nunca mostra {x}", () => {
    expect(() => preencher("oi {nome}")).toThrow();
    expect(preencher("oi {nome}", { nome: "a" })).toBe("oi a");
  });
  it("todos os exercícios têm no máximo 6 passos e dose com máximo por dia", () => {
    for (const e of c.catalogo.exercicios) {
      expect(e.passos.length).toBeLessThanOrEqual(6);
      expect(e.dose.maximo_por_dia).toBeGreaterThan(0);
    }
  });
});
