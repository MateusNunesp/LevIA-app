// Carregador e schemas do conteúdo versionado (árvore, catálogo, textos).
// Se algo falhar na validação, quem carrega (o servidor) não sobe.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { ACHADOS, REGIOES } from "@levia/shared";
import type { Arvore, StatusRevisao } from "@levia/shared";

const zRegiao = z.enum(REGIOES);
const zAchado = z.enum(ACHADOS);
const zRef = z.union([z.number(), z.boolean(), z.string().regex(/^\$cortes\.[a-z0-9_.]+$/)]);
const zSemana = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6)]);
const zStatus = z.enum(["precisa_de_revisao", "revisado", "aprovado"]);
const zRevisao = {
  status_revisao: zStatus,
  revisado_por: z.string().nullable(),
  revisado_em: z.string().nullable(),
};

const zCondicao = z
  .object({
    qualquer: z.array(zAchado).min(1).optional(),
    regiao_em: z.array(zRegiao).min(1).optional(),
    regioes_todas_em: z.union([z.array(zRegiao).min(1), z.literal("$regioes_saida1")]).optional(),
    dor_nota_gte: zRef.optional(),
    dor_nota_lte: zRef.optional(),
    dias_lte: zRef.optional(),
    start_back_em: z.union([z.array(z.enum(["baixo", "medio", "alto"])), zRef]).optional(),
    crises_12m_gte: zRef.optional(),
    checagem_piorou: z.object({ semana: zSemana }).strict().optional(),
    checagem_queda_insuficiente: z.object({ semana: zSemana, pontos: zRef, pct: zRef }).strict().optional(),
    checagem_dor_gt: z.object({ semana: zSemana, valor: zRef }).strict().optional(),
    checagem_limita_trabalho: z.object({ semana: zSemana }).strict().optional(),
    checagem_nao_recuperado: z.object({ semana: zSemana }).strict().optional(),
    sempre: z.literal(true).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, "condição vazia");

const zRegra = z
  .object({
    id: z.string().regex(/^[A-Z0-9-]+$/),
    quando: zCondicao,
    saida: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    urgente_hoje: z.boolean().optional(),
    emergencia: z.boolean().optional(),
    porque: z.string(),
    habilitada: zRef.optional(),
  })
  .strict()
  .refine((r) => !r.urgente_hoje || r.saida === 3, "urgente_hoje só na saída 3 (D2)");

export const zArvore = z
  .object({
    versao: z.number().int(),
    ...zRevisao,
    cortes: z.record(z.string(), z.unknown()),
    regioes_saida1: z.array(zRegiao),
    regioes_coluna: z.array(zRegiao),
    perguntas: z.array(z.object({ id: z.string(), tipo: z.string(), texto: z.string().optional() })),
    perguntas_alerta: z.array(
      z
        .object({
          id: z.string(),
          regioes: z.array(zRegiao).min(1),
          sinal_de_alerta: z.literal(true),
          texto: z.string(),
          itens: z.array(z.object({ achado: zAchado, pergunta_unica: z.string() }).strict()).min(1),
        })
        .strict(),
    ),
    regras: z.array(zRegra).min(1),
  })
  .strict();

const zDose = z
  .object({
    series: z.number().int().positive(),
    repeticoes: z.number().int().positive(),
    vezes_por_semana: z.number().int().min(1).max(7),
    maximo_por_dia: z.number().int().positive(),
  })
  .strict();

export const zExercicio = z
  .object({
    id: z.string().regex(/^EX-[A-Z0-9-]+$/),
    nome: z.string(),
    regioes: z.array(zRegiao).min(1),
    objetivo: z.string(),
    passos: z.array(z.string()).min(1).max(6),
    dose: zDose,
    quando_parar: z.string(),
    midia: z.string(),
    status_revisao: zStatus,
  })
  .strict();
export type Exercicio = z.infer<typeof zExercicio>;

export const zCatalogo = z.object({ versao: z.number(), ...zRevisao, exercicios: z.array(zExercicio).min(1) }).strict();
export type Catalogo = z.infer<typeof zCatalogo>;

export const zTextos = z
  .object({ versao: z.number(), ...zRevisao, textos: z.record(z.string(), z.string().min(1)) })
  .strict();
export type Textos = z.infer<typeof zTextos>;

export interface Conteudo {
  arvore: Arvore;
  catalogo: Catalogo;
  textos: Textos;
}

export function dirConteudoPadrao(): string {
  const aqui = dirname(fileURLToPath(import.meta.url));
  return resolve(aqui, "../../../content");
}

function ler(caminho: string): { bruto: string; dado: unknown } {
  const bruto = readFileSync(caminho, "utf8");
  return { bruto, dado: parse(bruto) };
}

export class ErroConteudo extends Error {}

export function carregarConteudo(dir: string = dirConteudoPadrao()): Conteudo {
  const a = ler(join(dir, "arvore/arvore.v1.yaml"));
  const c = ler(join(dir, "catalogo/exercicios.yaml"));
  const t = ler(join(dir, "textos/pt-BR.yaml"));
  const arv = zArvore.safeParse(a.dado);
  if (!arv.success) throw new ErroConteudo("arvore.v1.yaml inválida: " + z.prettifyError(arv.error));
  const cat = zCatalogo.safeParse(c.dado);
  if (!cat.success) throw new ErroConteudo("exercicios.yaml inválido: " + z.prettifyError(cat.error));
  const txt = zTextos.safeParse(t.dado);
  if (!txt.success) throw new ErroConteudo("pt-BR.yaml inválido: " + z.prettifyError(txt.error));

  const hash = createHash("sha256").update(a.bruto).digest("hex").slice(0, 12);
  const arvore: Arvore = {
    ...(arv.data as Omit<Arvore, "versaoRegras">),
    versaoRegras: `arvore.v${arv.data.versao}@${hash}`,
  };
  validarCoerencia(arvore, cat.data, txt.data);
  return { arvore, catalogo: cat.data, textos: txt.data };
}

/** Regras de coerência que o schema sozinho não pega. */
export function validarCoerencia(arvore: Arvore, catalogo: Catalogo, textos: Textos): void {
  const erros: string[] = [];
  const ids = new Set<string>();
  for (const r of arvore.regras) {
    if (ids.has(r.id)) erros.push(`regra duplicada ${r.id}`);
    ids.add(r.id);
    if (!(r.porque in textos.textos)) erros.push(`texto ausente para ${r.id}: ${r.porque}`);
  }
  const ultima = arvore.regras[arvore.regras.length - 1];
  if (!ultima?.quando.sempre || ultima.saida !== 2) erros.push("a última regra precisa ser 'sempre' -> saída 2 (D1)");
  for (const r of arvore.regras.slice(0, -1)) if (r.quando.sempre) erros.push(`regra 'sempre' fora do fim: ${r.id}`);
  // Regras de alerta (urgentes) precisam vir antes de qualquer regra não urgente.
  let viuNaoUrgente = false;
  for (const r of arvore.regras) {
    if (!r.urgente_hoje) viuNaoUrgente = true;
    else if (viuNaoUrgente) erros.push(`regra de alerta ${r.id} vem depois de regra comum (M1)`);
  }
  // Toda região precisa ter pergunta de alerta; todo texto citado precisa existir.
  for (const reg of REGIOES) {
    if (!arvore.perguntas_alerta.some((p) => p.regioes.includes(reg))) erros.push(`região sem pergunta de alerta: ${reg}`);
  }
  for (const p of arvore.perguntas_alerta) {
    if (!(p.texto in textos.textos)) erros.push(`texto ausente: ${p.texto}`);
    for (const i of p.itens) if (!(i.pergunta_unica in textos.textos)) erros.push(`texto ausente: ${i.pergunta_unica}`);
  }
  // Todo achado de regra urgente precisa ser perguntado em alguma pergunta de alerta.
  const perguntados = new Set(arvore.perguntas_alerta.flatMap((p) => p.itens.map((i) => i.achado)));
  for (const r of arvore.regras) for (const a of r.quando.qualquer ?? []) if (!perguntados.has(a)) erros.push(`achado nunca perguntado: ${a}`);
  // Saída 1 só em região com exercício no catálogo (R8).
  for (const reg of arvore.regioes_saida1) {
    if (!catalogo.exercicios.some((e) => e.regioes.includes(reg))) erros.push(`regioes_saida1 sem exercício: ${reg}`);
  }
  if (erros.length) throw new ErroConteudo("conteúdo incoerente:\n- " + erros.join("\n- "));
}

/** Itens ainda marcados como precisa_de_revisao (D5). */
export function pendenciasRevisao(c: Conteudo): string[] {
  const out: string[] = [];
  const st = (s: StatusRevisao) => s === "precisa_de_revisao";
  if (st(c.arvore.status_revisao)) out.push("content/arvore/arvore.v1.yaml");
  if (st(c.catalogo.status_revisao)) out.push("content/catalogo/exercicios.yaml");
  for (const e of c.catalogo.exercicios) if (st(e.status_revisao)) out.push(`exercício ${e.id}`);
  if (st(c.textos.status_revisao)) out.push("content/textos/pt-BR.yaml");
  return out;
}

/** Troca {chaves} por valores. Chave sem valor é erro (nunca mostrar "{x}"). */
export function preencher(modelo: string, vars: Record<string, string | number> = {}): string {
  return modelo.replace(/\{([a-z_]+)\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`variável ausente no template: ${k}`);
    return String(vars[k]);
  });
}

export function texto(t: Textos, id: string, vars?: Record<string, string | number>): string {
  const m = t.textos[id];
  if (m === undefined) throw new Error(`texto não aprovado: ${id}`);
  return preencher(m, vars);
}
