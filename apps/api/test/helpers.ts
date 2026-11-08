import { carregarConteudo } from "@levia/content";
import { NluMock } from "@levia/nlu";
import { abrirDb, schema } from "../src/db/index.ts";
import { Cifra } from "../src/cripto.ts";
import { criarApp } from "../src/app.ts";
import { garantirPadrao } from "../src/montar.ts";
import { Servico, type Metrica } from "../src/servico.ts";

export function montarTeste(op: { modo?: "dev" | "bench"; hoje?: string } = {}) {
  const db = abrirDb(":memory:");
  garantirPadrao(db, "emp", "setor-geral");
  const relogio = { atual: op.hoje ?? "2026-11-08" };
  const logs: Metrica[] = [];
  const sv = new Servico(db, carregarConteudo(), new Cifra("chave-de-teste-123456"), new NluMock(), {
    hoje: () => relogio.atual,
    agora: () => `${relogio.atual}T12:00:00.000Z`,
  }, (m) => logs.push(m));
  const app = criarApp(sv, { empresaPadrao: "emp", setorPadrao: "setor-geral", modo: op.modo ?? "dev" });
  return { app, sv, db, relogio, logs, schema };
}

export const START_BAIXO = ["discordo", "discordo", "discordo", "discordo", "discordo", "discordo", "discordo", "discordo", "pouco"];

let n = 0;
export function novoId(): string {
  n += 1;
  return `teste-dispositivo-${String(n).padStart(6, "0")}-${Math.random().toString(36).slice(2, 8)}`;
}
