# D4 · Saídas 2 e 3 pausam qualquer exercício

**Status:** Aceita

**Decisão:** Vale a D4 sobre a R11. `exerciciosPermitidos` só é true na saída 1; todo plano ativo é pausado ao entrar em 2 ou 3, inclusive por checagem; `GET /v1/eu/plano` não lista exercício de plano pausado; registro em plano pausado é recusado.

**Onde:** `servico.ts`, `ritmo`.
