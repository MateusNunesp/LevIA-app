# Técnica · SQLite + Drizzle, saúde cifrada em repouso

**Status:** Aceita

**Decisão:** Migrações SQL versionadas (`apps/api/migrations`) e esquema Drizzle espelhado. Dados de saúde (episódio, checagem, estado da conversa) ficam em colunas `*_cifrado` com AES-256-GCM (`LEVIA_CHAVE_DADOS`). Diferença do modelo de dados mínimo: `regiao`, `saida` etc. do episódio vivem dentro do JSON cifrado, não em colunas abertas. Caminho para Postgres: trocar o driver do Drizzle e o tipo das colunas.

**Onde:** `apps/api/src/db`.
