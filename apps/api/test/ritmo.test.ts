import { describe, expect, it } from "vitest";
import { montarTeste, novoId, START_BAIXO } from "./helpers.ts";

type Ctx = ReturnType<typeof montarTeste>;
const J = { "content-type": "application/json" };

async function pessoa(ctx: Ctx, setor = "setor-geral") {
  const id = novoId();
  const h = { "x-levia-dispositivo": id };
  await ctx.app.inject({ method: "POST", url: "/v1/dispositivos", payload: { id } });
  ctx.db.$client.prepare("UPDATE pessoa SET setor_id = ? WHERE id_pseudonimo = ?").run(setor, id);
  await ctx.app.inject({ method: "POST", url: "/v1/consentimentos", headers: h, payload: { tipo: "triagem", versao: 1 } });
  return { id, h };
}
const entrar = (ctx: Ctx, h: Record<string, string>, apelido: string) =>
  ctx.app
    .inject({ method: "POST", url: "/v1/consentimentos", headers: h, payload: { tipo: "ritmo", versao: 1 } })
    .then(() => ctx.app.inject({ method: "POST", url: "/v1/ritmo/entrar", headers: h, payload: { apelido } }));
const sair = (ctx: Ctx, h: Record<string, string>) => ctx.app.inject({ method: "DELETE", url: "/v1/consentimentos/ritmo", headers: { ...h, ...J } });
const placar = async (ctx: Ctx, h: Record<string, string>) => (await ctx.app.inject({ method: "GET", url: "/v1/ritmo/placar", headers: h })).json();
async function comPlano(ctx: Ctx, h: Record<string, string>) {
  const s = (await ctx.app.inject({ method: "POST", url: "/v1/sessoes", headers: h, payload: {} })).json();
  for (const p of [["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]) {
    const payload = Array.isArray(p) ? { tipo: "mapa", regioes: p } : { tipo: "texto", texto: p };
    await ctx.app.inject({ method: "POST", url: `/v1/sessoes/${s.id}/mensagens`, headers: h, payload });
  }
  return (await ctx.app.inject({ method: "GET", url: "/v1/eu/plano", headers: h })).json();
}
function setor(ctx: Ctx, id: string, nome: string) {
  ctx.db.$client.prepare("INSERT INTO setor (id, empresa_id, nome) VALUES (?, 'emp', ?)").run(id, nome);
}

describe("Ritmo: entrar e sair", () => {
  it("sair e entrar de novo no mesmo dia funciona", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    expect((await entrar(ctx, h, "Ana")).statusCode).toBe(200);
    expect((await sair(ctx, h)).statusCode).toBe(200);
    expect((await placar(ctx, h)).participando).toBe(false);
    const r = await entrar(ctx, h, "Ana");
    expect(r.statusCode, r.body).toBe(200);
    expect(await placar(ctx, h)).toMatchObject({ participando: true, apelido: "Ana" });
  });
  it("trocar o próprio apelido funciona", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    await entrar(ctx, h, "Ana");
    expect((await ctx.app.inject({ method: "POST", url: "/v1/ritmo/entrar", headers: h, payload: { apelido: "Aninha" } })).statusCode).toBe(200);
    expect((await placar(ctx, h)).apelido).toBe("Aninha");
  });
  it("apelido com acento e espaço é aceito", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    expect((await entrar(ctx, h, "João Zé")).statusCode).toBe(200);
  });
  it("apelido repetido na mesma equipe é recusado (sem diferença de maiúsculas); em outra equipe pode", async () => {
    const ctx = montarTeste();
    setor(ctx, "s-a", "A");
    setor(ctx, "s-b", "B");
    const a = await pessoa(ctx, "s-a");
    const b = await pessoa(ctx, "s-a");
    const c = await pessoa(ctx, "s-b");
    await entrar(ctx, a.h, "Ana");
    const r = await entrar(ctx, b.h, "ana");
    expect(r.statusCode).toBe(409);
    expect(r.json().erro).toBe("apelido_em_uso");
    expect((await entrar(ctx, c.h, "Ana")).statusCode).toBe(200);
  });
  it("quem sai some da lista da equipe dos colegas", async () => {
    const ctx = montarTeste();
    const a = await pessoa(ctx);
    const b = await pessoa(ctx);
    await entrar(ctx, a.h, "Ana");
    await entrar(ctx, b.h, "Beto");
    await sair(ctx, b.h);
    expect((await placar(ctx, a.h)).minhaEquipe).toEqual(["Ana"]);
  });
  it("apelidos em ordem natural (Colega 2 antes de Colega 10)", async () => {
    const ctx = montarTeste();
    for (const ap of ["Colega 10", "Colega 2", "colega 1"]) await entrar(ctx, (await pessoa(ctx)).h, ap);
    const a = await pessoa(ctx);
    await entrar(ctx, a.h, "Bia");
    expect((await placar(ctx, a.h)).minhaEquipe).toEqual(["Bia", "colega 1", "Colega 2", "Colega 10"]);
  });
});

describe("Ritmo: constância", () => {
  it("o dia de hoje sem exercício ainda não conta contra (o dia não acabou)", async () => {
    const ctx = montarTeste();
    const { h } = await pessoa(ctx);
    const plano = await comPlano(ctx, h);
    await entrar(ctx, h, "Ana");
    expect((await placar(ctx, h)).meuProgresso).toEqual({ diasCumpridos: 0, diasQueContam: 0 });
    await ctx.app.inject({ method: "POST", url: "/v1/eu/registros", headers: h, payload: { exercicioId: plano.exercicios[0].id, dia: "2026-11-08", quantidade: 1 } });
    expect((await placar(ctx, h)).meuProgresso).toEqual({ diasCumpridos: 1, diasQueContam: 1 });
  });
  it("dia passado sem exercício conta como não cumprido", async () => {
    const ctx = montarTeste({ hoje: "2026-11-06" });
    const { h } = await pessoa(ctx);
    await comPlano(ctx, h);
    await entrar(ctx, h, "Ana");
    ctx.relogio.atual = "2026-11-08";
    expect((await placar(ctx, h)).meuProgresso).toEqual({ diasCumpridos: 0, diasQueContam: 2 });
  });
  it("equipe em que todos estão em pausa não aparece com 0%", async () => {
    const ctx = montarTeste();
    const ps = [];
    for (let i = 0; i < 5; i++) {
      const p = await pessoa(ctx);
      await entrar(ctx, p.h, `P${i}`);
      ps.push(p);
    }
    const eq = (await placar(ctx, ps[0]!.h)).equipes[0];
    expect(eq.participantes).toBe(5);
    expect(eq.constancia).toBeNull();
  });
  it("mapa de calor: 14 dias, somando as atividades de cada dia, só para a própria pessoa", async () => {
    const ctx = montarTeste({ hoje: "2026-11-06" });
    const a = await pessoa(ctx);
    const b = await pessoa(ctx);
    const plano = await comPlano(ctx, a.h);
    const ex = plano.exercicios[0];
    await ctx.app.inject({ method: "POST", url: "/v1/eu/registros", headers: a.h, payload: { exercicioId: ex.id, dia: "2026-11-06", quantidade: 1 } });
    ctx.relogio.atual = "2026-11-08";
    for (let i = 0; i < 2; i++)
      await ctx.app.inject({ method: "POST", url: "/v1/eu/registros", headers: a.h, payload: { exercicioId: ex.id, dia: "2026-11-08", quantidade: 1 } });
    const r = await placar(ctx, a.h);
    expect(r.hoje).toBe("2026-11-08");
    expect(r.minhasAtividades).toHaveLength(14);
    expect(r.minhasAtividades[0].dia).toBe("2026-10-26");
    expect(r.minhasAtividades.at(-1)).toEqual({ dia: "2026-11-08", quantidade: 2, planoAtivo: true });
    expect(r.minhasAtividades.find((d: { dia: string }) => d.dia === "2026-11-06")).toEqual({ dia: "2026-11-06", quantidade: 1, planoAtivo: true });
    expect(r.minhasAtividades.find((d: { dia: string }) => d.dia === "2026-11-01")).toEqual({ dia: "2026-11-01", quantidade: 0, planoAtivo: false });
    // os dados de A não aparecem para B
    const rb = await placar(ctx, b.h);
    expect(rb.minhasAtividades.every((d: { quantidade: number }) => d.quantidade === 0)).toBe(true);
  });

  it("apagar tudo tira a pessoa da equipe", async () => {
    const ctx = montarTeste();
    const a = await pessoa(ctx);
    const b = await pessoa(ctx);
    await entrar(ctx, a.h, "Ana");
    await entrar(ctx, b.h, "Beto");
    await ctx.app.inject({ method: "DELETE", url: "/v1/eu", headers: { ...b.h, ...J } });
    expect((await placar(ctx, a.h)).minhaEquipe).toEqual(["Ana"]);
  });
});
