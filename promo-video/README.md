# Vídeo promocional da LevIA

Nada aqui é código de produção. Tudo o que o vídeo precisa fica nesta pasta.

## Ambiente de demonstração

1. Dados fictícios (empresa "Horizonte Logística", 115 pessoas, 5 setores, 6 meses, 90 no Ritmo):

   ```bash
   rm -f promo-video/promo.db*
   LEVIA_DB=promo-video/promo.db LEVIA_EMPRESA_PADRAO=empresa-horizonte LEVIA_SETOR_PADRAO=setor-operacoes \
     npx tsx promo-video/seed-promo.ts
   ```

2. API da promo (mesmo código, banco da promo; o celular novo entra no setor Operações):

   ```bash
   cd apps/api && LEVIA_DB=../../promo-video/promo.db LEVIA_EMPRESA_PADRAO=empresa-horizonte \
     LEVIA_SETOR_PADRAO=setor-operacoes PORT=3333 npx tsx src/server.ts
   ```

3. App de gravação: `promo-video/levia-promo.apk`, um build de release **sem** o modo demo (sem o bloco
   "Modo demonstração"), apontando para `http://localhost:3333`.

   ```bash
   adb install -r promo-video/levia-promo.apk && adb shell pm clear br.com.levia.app
   adb reverse tcp:3333 tcp:3333
   ```

   Para gerar de novo: `EXPO_PUBLIC_API_URL=http://localhost:3333` e **sem** `EXPO_PUBLIC_LEVIA_DEMO`. Antes,
   apague `apps/mobile/android/app/build/generated/{assets,res}/react`, porque o Gradle reaproveita o pacote JS antigo.

## O que é mock

- NLU: mock local (não chama a Anthropic). O leitor determinístico entende as respostas do roteiro.
- Sem login (D13 adiada): o aparelho ganha um identificador provisório. A aba RH está aberta a todos
  (`LEVIA_RH_PARA_TODOS`, padrão).
- API local no computador, acessada pelo cabo USB (`adb reverse`).

## Gravar e editar

- `python3 promo-video/gravar.py`: grava as 9 cenas no celular (`promo-video/gravacao/c0N-*.mp4`).
  Uma cena só: `python3 promo-video/gravar.py c05` (as cenas dependem do estado da anterior; para refazer
  desde o começo, rode tudo). No fim: `python3 promo-video/gravar.py restaurar` (devolve tema, toques e barra
  de status do celular).
- `python3 promo-video/montar.py`: monta o vídeo final, o GIF, a thumbnail e a narração em `promo-video/output/`.
  Para refazer só uma cena da edição: `python3 promo-video/montar.py s05`. Cortes, velocidades, textos e zoom de
  cada cena ficam na lista `CENAS` no topo do `montar.py`.
- Requisitos: `ffmpeg` (apt), Python 3 com Pillow, Android SDK (adb) e o celular pelo cabo.
