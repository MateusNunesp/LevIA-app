# Técnica · zod na entrada e na saída, sem plugin

**Status:** Aceita

**Decisão:** Cada rota passa o corpo por `entrada(schema)` e a resposta por `saida(schema)`; falha de saída vira 500 sem vazar dado. OpenAPI gerado em `docs/openapi.json` (`pnpm --filter @levia/api openapi`).

**Onde:** `apps/api/src/app.ts`, `openapi.ts`.
