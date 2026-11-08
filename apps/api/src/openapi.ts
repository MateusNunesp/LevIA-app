// Gera docs/openapi.json a partir dos schemas zod usados nas rotas.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { zMensagem, zRespostaRh } from "./app.ts";
import { zRoteiro, zVinheta } from "./bench.ts";

const j = (s: z.ZodType) => z.toJSONSchema(s, { unrepresentable: "any" });
const cab = [{ name: "x-levia-dispositivo", in: "header", required: true, schema: { type: "string" }, description: "Identificador provisório do aparelho. TODO(login)." }];
const rota = (summary: string, resposta?: z.ZodType, corpo?: z.ZodType, comCab = true) => ({
  summary,
  ...(comCab ? { parameters: cab } : {}),
  ...(corpo ? { requestBody: { content: { "application/json": { schema: j(corpo) } } } } : {}),
  responses: { 200: { description: "ok", ...(resposta ? { content: { "application/json": { schema: j(resposta) } } } : {}) } },
});
const doc = {
  openapi: "3.1.0",
  info: { title: "LevIA API", version: "0.1.0", description: "Só API (sem páginas web). O RH só recebe agregados." },
  paths: {
    "/v1/dispositivos": { post: rota("Registra o identificador provisório do aparelho", undefined, z.object({ id: z.string() }), false) },
    "/v1/consentimentos": { post: rota("Dá um consentimento", undefined, z.object({ tipo: z.enum(["triagem", "ritmo"]), versao: z.number() })) },
    "/v1/consentimentos/{tipo}": { delete: rota("Revoga um consentimento (triagem: apaga dados de saúde)") },
    "/v1/sessoes": { post: rota("Começa uma conversa", z.object({ id: z.string(), mensagens: z.array(zMensagem) })) },
    "/v1/sessoes/{id}/mensagens": { post: rota("Envia texto, transcrição ou regiões do mapa", z.object({ mensagens: z.array(zMensagem), terminada: z.boolean() })) },
    "/v1/sessoes/{id}/confirmar": { post: rota("Atalho para confirmar") },
    "/v1/eu/plano": { get: rota("Plano de exercícios") },
    "/v1/eu/registros": { post: rota("Registra exercício do plano") },
    "/v1/eu/checagens": { post: rota("Começa a checagem pendente") },
    "/v1/eu/resumos/{episodioId}": { get: rota("Dados e HTML do resumo (PDF é feito no aparelho)") },
    "/v1/eu/dados": { get: rota("Baixar meus dados") },
    "/v1/eu": { delete: rota("Apagar tudo") },
    "/v1/ritmo/entrar": { post: rota("Entra no Ritmo") },
    "/v1/ritmo/sair": { post: rota("Sai do Ritmo") },
    "/v1/ritmo/placar": { get: rota("Placar por equipe (só equipes >= 5)") },
    "/v1/rh/agregados": { get: rota("Agregados setor x mês, k >= 10", zRespostaRh) },
    "/v1/rh/nr1.csv": { get: rota("Relatório NR-1 (CSV agregado)") },
    "/v1/rh/nr1.pdf": { get: rota("Relatório NR-1 (PDF agregado)") },
    "/v1/bench/triage": { post: rota("Só com LEVIA_MODE=bench", undefined, zVinheta, false) },
    "/v1/bench/conversa": { post: rota("Só com LEVIA_MODE=bench", undefined, zRoteiro, false) },
  },
};
const destino = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs/openapi.json");
writeFileSync(destino, JSON.stringify(doc, null, 2) + "\n");
process.stdout.write(`openapi: ${destino}\n`);
