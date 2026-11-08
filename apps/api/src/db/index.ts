import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const MIGRACOES = resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations");

/** Aplica migrações versionadas em ordem (tabela _migracoes guarda as já aplicadas). */
export function migrar(sqlite: Database.Database): string[] {
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migracoes (nome TEXT PRIMARY KEY, em TEXT NOT NULL)");
  const feitas = new Set((sqlite.prepare("SELECT nome FROM _migracoes").all() as { nome: string }[]).map((r) => r.nome));
  const aplicadas: string[] = [];
  for (const f of readdirSync(MIGRACOES).filter((x) => x.endsWith(".sql")).sort()) {
    if (feitas.has(f)) continue;
    sqlite.transaction(() => {
      sqlite.exec(readFileSync(join(MIGRACOES, f), "utf8"));
      sqlite.prepare("INSERT INTO _migracoes VALUES (?, ?)").run(f, new Date().toISOString());
    })();
    aplicadas.push(f);
  }
  return aplicadas;
}

export function abrirDb(caminho = process.env.LEVIA_DB ?? "levia.db"): Db {
  const sqlite = new Database(caminho);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrar(sqlite);
  return drizzle(sqlite, { schema }) as Db;
}

export { schema };
