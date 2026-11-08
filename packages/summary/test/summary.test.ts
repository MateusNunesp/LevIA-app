import { describe, expect, it } from "vitest";
import { resumoHtml } from "../src/index.ts";

describe("resumo", () => {
  const html = resumoHtml({
    data: "2026-11-08", regioes: ["lombar"], duracaoDias: 3, dorNota: 4,
    achadosPerguntados: [{ achado: "febre", nome: "febre", presente: false }, { achado: "sela", nome: "<b>dormência</b>", presente: true }],
    startBack: { total: 1, risco: "baixo" }, saida: 1, tituloSaida: "Dá para cuidar em casa", versaoRegras: "arvore.v1@x", avisoFixo: "Em emergência, ligue 192.",
  });
  it("contém data, região, nota e STarT", () => {
    expect(html).toContain("08/11/2026");
    expect(html).toContain("lombar");
    expect(html).toContain("risco baixo");
  });
  it("escapa HTML", () => expect(html).toContain("&lt;b&gt;dormência"));
  it("não tem diagnóstico", () => expect(html).toContain("Não é diagnóstico"));
});
