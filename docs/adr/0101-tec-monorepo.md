# Técnica · Monorepo pnpm, TypeScript estrito, pacotes sem build

**Status:** Aceita

**Decisão:** Pacotes exportam `src/index.ts`; Vitest e tsx rodam TS direto; Metro resolve os pacotes do workspace. `nodeLinker: hoisted` por compatibilidade com o Expo.

**Onde:** raiz.
