// Monta o servidor a partir das variáveis de ambiente.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConteudo } from "@levia/content";
import { NluAnthropic, NluComCache, NluMock, type NluProvider } from "@levia/nlu";
import { abrirDb, schema, type Db } from "./db/index.ts";
import { Cifra } from "./cripto.ts";
import { Servico, relogioReal, type Relogio, type Metrica } from "./servico.ts";

export const EMPRESA_PADRAO = process.env.LEVIA_EMPRESA_PADRAO ?? "empresa-demo";
export const SETOR_PADRAO = process.env.LEVIA_SETOR_PADRAO ?? "setor-geral";

export function chaveDados(): string {
  if (process.env.LEVIA_CHAVE_DADOS) return process.env.LEVIA_CHAVE_DADOS;
  if (process.env.LEVIA_MODE === "producao") throw new Error("LEVIA_CHAVE_DADOS é obrigatória em produção");
  // Desenvolvimento: chave local gerada uma vez, fora do controle de versão.
  const f = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.levia-chave-dev");
  if (!existsSync(f)) writeFileSync(f, randomBytes(32).toString("hex"), { mode: 0o600 });
  return readFileSync(f, "utf8").trim();
}

export function escolherNlu(qual = process.env.LEVIA_NLU ?? "mock"): NluProvider | null {
  if (qual === "nenhuma") return null;
  if (qual === "anthropic") return new NluComCache(new NluAnthropic());
  return new NluComCache(new NluMock());
}

/** Garante empresa e setor padrão (configuráveis). */
export function garantirPadrao(db: Db, empresaId = EMPRESA_PADRAO, setorId = SETOR_PADRAO): void {
  db.insert(schema.empresa).values({ id: empresaId, nome: "Empresa" }).onConflictDoNothing().run();
  db.insert(schema.setor).values({ id: setorId, empresaId, nome: "Geral" }).onConflictDoNothing().run();
}

export function logSemSaude(m: Metrica): void {
  // Só ids e códigos de evento. Nunca texto livre nem respostas.
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), ...m }) + "\n");
}

export function montarServico(op: { db?: Db; nlu?: NluProvider | null; relogio?: Relogio; log?: (m: Metrica) => void } = {}): Servico {
  const db = op.db ?? abrirDb();
  garantirPadrao(db);
  return new Servico(db, carregarConteudo(), new Cifra(chaveDados()), op.nlu === undefined ? escolherNlu() : op.nlu, op.relogio ?? relogioReal, op.log ?? (() => {}));
}
