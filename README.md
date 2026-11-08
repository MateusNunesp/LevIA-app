# LevIA · MVP

App de celular (Android e iOS, Expo) para cuidar da dor no corpo, com API em Fastify. Não há site.

## Requisitos

- Node 22+ e pnpm (`corepack enable` deixa o comando `pnpm` disponível)
- Celular com Expo Go ou build de desenvolvimento, na mesma rede do computador

## Comandos

| comando | o que faz |
|---|---|
| `pnpm install` | instala tudo |
| `pnpm dev` | sobe a API (porta 3333) e o Expo; o app abre direto na conversa |
| `pnpm demo` | igual, com a empresa de demonstração (`pnpm seed`) e o seletor de perfil (funcionária, colega, RH) |
| `pnpm check` | lint, tipos, fronteiras, unidade, propriedade, contrato, componentes e legibilidade |
| `pnpm e2e` | fluxos Maestro (precisa de celular ou emulador com o app instalado e a API no ar) |
| `pnpm --filter @levia/triage cli --in vinheta.json` | CLI da árvore (contrato com o juiz) |
| `pnpm --filter @levia/api bench:conversa --in roteiro.json` | conversa simulada (contrato com o juiz) |
| `pnpm --filter @levia/api openapi` | gera `docs/openapi.json` |
| `EXPO_PUBLIC_LEVIA_DEMO=1 EXPO_PUBLIC_API_URL=http://localhost:3333 pnpm --filter @levia/mobile apk` | gera o APK de release (`apps/mobile/android/app/build/outputs/apk/release/`) |

## APK e celular Android pelo cabo USB

1. Android SDK em `~/Android/Sdk` e `JAVA_HOME` com um JDK completo (o do Android Studio serve:
   `export JAVA_HOME=/snap/android-studio/current/jbr`). Só o JRE não basta: o build precisa do `javac`.
2. Celular com **Depuração USB** ligada, aparecendo em `adb devices`.
3. API no ar (`pnpm demo` ou `LEVIA_DB=levia-demo.db pnpm --filter @levia/api start`).
4. `adb reverse tcp:3333 tcp:3333`: o celular acessa a API do computador pelo cabo, sem depender do Wi-Fi.
5. Gere o APK (comando na tabela acima) e instale: `adb install -r dist/levia-demo.apk`.
6. Testes de ponta a ponta: `pnpm e2e` (Maestro). O fluxo 05 precisa da API com `LEVIA_HOJE` 7 dias depois do seed.

O APK de demonstração já pronto fica em `dist/levia-demo.apk` e aponta para `http://localhost:3333`, então precisa
do `adb reverse`. Para o júri instalar sem cabo, gere de novo com `EXPO_PUBLIC_API_URL` apontando para uma API
acessível (de preferência HTTPS). O APK de demonstração libera HTTP sem TLS (`usesCleartextTraffic`), só para a demo.

## Variáveis de ambiente

| variável | padrão | uso |
|---|---|---|
| `LEVIA_MODE` | `dev` | `producao`, `dev` ou `bench` (rotas `/v1/bench/*`) |
| `LEVIA_DB` | `levia.db` | arquivo SQLite |
| `LEVIA_CHAVE_DADOS` | chave local gerada em `.levia-chave-dev` | cifra dos dados de saúde; obrigatória em produção |
| `LEVIA_EMPRESA_PADRAO` / `LEVIA_SETOR_PADRAO` | `empresa-demo` / `setor-geral` | onde cai o aparelho novo |
| `LEVIA_NLU` | `mock` | `mock`, `anthropic` ou `nenhuma` |
| `LEVIA_NLU_MODEL` | `claude-haiku-5-5` | modelo da NLU (só no servidor) |
| `ANTHROPIC_API_KEY` | — | só no servidor, nunca no app |
| `LEVIA_PRECO_TOKEN_ENTRADA` / `_SAIDA` | — | preço por token para a M8 (pendente) |
| `LEVIA_HOJE` | data do sistema | fixa o "hoje" (bench, demo de checagem) |
| `EXPO_PUBLIC_API_URL` | IP do Metro, porta 3333 | endereço da API vista do celular |
| `EXPO_PUBLIC_LEVIA_DEMO` | — | `1` liga o seletor de perfil (o `pnpm demo` já faz isso) |

## Estrutura

```
apps/api       servidor Fastify (só API), SQLite + Drizzle, job de retenção
apps/mobile    app Expo: área do funcionário (Conversa, Exercícios, Ritmo, Você) e área do RH
packages/      shared, triage (puro), conversation, redflags, nlu (só servidor), content,
               ritmo, privacy, summary, ui
content/       árvore, catálogo e textos (rascunho para a revisão da D5)
docs/          contrato com o juiz, ADRs, design, acessibilidade, OpenAPI
```

**Não use com dados reais:** sem login (D13 adiada), a área do RH só tem a proteção do seletor de demo.
