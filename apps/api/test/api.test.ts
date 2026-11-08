import { describe, expect, it } from "vitest";
import { montarTeste, novoId, START_BAIXO } from "./helpers.ts";
import { ROTAS_RH, zCelulaRh } from "../src/app.ts";
import { CAMPOS_PERMITIDOS } from "@levia/privacy";

type Ctx = ReturnType<typeof montarTeste>;

async function pessoa(ctx: Ctx, consentir = true) {
  const id = novoId();
  const h = { "x-levia-dispositivo": id };
  const r = await ctx.app.inject({ method: "POST", url: "/v1/dispositivos", payload: { id } });
  expect(r.statusCode).toBe(200);
  if (consentir) await ctx.app.inject({ method: "POST", url: "/v1/consentimentos", headers: h, payload: { tipo: "triagem", versao: 1 } });
  return { id, h };
}

async function conversar(ctx: Ctx, h: Record<string, string>, passos: (string | string[])[]) {
  const s = (await ctx.app.inject({ method: "POST", url: "/v1/sessoes", headers: h, payload: {} })).json();
  const todas = [...s.mensagens];
  let ultima: { mensagens: { tipo: string }[]; terminada: boolean } = { mensagens: [], terminada: false };
  for (const p of passos) {
    const payload = Array.isArray(p) ? { tipo: "mapa", regioes: p } : { tipo: "texto", texto: p };
    const r = await ctx.app.inject({ method: "POST", url: `/v1/sessoes/${s.id}/mensagens`, headers: h, payload });
    expect(r.statusCode, r.body).toBe(200);
    ultima = r.json();
    todas.push(...ultima.mensagens);
    if (ultima.terminada) break;
  }
  return { sessaoId: s.id as string, todas, ultima, primeira: s.mensagens[0] };
}

describe("API do funcionário", () => {
  it("sem consentimento da triagem, não conversa", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx, false);
    expect((await ctx.app.inject({ method: "POST", url: "/v1/sessoes", headers: h, payload: {} })).statusCode).toBe(403);
  });

  it("aparelho desconhecido é recusado", async () => {
    const ctx = montarTeste();
    const r = await ctx.app.inject({ method: "GET", url: "/v1/eu/plano", headers: { "x-levia-dispositivo": "nao-existe-1234567890" } });
    expect(r.statusCode).toBe(401);
  });

  it("conversa completa -> saída 1, plano do catálogo, registro e resumo", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    const c = await conversar(ctx, h, [["lombar"], "uns 3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    expect(c.primeira.tipo).toBe("cartao_mapa");
    const res = c.todas.find((m) => m.tipo === "resultado");
    expect(res).toMatchObject({ saida: 1, urgenteHoje: false });
    expect(c.todas.some((m) => m.tipo === "exercicio")).toBe(true);
    const plano = (await ctx.app.inject({ method: "GET", url: "/v1/eu/plano", headers: h })).json();
    expect(plano.status).toBe("ativo");
    const ex = plano.exercicios[0];
    const reg = await ctx.app.inject({ method: "POST", url: "/v1/eu/registros", headers: h, payload: { exercicioId: ex.id, dia: "2026-11-08", quantidade: 1 } });
    expect(reg.json()).toEqual({ aceito: true });
    const resumo = (await ctx.app.inject({ method: "GET", url: `/v1/eu/resumos/${res.episodioId}`, headers: h })).json();
    expect(resumo.html).toContain("Resumo da autoanamnese");
    // "por quê?" depois do resultado mostra a regra
    const pq = await ctx.app.inject({ method: "POST", url: `/v1/sessoes/${c.sessaoId}/mensagens`, headers: h, payload: { tipo: "texto", texto: "por quê?" } });
    expect(pq.json().mensagens[0].textoId).toBe("porque.saida1.autocuidado");
  });

  it("alerta escondido -> saída 3, vá hoje, plano antigo pausado e sem exercício (D4)", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    await conversar(ctx, h, [["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    const c = await conversar(ctx, h, [["lombar"], "uns três dias e não consigo segurar o xixi", "sim", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    const res = c.todas.find((m) => m.tipo === "resultado") as { saida: number; urgenteHoje: boolean; texto: string };
    expect([res.saida, res.urgenteHoje]).toEqual([3, true]);
    expect(res.texto).toContain("Vá hoje a um pronto atendimento.");
    expect(c.todas.some((m) => m.tipo === "exercicio")).toBe(false);
    const plano = (await ctx.app.inject({ method: "GET", url: "/v1/eu/plano", headers: h })).json();
    expect(plano.exercicios).toEqual([]);
    // o texto livre bruto não fica no banco
    const dump = JSON.stringify(ctx.db.$client.prepare("SELECT * FROM sessao").all()) + JSON.stringify(ctx.db.$client.prepare("SELECT * FROM episodio").all());
    expect(dump).not.toContain("xixi");
    expect(dump).not.toContain("lombar"); // cifrado em repouso
  });

  it("checagem da semana 2 sem melhora -> saída 2 e plano pausado", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    await conversar(ctx, h, [["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    ctx.relogio.atual = "2026-11-15";
    const s1 = (await ctx.app.inject({ method: "POST", url: "/v1/eu/checagens", headers: h })).json();
    for (const t of ["3", "não", "nenhuma", "nenhuma", "nenhuma", "sim"]) await ctx.app.inject({ method: "POST", url: `/v1/sessoes/${s1.id}/mensagens`, headers: h, payload: { tipo: "texto", texto: t } });
    ctx.relogio.atual = "2026-11-22";
    const s2 = (await ctx.app.inject({ method: "POST", url: "/v1/eu/checagens", headers: h })).json();
    let ultima;
    for (const t of ["4", "não", "nenhuma", "nenhuma", "nenhuma", "sim"]) ultima = (await ctx.app.inject({ method: "POST", url: `/v1/sessoes/${s2.id}/mensagens`, headers: h, payload: { tipo: "texto", texto: t } })).json();
    expect(ultima.mensagens.find((m: { tipo: string }) => m.tipo === "resultado")).toMatchObject({ saida: 2 });
    expect((await ctx.app.inject({ method: "GET", url: "/v1/eu/plano", headers: h })).json().status).toBe("pausado");
  });

  it("registro acima da dose é recusado (M9)", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    await conversar(ctx, h, [["pescoco"], "2 dias", "3", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    const ex = (await ctx.app.inject({ method: "GET", url: "/v1/eu/plano", headers: h })).json().exercicios[0];
    const max = ex.dose.maximo_por_dia;
    for (let i = 0; i < max; i++) await ctx.app.inject({ method: "POST", url: "/v1/eu/registros", headers: h, payload: { exercicioId: ex.id, dia: "2026-11-08", quantidade: 1 } });
    const r = await ctx.app.inject({ method: "POST", url: "/v1/eu/registros", headers: h, payload: { exercicioId: ex.id, dia: "2026-11-08", quantidade: 1 } });
    expect(r.json()).toEqual({ aceito: false, motivo: "acima_da_dose" });
  });

  it("apagar tudo apaga de verdade", async () => {
    const ctx = montarTeste();
    const { id, h } = await pessoa(ctx);
    await conversar(ctx, h, [["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    expect((await ctx.app.inject({ method: "DELETE", url: "/v1/eu", headers: h })).statusCode).toBe(200);
    for (const t of ["pessoa", "episodio", "plano", "sessao", "consentimento", "ritmo_membro"]) {
      const linhas = ctx.db.$client.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
      expect(linhas.filter((l) => l.id_pseudonimo === id), t).toEqual([]);
    }
    expect(ctx.db.$client.prepare("SELECT count(*) n FROM episodio").get()).toEqual({ n: 0 });
  });

  it("pedidos sem corpo com content-type JSON (como o celular manda) funcionam", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    const json = { ...h, "content-type": "application/json" };
    for (const [method, url] of [["POST", "/v1/ritmo/sair"], ["DELETE", "/v1/consentimentos/ritmo"], ["DELETE", "/v1/eu"]] as const) {
      const r = await ctx.app.inject({ method, url, headers: json });
      expect(r.statusCode, `${method} ${url}: ${r.body}`).toBe(200);
    }
    expect((await ctx.app.inject({ method: "POST", url: "/v1/sessoes", headers: json, payload: "{nao e json" })).statusCode).toBe(400);
  });

  it("revogar a triagem apaga os dados de saúde na hora (D12)", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    await conversar(ctx, h, [["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    await ctx.app.inject({ method: "DELETE", url: "/v1/consentimentos/triagem", headers: h });
    expect(ctx.db.$client.prepare("SELECT count(*) n FROM episodio").get()).toEqual({ n: 0 });
  });

  it("job de retenção: 12 meses sem uso apaga dados de saúde", async () => {
    const ctx = montarTeste({ hoje: "2025-10-01" });
    const { h } = await pessoa(ctx);
    await conversar(ctx, h, [["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    ctx.relogio.atual = "2026-09-30";
    expect(ctx.sv.retencao()).toBe(0);
    ctx.relogio.atual = "2026-10-02";
    expect(ctx.sv.retencao()).toBe(1);
    expect(ctx.db.$client.prepare("SELECT count(*) n FROM episodio").get()).toEqual({ n: 0 });
  });

  it("logs sem dado de saúde: só ids e códigos de evento", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    await conversar(ctx, h, [["lombar"], "3 dias e tenho febre", "sim", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    const permitidas = new Set(["evento", "tipo", "saida", "urgente", "motivo", "codigo", "apagados", "modo"]);
    for (const l of ctx.logs) for (const k of Object.keys(l)) expect(permitidas.has(k), k).toBe(true);
    expect(JSON.stringify(ctx.logs)).not.toMatch(/febre|lombar|dias/);
  });
});

describe("Ritmo", () => {
  it("equipe com menos de 5 não aparece; sem consentimento não entra", async () => {
    const ctx = montarTeste();
    const a = await pessoa(ctx);
    expect((await ctx.app.inject({ method: "POST", url: "/v1/ritmo/entrar", headers: a.h, payload: { apelido: "Ana" } })).statusCode).toBe(403);
    const ps = [a, await pessoa(ctx), await pessoa(ctx), await pessoa(ctx)];
    for (const [i, p] of ps.entries()) {
      await ctx.app.inject({ method: "POST", url: "/v1/consentimentos", headers: p.h, payload: { tipo: "ritmo", versao: 1 } });
      await ctx.app.inject({ method: "POST", url: "/v1/ritmo/entrar", headers: p.h, payload: { apelido: `Pessoa ${i}` } });
    }
    let placar = (await ctx.app.inject({ method: "GET", url: "/v1/ritmo/placar", headers: a.h })).json();
    expect(placar.equipes).toEqual([]);
    const quinta = await pessoa(ctx);
    await ctx.app.inject({ method: "POST", url: "/v1/consentimentos", headers: quinta.h, payload: { tipo: "ritmo", versao: 1 } });
    await ctx.app.inject({ method: "POST", url: "/v1/ritmo/entrar", headers: quinta.h, payload: { apelido: "Quinta" } });
    placar = (await ctx.app.inject({ method: "GET", url: "/v1/ritmo/placar", headers: a.h })).json();
    expect(placar.equipes).toHaveLength(1);
    // a equipe vê apelidos, sem pontuação individual
    expect(placar.minhaEquipe).toHaveLength(5);
    expect(JSON.stringify(placar.equipes)).not.toContain("Pessoa");
  });
});

describe("RH (M7)", () => {
  it("funcionário não acessa rotas do RH", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    for (const url of ROTAS_RH) expect((await ctx.app.inject({ method: "GET", url, headers: h })).statusCode, url).toBe(403);
  });

  it("contrato: rotas do RH só devolvem campos permitidos e nada individual", async () => {
    const ctx = montarTeste();
    // setores pequenos de propósito
    ctx.db.insert(ctx.schema.setor).values([{ id: "s-ti", empresaId: "emp", nome: "TI" }, { id: "s-fin", empresaId: "emp", nome: "Financeiro" }]).run();
    const ids: string[] = [];
    for (let i = 0; i < 14; i++) {
      const p = await pessoa(ctx);
      ids.push(p.id);
      ctx.db.$client.prepare("UPDATE pessoa SET setor_id = ? WHERE id_pseudonimo = ?").run(i < 11 ? "s-ti" : "s-fin", p.id);
      await conversar(ctx, p.h, [["lombar"], "3 dias", i % 2 ? "4" : "7", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    }
    const rhId = novoId();
    await ctx.app.inject({ method: "POST", url: "/v1/dispositivos", payload: { id: rhId } });
    ctx.db.$client.prepare("UPDATE pessoa SET papel = 'rh' WHERE id_pseudonimo = ?").run(rhId);
    const h = { "x-levia-dispositivo": rhId };
    const r = (await ctx.app.inject({ method: "GET", url: "/v1/rh/agregados", headers: h })).json();
    expect(Object.keys(r).sort()).toEqual(["aviso", "celulas"]);
    for (const c of r.celulas) {
      expect(Object.keys(c).sort()).toEqual([...CAMPOS_PERMITIDOS].sort());
      zCelulaRh.parse(c);
    }
    const tudo = JSON.stringify(r) + (await ctx.app.inject({ method: "GET", url: "/v1/rh/nr1.csv", headers: h })).body;
    for (const id of ids) expect(tudo).not.toContain(id);
    expect(tudo).not.toMatch(/\d{4}-\d{2}-\d{2}/); // nenhuma data individual
    const fin = r.celulas.find((c: { setor: string; indicador: string }) => c.setor === "Financeiro" && c.indicador === "pessoas_ativas");
    expect(fin).toMatchObject({ suprimido: true, valor: null });
    // complementar: o total da empresa não deixa deduzir o Financeiro (3 pessoas)
    const total = r.celulas.find((c: { setor: string; indicador: string }) => c.setor === "Toda a empresa" && c.indicador === "pessoas_ativas");
    const ti = r.celulas.find((c: { setor: string; indicador: string }) => c.setor === "TI" && c.indicador === "pessoas_ativas");
    if (!total.suprimido && !ti.suprimido) expect(total.valor - ti.valor === 0 || total.valor - ti.valor >= 10).toBe(true);
    const pdf = await ctx.app.inject({ method: "GET", url: "/v1/rh/nr1.pdf", headers: h });
    expect(pdf.headers["content-type"]).toContain("application/pdf");
  });

  it("filtro livre extra é recusado", async () => {
    const ctx = montarTeste();
    const rhId = novoId();
    await ctx.app.inject({ method: "POST", url: "/v1/dispositivos", payload: { id: rhId } });
    ctx.db.$client.prepare("UPDATE pessoa SET papel = 'rh' WHERE id_pseudonimo = ?").run(rhId);
    const r = await ctx.app.inject({ method: "GET", url: "/v1/rh/agregados?regiao=lombar", headers: { "x-levia-dispositivo": rhId } });
    expect(r.statusCode).toBe(400);
  });
});

describe("bench", () => {
  it("rotas de bench só existem com LEVIA_MODE=bench", async () => {
    expect((await montarTeste().app.inject({ method: "POST", url: "/v1/bench/triage", payload: {} })).statusCode).toBe(404);
    const ctx = montarTeste({ modo: "bench" });
    const r = await ctx.app.inject({ method: "POST", url: "/v1/bench/conversa", payload: { mensagens: [{ mapa: ["lombar"] }, "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"] } });
    expect(r.json()).toMatchObject({ terminou: true, saida: 1 });
    expect(r.json().perguntas).toBeLessThanOrEqual(16);
    expect(r.json().tempoSimuladoSegundos).toBeLessThanOrEqual(240);
  });
});
