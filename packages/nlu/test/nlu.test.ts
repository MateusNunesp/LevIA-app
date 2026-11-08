import { describe, expect, it } from "vitest";
import { NluAnthropic, NluComCache, NluIndisponivel, NluMock, normalizarSaida } from "../src/index.ts";

const pedido = { perguntaId: "alerta_neuro_lombar", tipo: "grupo_alerta" as const, opcoes: ["urina", "sela", "forca_pernas"] };

describe("NLU", () => {
  it("saída fora do schema vira confiança baixa", () => {
    expect(normalizarSaida(pedido, { valor: ["inventado"], confianca: "alta", precisa_confirmar: false, mencoes_alerta: [] }).confianca).toBe("baixa");
  });
  it("concordância e incômodo viram 0/1", () => {
    expect(normalizarSaida({ perguntaId: "s1", tipo: "concordancia", opcoes: [] }, { valor: "concordo", confianca: "alta", precisa_confirmar: false, mencoes_alerta: [] }).valor).toBe(1);
    expect(normalizarSaida({ perguntaId: "s9", tipo: "incomodo", opcoes: [] }, { valor: "pouco", confianca: "alta", precisa_confirmar: false, mencoes_alerta: [] }).valor).toBe(0);
  });
  it("mock é determinístico e devolve baixa por padrão", async () => {
    const m = new NluMock();
    expect((await m.extrair(pedido, "qualquer coisa")).resposta.confianca).toBe("baixa");
  });
  it("cache da aplicação não chama a IA de novo para o mesmo texto normalizado", async () => {
    let chamadas = 0;
    const interno = { nome: "x", extrair: async () => { chamadas++; return { resposta: { valor: [], confianca: "alta" as const, precisa_confirmar: false, mencoes_alerta: [] }, uso: { tokensEntrada: 10, tokensSaida: 5, cacheHit: false, cacheAplicacao: false } }; } };
    const c = new NluComCache(interno);
    await c.extrair(pedido, "Não sei!");
    const r = await c.extrair(pedido, "nao sei");
    expect(chamadas).toBe(1);
    expect(r.uso.cacheAplicacao).toBe(true);
  });
  it("provider Anthropic: erro 429 vira NluIndisponivel (a triagem segue sem IA)", async () => {
    const falso = { messages: { parse: async () => { const { default: A } = await import("@anthropic-ai/sdk"); throw new A.RateLimitError(429, undefined, "rate", new Headers()); } } };
    const p = new NluAnthropic({ cliente: falso as never });
    await expect(p.extrair(pedido, "x")).rejects.toBeInstanceOf(NluIndisponivel);
  });
  it("provider Anthropic: stop_reason diferente de end_turn (ex.: recusa) vira baixa", async () => {
    const falso = { messages: { parse: async () => ({ stop_reason: "refusal", parsed_output: null, usage: { input_tokens: 5, output_tokens: 0 } }) } };
    const p = new NluAnthropic({ cliente: falso as never });
    expect((await p.extrair(pedido, "x")).resposta.confianca).toBe("baixa");
  });
  it("provider Anthropic: saída válida passa pelo schema", async () => {
    const falso = { messages: { parse: async () => ({ stop_reason: "end_turn", parsed_output: { valor: ["sela"], confianca: "alta", precisa_confirmar: false, mencoes_alerta: ["sela"] }, usage: { input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 400 } }) } };
    const r = await new NluAnthropic({ cliente: falso as never }).extrair(pedido, "x");
    expect(r.resposta.valor).toEqual(["sela"]);
    expect(r.uso).toMatchObject({ tokensEntrada: 450, tokensSaida: 10, cacheHit: true });
  });
});
