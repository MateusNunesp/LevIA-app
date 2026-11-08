// Rotas HTTP (só API, sem páginas web). Toda rota valida entrada E saída com zod.
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyServerOptions } from "fastify";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { texto as tx } from "@levia/content";
import { agregadosRh, CAMPOS_PERMITIDOS, csvNr1, INDICADORES, RODAPE_NR1, rotuloIndicador, type CelulaRh } from "@levia/privacy";
import { resumoHtml } from "@levia/summary";
import { REGIOES } from "@levia/shared";
import { ErroHttp, type Servico } from "./servico.ts";
import { rotasBench } from "./bench.ts";

// ---------- schemas ----------

export const zMensagem = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("texto"), textoId: z.string(), texto: z.string() }).strict(),
  z.object({ tipo: z.literal("cartao_mapa"), textoId: z.string(), texto: z.string() }).strict(),
  z.object({ tipo: z.literal("resultado"), saida: z.union([z.literal(1), z.literal(2), z.literal(3)]), urgenteHoje: z.boolean(), titulo: z.string(), texto: z.string(), porque: z.string(), episodioId: z.string() }).strict(),
  z.object({ tipo: z.literal("resumo"), episodioId: z.string(), texto: z.string() }).strict(),
  z.object({ tipo: z.literal("exercicio"), exercicioId: z.string(), nome: z.string(), passos: z.array(z.string()), dose: z.string(), quandoParar: z.string() }).strict(),
  z.object({ tipo: z.literal("emergencia"), motivo: z.enum(["cardiaca", "avc", "autolesao", "alerta"]), texto: z.string(), telefones: z.array(z.string()) }).strict(),
]);

const zIdDispositivo = z.string().regex(/^[A-Za-z0-9-]{16,64}$/);
const zEntradaMensagem = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("texto"), texto: z.string().min(1).max(1000) }).strict(),
  z.object({ tipo: z.literal("voz"), texto: z.string().min(1).max(1000) }).strict(), // só a transcrição confirmada; nunca áudio
  z.object({ tipo: z.literal("mapa"), regioes: z.array(z.enum(REGIOES)).min(1).max(9) }).strict(),
]);
const zRespostaMensagens = z.object({ mensagens: z.array(zMensagem), terminada: z.boolean(), novaSessaoId: z.string().optional() }).strict();

/** Única forma que uma célula do RH pode ter (M7). */
export const zCelulaRh = z.object({ setor: z.string(), mes: z.string(), indicador: z.enum(INDICADORES), valor: z.number().nullable(), suprimido: z.boolean() }).strict();
export const zRespostaRh = z.object({ celulas: z.array(zCelulaRh), aviso: z.string() }).strict();

export const ROTAS_RH = ["/v1/rh/agregados", "/v1/rh/nr1.csv", "/v1/rh/nr1.pdf"] as const;

// ---------- utilitários ----------

function saida<T>(schema: z.ZodType<T>, valor: unknown): T {
  const r = schema.safeParse(valor);
  if (!r.success) throw new ErroHttp(500, "saida_invalida");
  return r.data;
}

function entrada<T>(schema: z.ZodType<T>, valor: unknown): T {
  const r = schema.safeParse(valor);
  if (!r.success) throw new ErroHttp(400, "entrada_invalida");
  return r.data;
}

export interface OpcoesApp {
  empresaPadrao: string;
  setorPadrao: string;
  modo: "producao" | "dev" | "bench";
  logger?: boolean;
}

export function criarApp(sv: Servico, op: OpcoesApp): FastifyInstance {
  const opcoes: FastifyServerOptions = {
    logger: op.logger
      ? {
          // Logs sem dado de saúde: nada de corpo, só método, rota e status (4.9).
          serializers: {
            req: (r: { method: string; routeOptions?: { url?: string } }) => ({ method: r.method, rota: r.routeOptions?.url ?? "?" }),
            res: (r: { statusCode: number }) => ({ status: r.statusCode }),
          },
        }
      : false,
    bodyLimit: 16 * 1024,
  };
  const app = Fastify(opcoes);

  // Corpo JSON vazio vale como "sem corpo" (DELETE /v1/eu, POST /v1/ritmo/sair vindos de qualquer cliente).
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, corpo, pronto) => {
    const texto = String(corpo ?? "").trim();
    if (!texto) return pronto(null, undefined);
    try {
      pronto(null, JSON.parse(texto));
    } catch {
      pronto(new ErroHttp(400, "json_invalido"), undefined);
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ErroHttp) return reply.status(err.status).send({ erro: err.codigo });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ erro: "requisicao_invalida" });
    sv.log({ evento: "erro_interno" });
    return reply.status(500).send({ erro: "erro_interno" });
  });

  /** TODO(login): o identificador do aparelho faz o papel de token até a D13 ser definida. */
  const dono = (req: FastifyRequest): string => {
    const id = entrada(zIdDispositivo, req.headers["x-levia-dispositivo"]);
    sv.pessoa(id);
    return id;
  };
  const rh = (req: FastifyRequest) => {
    const id = entrada(zIdDispositivo, req.headers["x-levia-dispositivo"]);
    const p = sv.pessoa(id);
    if (p.papel !== "rh") throw new ErroHttp(403, "papel_rh_necessario");
    return p;
  };
  const funcionario = (req: FastifyRequest) => {
    const id = dono(req);
    if (sv.pessoa(id).papel !== "funcionario") throw new ErroHttp(403, "papel_funcionario_necessario");
    return id;
  };

  app.get("/v1/saude", async () => ({ ok: true }));

  // Textos fixos da interface (aprovados), para o app não ter texto de saúde embutido.
  app.get("/v1/textos", async () => {
    const t = sv.conteudo.textos.textos;
    const pegar = (prefixos: string[]) => Object.fromEntries(Object.entries(t).filter(([k]) => prefixos.some((p) => k.startsWith(p))));
    return {
      textos: pegar(["aviso.", "consentimento.", "estado.", "exercicios.", "notificacao.", "revisao.", "saida", "resumo."]),
      revisaoPendente: sv.conteudo.textos.status_revisao === "precisa_de_revisao",
    };
  });

  // ---------- perfil provisório ----------
  app.post("/v1/dispositivos", async (req) => {
    const { id } = entrada(z.object({ id: zIdDispositivo }).strict(), req.body);
    const r = sv.registrarDispositivo(id, op.empresaPadrao, op.setorPadrao);
    return saida(z.object({ papel: z.enum(["funcionario", "rh"]), novo: z.boolean(), triagemAceita: z.boolean(), ritmoAceito: z.boolean() }), {
      ...r,
      triagemAceita: sv.consentimentoAtivo(id, "triagem"),
      ritmoAceito: sv.consentimentoAtivo(id, "ritmo"),
    });
  });

  app.post("/v1/consentimentos", async (req) => {
    const id = funcionario(req);
    const b = entrada(z.object({ tipo: z.enum(["triagem", "ritmo"]), versao: z.number().int().positive() }).strict(), req.body);
    sv.consentir(id, b.tipo, b.versao);
    return { ok: true };
  });
  app.delete("/v1/consentimentos/:tipo", async (req) => {
    const id = funcionario(req);
    const { tipo } = entrada(z.object({ tipo: z.enum(["triagem", "ritmo"]) }), req.params);
    sv.revogar(id, tipo);
    return { ok: true };
  });

  // ---------- conversa ----------
  app.post("/v1/sessoes", async (req) => {
    const id = funcionario(req);
    const b = entrada(z.object({ modo: z.enum(["autoanamnese", "checagem"]).optional() }).strict(), req.body ?? {});
    const s = sv.novaSessao(id, b.modo);
    return saida(z.object({ id: z.string(), mensagens: z.array(zMensagem) }), s);
  });

  app.post("/v1/sessoes/:id/mensagens", async (req) => {
    const id = funcionario(req);
    const { id: sessaoId } = entrada(z.object({ id: z.string().uuid() }), req.params);
    const b = entrada(zEntradaMensagem, req.body);
    const ent = b.tipo === "mapa" ? { tipo: "mapa" as const, regioes: b.regioes } : { tipo: "texto" as const, texto: b.texto, origem: b.tipo };
    const r = await sv.mensagem(id, sessaoId, ent);
    return saida(zRespostaMensagens, { mensagens: r.mensagens, terminada: r.terminada, ...(r.novaSessaoId ? { novaSessaoId: r.novaSessaoId } : {}) });
  });

  // Atalho para "sim" na confirmação (a pessoa também pode escrever "sim").
  app.post("/v1/sessoes/:id/confirmar", async (req) => {
    const id = funcionario(req);
    const { id: sessaoId } = entrada(z.object({ id: z.string().uuid() }), req.params);
    const r = await sv.mensagem(id, sessaoId, { tipo: "texto", texto: "sim" });
    return saida(zRespostaMensagens, { mensagens: r.mensagens, terminada: r.terminada });
  });

  // ---------- eu ----------
  app.get("/v1/eu/plano", async (req) => sv.meuPlano(funcionario(req)));
  app.post("/v1/eu/registros", async (req) => {
    const id = funcionario(req);
    const b = entrada(z.object({ exercicioId: z.string(), dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantidade: z.number().int().min(1).max(20) }).strict(), req.body);
    return sv.registrar(id, b);
  });
  app.post("/v1/eu/checagens", async (req) => {
    const id = funcionario(req);
    return saida(z.object({ id: z.string(), mensagens: z.array(zMensagem) }), sv.novaSessao(id, "checagem"));
  });
  app.get("/v1/eu/resumos/:episodioId", async (req) => {
    const id = funcionario(req);
    const { episodioId } = entrada(z.object({ episodioId: z.string().uuid() }), req.params);
    const dados = sv.dadosResumo(id, episodioId);
    return { dados, html: resumoHtml(dados) };
  });
  app.get("/v1/eu/dados", async (req) => sv.meusDados(funcionario(req)));
  app.delete("/v1/eu", async (req) => {
    sv.apagarTudo(funcionario(req));
    return { ok: true };
  });

  // ---------- Ritmo ----------
  app.post("/v1/ritmo/entrar", async (req) => {
    const id = funcionario(req);
    const b = entrada(z.object({ apelido: z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N} ._-]+$/u) }).strict(), req.body);
    sv.entrarRitmo(id, b.apelido);
    return { ok: true };
  });
  app.post("/v1/ritmo/sair", async (req) => {
    sv.sairRitmo(funcionario(req));
    return { ok: true };
  });
  app.get("/v1/ritmo/placar", async (req) => sv.placarRitmo(funcionario(req)));

  // ---------- RH: só agregados, só via @levia/privacy ----------
  const celulas = (empresaId: string, q: unknown): CelulaRh[] => {
    // Cortes fixos: no máximo um setor e/ou um mês. Sem filtros livres combináveis (R14).
    const f = entrada(z.object({ setor: z.string().max(80).optional(), mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }).strict(), q ?? {});
    const todas = agregadosRh(sv.fonteRh(), empresaId);
    return todas.filter((c) => (!f.setor || c.setor === f.setor) && (!f.mes || c.mes === f.mes));
  };
  const AVISO = "Grupos com menos de 10 pessoas ficam ocultos.";

  app.get("/v1/rh/agregados", async (req) => {
    const p = rh(req);
    return saida(zRespostaRh, { celulas: celulas(p.empresaId, req.query), aviso: AVISO });
  });
  app.get("/v1/rh/nr1.csv", async (req, reply) => {
    const p = rh(req);
    const cs = saida(z.array(zCelulaRh), celulas(p.empresaId, req.query));
    return reply.type("text/csv; charset=utf-8").header("content-disposition", 'attachment; filename="levia-nr1.csv"').send(csvNr1(cs));
  });
  app.get("/v1/rh/nr1.pdf", async (req, reply) => {
    const p = rh(req);
    const cs = saida(z.array(zCelulaRh), celulas(p.empresaId, req.query));
    const buf = await pdfNr1(cs, AVISO);
    return reply.type("application/pdf").header("content-disposition", 'attachment; filename="levia-nr1.pdf"').send(buf);
  });

  if (op.modo === "bench") rotasBench(app, sv, { empresa: op.empresaPadrao, setor: op.setorPadrao });

  return app;
}

async function pdfNr1(cs: CelulaRh[], aviso: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "LevIA - Relatório NR-1 (agregado)" } });
  const partes: Buffer[] = [];
  doc.on("data", (b: Buffer) => partes.push(b));
  const fim = new Promise<Buffer>((ok) => doc.on("end", () => ok(Buffer.concat(partes))));
  doc.fillColor("#12443a").fontSize(18).text("Relatório NR-1 · dados agregados");
  doc.moveDown(0.3).fontSize(10).fillColor("#3d5f57").text(aviso);
  const porMes = new Map<string, CelulaRh[]>();
  for (const c of cs) porMes.set(c.mes, [...(porMes.get(c.mes) ?? []), c]);
  for (const [mes, lista] of [...porMes].sort()) {
    doc.moveDown().fillColor("#1f6f5c").fontSize(13).text(`Mês ${mes}`);
    const porSetor = new Map<string, CelulaRh[]>();
    for (const c of lista) porSetor.set(c.setor, [...(porSetor.get(c.setor) ?? []), c]);
    for (const [setor, l] of porSetor) {
      doc.moveDown(0.4).fillColor("#12443a").fontSize(11).text(setor);
      for (const c of l) {
        if (!c.suprimido && c.valor === 0 && c.indicador.startsWith("regiao_")) continue;
        doc.fontSize(9).fillColor("#3d5f57").text(`  ${rotuloIndicador(c.indicador)}: ${c.suprimido ? "menos de 10" : c.valor}`);
      }
    }
  }
  doc.moveDown(2).fontSize(9).fillColor("#3d5f57").text(RODAPE_NR1);
  doc.end();
  return fim;
}

export { CAMPOS_PERMITIDOS, tx };
