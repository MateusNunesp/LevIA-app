// Contrato com o juiz (bench/). Só existe com LEVIA_MODE=bench.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { triage } from "@levia/triage";
import { carregarConteudo } from "@levia/content";
import { escolherExercicios } from "@levia/conversation";
import { REGIOES, type MensagemLevia } from "@levia/shared";
import type { NluProvider } from "@levia/nlu";
import { abrirDb } from "./db/index.ts";
import { garantirPadrao, EMPRESA_PADRAO, SETOR_PADRAO } from "./montar.ts";
import { Servico, type Relogio } from "./servico.ts";
import { Cifra } from "./cripto.ts";

export const zVinheta = z.object({
  respostas: z.object({
    regioes: z.array(z.enum(REGIOES)).min(1),
    duracaoDias: z.number().min(0),
    dorNota: z.number().min(0).max(10),
    achados: z.record(z.string(), z.boolean()),
    startBack: z.array(z.number().int().min(0).max(1)).length(9),
  }),
  historico: z.any().optional(),
  hoje: z.string().optional(),
});

export const zRoteiro = z.object({
  mensagens: z.array(z.union([z.string(), z.object({ mapa: z.array(z.enum(REGIOES)) }), z.object({ voz: z.string() })])).min(1),
  hoje: z.string().optional(),
});

export function rodarVinheta(sv: Servico, entrada: unknown) {
  const v = zVinheta.parse(entrada);
  const r = triage(v.respostas as never, v.historico, sv.conteudo.arvore, v.hoje ?? sv.relogio.hoje());
  const exercicios = r.exerciciosPermitidos ? escolherExercicios(sv.conteudo.catalogo, v.respostas.regioes as never).map((e) => e.id) : [];
  return { ...r, exercicios };
}

const palavras = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Simula uma pessoa do começo ao fim: NLU + detector + confirmação + árvore. */
export async function rodarConversa(sv: Servico, entrada: unknown, padrao = { empresa: EMPRESA_PADRAO, setor: SETOR_PADRAO }) {
  const ro = zRoteiro.parse(entrada);
  const dono = `bench-${randomUUID()}`;
  sv.registrarDispositivo(dono, padrao.empresa, padrao.setor);
  sv.consentir(dono, "triagem", 1);
  let sessao = sv.novaSessao(dono);
  const mostradas: MensagemLevia[] = [...sessao.mensagens];
  let tokens = { entrada: 0, saida: 0 };
  let segundos = 0;
  let respostasDadas = 0;
  let terminada = false;
  for (const m of ro.mensagens) {
    if (terminada) break;
    const ent = typeof m === "string" ? { tipo: "texto" as const, texto: m } : "mapa" in m ? { tipo: "mapa" as const, regioes: m.mapa } : { tipo: "texto" as const, texto: m.voz, origem: "voz" as const };
    // tempo simulado: 4 s para começar a responder + digitação/fala a ~3 caracteres por segundo
    segundos += 4 + (ent.tipo === "mapa" ? 2 : ent.texto.length / 3);
    respostasDadas += 1;
    const r = await sv.mensagem(dono, sessao.id, ent);
    tokens = { entrada: tokens.entrada + r.tokens.entrada, saida: tokens.saida + r.tokens.saida };
    mostradas.push(...r.mensagens);
    terminada = r.terminada || r.mensagens.some((x) => x.tipo === "emergencia");
    if (r.novaSessaoId) sessao = { id: r.novaSessaoId, mensagens: [] };
  }
  // leitura das mensagens da LevIA a ~3,3 palavras por segundo
  for (const m of mostradas) if ("texto" in m) segundos += palavras(m.texto) / 3.3;
  const res = mostradas.find((m) => m.tipo === "resultado") as Extract<MensagemLevia, { tipo: "resultado" }> | undefined;
  const ep = res ? sv.episodio(dono, res.episodioId) : null;
  const perguntas = mostradas.filter((m) => (m.tipo === "texto" && /\?/.test(m.texto) && !m.textoId.startsWith("guardrail.")) || m.tipo === "cartao_mapa").length;
  const confirmacoes = mostradas.filter((m) => m.tipo === "texto" && /^(confirmacao\.texto|confirmacao\.repergunta|checagem\.confirmacao)$/.test(m.textoId)).length;
  const saida = {
    terminou: !!res,
    saida: res?.saida ?? null,
    urgenteHoje: res?.urgenteHoje ?? false,
    regrasDisparadas: ep?.regrasDisparadas ?? [],
    emergencia: mostradas.find((m) => m.tipo === "emergencia") ?? null,
    perguntas,
    /** perguntas do roteiro, sem contar a confirmação final (R3) */
    perguntasRoteiro: perguntas - confirmacoes,
    respostasDadas,
    tempoSimuladoSegundos: Math.round(segundos),
    textosMostrados: mostradas.map((m): string => (m.tipo === "exercicio" ? `[exercicio ${m.exercicioId}] ${m.nome}` : m.texto)),
    exercicios: mostradas.filter((m) => m.tipo === "exercicio").map((m) => (m as { exercicioId: string }).exercicioId),
    tokens,
  };
  sv.apagarTudo(dono);
  return saida;
}

export function servicoBench(nlu: NluProvider | null, hoje?: string): Servico {
  const db = abrirDb(":memory:");
  garantirPadrao(db);
  const relogio: Relogio = { hoje: () => hoje ?? process.env.LEVIA_HOJE ?? "2026-11-08", agora: () => `${hoje ?? process.env.LEVIA_HOJE ?? "2026-11-08"}T12:00:00.000Z` };
  return new Servico(db, carregarConteudo(), new Cifra("chave-do-bench-nao-usar-em-producao"), nlu, relogio);
}


export function rotasBench(app: FastifyInstance, sv: Servico, padrao: { empresa: string; setor: string }): void {
  app.post("/v1/bench/triage", async (req) => rodarVinheta(sv, req.body));
  app.post("/v1/bench/conversa", async (req) => rodarConversa(sv, req.body, padrao));
}
