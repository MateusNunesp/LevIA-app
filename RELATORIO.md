# Relatório do MVP da LevIA

Este repositório nasceu do branch `mvp-do-zero` de `MattHenri/LevIA`, onde o MVP foi construído do zero.
O APK de demonstração está nos Releases (tag `v0.1.0-demo`).

> **Fonte usada:** só o prompt. O `projeto.html` não existe nesta pasta, e o pedido foi usar apenas o prompt e
> ignorar arquivos que já existiam. Por isso nada aqui foi conferido com o `projeto.html`. Também não existem
> `bench/`, `lab/` nem `hackathon-*.html` aqui; nenhum foi criado nem editado.

## 1. O que foi feito, marco a marco

| # | Marco | Estado | Onde |
|---|---|---|---|
| 1 | Monorepo pnpm, `tsc --strict`, lint de fronteiras, `pnpm check` | feito | raiz, `.dependency-cruiser.cjs`, `eslint.config.mjs` |
| 2 | `content` (schemas) + `triage` (com STarT Back) + `redflags` + testes; M1 conferida | feito | `packages/content`, `packages/triage`, `packages/redflags` |
| 3 | Rascunhos `arvore.v1.yaml`, `exercicios.yaml` (13 exercícios), `pt-BR.yaml` | feito, tudo `precisa_de_revisao` | `content/` |
| 4 | `conversation` (roteiro, confirmação, checagens D3) + CLI do juiz | feito | `packages/conversation`, `packages/triage/bin/cli.ts` |
| 5 | API + banco + identificador provisório + consentimento + retenção | feito | `apps/api` |
| 6 | Plano de design (skill frontend-design) + `ui` + app do funcionário | feito, **sem capturas de tela** (ver 6) | `docs/design.md`, `packages/ui`, `apps/mobile` |
| 7 | Voz nativa (no aparelho quando houver) + TTS + modo só voz | feito no código; **não testado em aparelho** | `apps/mobile/src/voz.ts` |
| 8 | `nlu` mock + Anthropic + cache + registro de tokens | feito; o provedor real foi testado com cliente falso, **sem chamada real** | `packages/nlu` |
| 9 | Saídas, resumo em PDF no aparelho, plano, pausa D4, notificações locais | feito | `conversation/resultado.ts`, `apps/mobile/src/pdf.ts`, `notificacoes.ts` |
| 10 | `ritmo` + aba Ritmo | feito | `packages/ritmo`, `app/(funcionario)/ritmo.tsx` |
| 11 | `privacy` + área do RH + NR-1 (PDF e CSV) | feito | `packages/privacy`, `app/rh/*` |
| 12 | Tela Você (baixar, apagar, revogar) | feito | `app/(funcionario)/voce.tsx` |
| 13 | Acessibilidade, legibilidade, guardrails | feito (lint a11y, script de legibilidade, 32 pedidos adversariais) | |
| 14 | `seed-demo.ts` + modo demo com troca de perfil | feito | `scripts/seed-demo.ts`, `apps/mobile/src/SeletorDemo.tsx` |
| 15 | Relatório | este arquivo | |

**Estado da verificação local:** `pnpm check` termina com código 0, com lint, tipos (pacotes, API e app),
fronteiras (80 módulos), 218 testes Vitest, 5 testes de componente (Jest + React Native Testing Library) e
legibilidade. O bundle Android do Metro compila (`expo export --platform android`).

**Testado num celular de verdade** (Samsung Galaxy S24, Android 16, pelo cabo USB), com o APK de release em
`dist/levia-demo.apk` e a API de demo pelo `adb reverse`. Veja a seção 7.

**Ainda não testado:** VoiceOver (precisa de iPhone e de Mac para o build) e a NLU da Anthropic com chamada real
(precisa de `ANTHROPIC_API_KEY`).

## 2. Testes por meta (o oficial é o juiz)

| Meta | O que os testes do app mostram |
|---|---|
| **M1** | Uma vinheta por regra de alerta (13), propriedade com 1000 combinações aleatórias ("qualquer sinal de alerta → 3 com vá hoje"), alerta escondido em texto livre → pergunta fechada → saída 3 com "Vá hoje…", ambíguo duas vezes = presente, IA não consegue remover alerta. O carregador recusa árvore com regra de alerta depois de regra comum. |
| M2 | Sem gabarito local: não dá para medir concordância aqui. |
| M3 | Caso complexo (nota ≥ 8, trauma, piora rápida, não mexe) sempre na saída 3; propriedade: saída 1 nunca tem achado nenhum. |
| M4 | Menção vaga não marca sinal: só gera uma pergunta fechada. Negação ("não tenho febre") não dispara. Risco: veja a contradição 3 na seção 5. |
| M5 | Lombar por texto: **15 perguntas do roteiro + 1 confirmação = 16**, tempo simulado de 203 s. No celular, o fluxo completo do Maestro levou ~3 min 46 s, contando a digitação automática. Pescoço, ombros e meio das costas também dão 15 + 1. **Se o juiz contar a confirmação, a M5 falha por 1.** A decisão é do time (seção 4). |
| M6 | Lint de a11y sem erro; testes de componente dos rótulos. **No celular:** auditoria da árvore de acessibilidade (o que o TalkBack lê): 0 controle sem rótulo, 0 alvo menor que 44 pt na conversa e no mapa (frente e costas), cada região uma vez só, como caixa de seleção com estado. Voz real no aparelho funcionou (seção 7). Falta ouvir o TalkBack de ponta a ponta (`docs/acessibilidade.md`) e todo o VoiceOver. |
| M7 | Teste de contrato (só campos permitidos, nenhum id nem data), k ≥ 10, ataque por subtração em 5 empresas com setores pequenos (falha), filtro livre recusado (400), funcionário recebe 403 nas rotas do RH. |
| M8 | O leitor determinístico entende as respostas comuns sem IA; nos roteiros de exemplo, 0 token. Cache por texto normalizado. Tokens registrados em `uso_ia`. Preço por token pendente. |
| M9 | Dose máxima, duplicado, pausa neutra, equipe < 5, trapaceiro (limite diário, retroativo > 24 h, fora do plano). |
| M10 | 32 pedidos adversariais → resposta padrão aprovada, sem exercício. Saídas 2 e 3 sem exercício (propriedade). Nenhum texto do app sugere repouso, cinta, exame de rotina ou remédio. |
| M11 | Propriedade de determinismo do motor (500 casos) e da conversa (mesmo roteiro → mesmos textos). |
| M12 | 100 textos medidos (Flesch adaptado, corte 50), média 87, nenhum abaixo do corte. 29 fragmentos curtos não são medidos. |

## 3. TODOs e pendências

- **TODO(login) / D13:** sem login. O identificador do aparelho é o token; a área do RH abre pelo seletor do modo
  demo, **sem proteção de acesso. Não usar com dados reais.** (`apps/api/src/app.ts`, `servico.ts`,
  `apps/mobile/src/identidade.ts`, `SeletorDemo.tsx`, `migrations/0001_init.sql`)
- **TODO(M8):** preço por token (`LEVIA_PRECO_TOKEN_ENTRADA` e `_SAIDA`). Sem ele, `custoReais` sai `null`.
- **TODO(D5):** revisão de todo o conteúdo. O corte de legibilidade (50) e a lista de regiões com saída 1
  (lombar, pescoço, ombros, meio das costas, punhos e mãos) também precisam de revisão.
- **TODO(D5) STarT Back:** os 9 itens foram escritos **a partir de memória, em linguagem simples**. Precisam ser
  trocados pelo texto oficial da versão brasileira validada. Fora da lombar, o resultado vai marcado no resumo.
- Licença comercial do STarT Back com a Keele.
- Validação jurídica da retenção (D12) e do consentimento.
- Registro do nome Ritmo no INPI.
- Roteiro de ouvido do TalkBack (`docs/acessibilidade.md`) e todo o VoiceOver/iOS.
- APK para o júri sem cabo: gerar com `EXPO_PUBLIC_API_URL` de uma API acessível (HTTPS) e tirar o `usesCleartextTraffic`.
- Chamada real à Anthropic: rodar `bench:conversa --nlu anthropic` com `ANTHROPIC_API_KEY` e conferir
  `usage.cache_read_input_tokens`. O prompt fixo é curto e pode não entrar no cache da API.

## 4. Conteúdo ainda `precisa_de_revisao`

- `content/arvore/arvore.v1.yaml`: sinais de alerta, perguntas agrupadas, cortes da D3 e regras.
- `content/catalogo/exercicios.yaml` e os 13 exercícios (`EX-LOMBAR-*`, `EX-PESCOCO-*`, `EX-OMBRO-*`,
  `EX-COSTAS-*`, `EX-PUNHO-*`).
- `content/textos/pt-BR.yaml`: todos os textos, inclusive STarT Back, guardrails e emergência.

## 5. Contradições e decisões tomadas aqui

1. **6.2 x 4.2 e 11:** a estrutura de pastas cita `QuickReplies` e `PainScale` no `ui`, mas o resto do prompt proíbe
   botões de resposta e cartão de escala na conversa. **Não foram criados.**
2. **6.4:** `resposta.origem` inclui `botao`, que não existe no MVP. Ficou `texto | voz | mapa`.
3. **M1 x M4:** a M1 manda todo sinal de alerta para "vá hoje"; a M4 pede pouca sobretriagem "inclusive com bandeira
   isolada comum". Aqui, sinais isolados como "já teve câncer" ou "osteoporose" vão para a saída 3 com "vá hoje".
   A D5 precisa dizer quais bandeiras isoladas devem só subir a saída sem "vá hoje".
4. **M5:** 1 mapa + duração + nota + 3 grupos de alerta + 9 itens do STarT = 15, e a confirmação (R3) é a 16ª.
   Para caber, o último grupo de alerta da lombar junta queda/batida, dor à noite, piora rápida e não conseguir
   apoiar. Falta o time dizer se a confirmação conta. Com mais de uma região marcada, ou com reperguntas, passa de 15.
   Os sinais de alerta nunca são pulados para economizar perguntas.
5. **"Dor nas costas"** sem detalhe vira lombar, porque a lombar tem a lista de alerta mais completa (D1).
6. **Trauma:** na coluna é sinal de alerta (vá hoje). Fora dela é caso complexo (saída 3 sem urgência).
7. **Regiões sem exercício no catálogo** (cotovelo, quadril, joelho, tornozelo) nunca vão para a saída 1, mesmo em
   caso leve: vão para a 2 (D1, "sem regra → 2").
8. **"Acho que não"** vale como "não" em perguntas comuns, mas em sinal de alerta é ambíguo: a LevIA repergunta
   um sinal por vez e, se continuar ambíguo, conta como presente.
9. **Semana 6 "não recuperado":** é uma pergunta direta ("Você sente que já melhorou?"), para não inventar um número.
10. **Modo só voz:** a transcrição vai direto, sem o balão "Editar". A confirmação final (R3) protege a resposta.
11. **Modelo de dados:** `regiao`, `saida` etc. do episódio ficam dentro do JSON cifrado (dado de saúde em repouso),
    e não em colunas abertas (ADR 0102).
12. **"Pessoas ativas" no RH** = pessoas com autoanamnese no mês.
13. **Pequenos textos de interface** (rótulos de botão, "Você marcou: …", mensagens do "Fiz!") estão no app. Não são
    orientação de saúde, mas, se o time quiser tudo em `content/textos`, é uma troca simples.

## 6. Como abrir o app no celular

1. `corepack enable` (deixa o `pnpm` disponível) e `pnpm install`, na pasta `app/`.
2. `pnpm demo` (dados de demo e seletor de perfil) ou `pnpm dev`. A API sobe na porta 3333; o Expo mostra um QR code.
3. No celular, na mesma rede Wi-Fi: abra o QR code. O reconhecimento de voz é um módulo nativo, então use um
   **build de desenvolvimento** (`cd apps/mobile && npx expo run:android`, com Android SDK). No Expo Go, a
   conversa por texto funciona, mas a voz fica indisponível e o app cai para texto.
4. Se o celular não achar a API, defina `EXPO_PUBLIC_API_URL=http://<ip-do-computador>:3333`.
5. O app abre direto na conversa: folha de consentimento → mapa do corpo. No modo demo, a aba **Você** tem o seletor
   de perfil (funcionária, colega da mesma equipe, RH).

## 7. Testes no celular (Galaxy S24, Android 16)

**Funcionou:**
- abre direto na conversa, com a folha de consentimento e o mapa como primeira pergunta;
- mapa de frente e de costas, marcar e desmarcar regiões, envio;
- conversa completa só por texto até a saída 1 (cartão, resumo, exercícios com dose, data da checagem);
- **alerta escondido** ("não consigo segurar o xixi") → pergunta fechada → saída 3 com **"Vá hoje a um pronto atendimento."**;
- "Por quê?" abre a regra em linguagem simples;
- plano **pausado** depois da saída 3 (D4);
- **checagem da semana 1** na conversa, com a próxima data;
- **fila offline**: com a conexão caída aparece o aviso, e a mensagem sai sozinha quando a conexão volta;
- **voz real:** "dói a lombar" e "faz uns três dias" transcritas e entendidas pelo leitor determinístico, sem IA. Os logs
  mostram o reconhecimento *on-device* do Google (SODA), e a API só recebeu texto;
- área do RH pelo seletor de demo: só agregados, "menos de 10" nas células pequenas, PDF do NR-1;
- apagar tudo volta para o consentimento.

**Bugs que só apareceram no celular, todos corrigidos:**
1. **O teclado cobria a caixa de mensagem** (Android de ponta a ponta não redimensiona a tela). Agora o
   `KeyboardAvoidingView` usa `padding`, a barra de abas some com o teclado e o Enter envia.
2. **"Apagar tudo", "Sair do Ritmo" e "Parar a triagem" davam erro 400**: o app mandava `content-type: application/json`
   sem corpo. Corrigido no app e na API, com teste de regressão.
3. **O resultado ficava fora da tela**: a lista rolava até o fim e o "Vá hoje" sumia acima. Agora a tela para no começo
   do cartão do resultado e fecha o teclado.
4. **Acessibilidade:** a prévia do mapa expunha 16 alvos minúsculos ao leitor de tela (agora é um botão só), a área
   dos pés ficava com 41 pt (agora 44) e as metades de um par apareciam duas vezes (agora uma).
5. **Visual:** topo claro no modo escuro (agora escuro nos dois, em duas linhas), "rabinho" solto do balão, pouco
   contraste do mapa no escuro, aviso de "sem conexão" que não sumia, indicador branco de atualização e painel do RH
   abrindo no mês com poucos dados (agora abre no último mês com 10 pessoas ou mais).

**Fluxos Maestro:** os 7 passaram no celular. 01, 02, 03, 04, 06 e 07 passaram no APK final; o 05 (checagem) passou no
build anterior, com a API em `LEVIA_HOJE=2026-11-12`. As mudanças seguintes (teclado, acessibilidade do mapa) não
tocam a checagem, mas o 05 não foi repetido no APK final.
Precisam da API no ar e do `adb reverse tcp:3333 tcp:3333`.

## 8. Depois do MVP: aba Início (decisão do time)

- O app agora **abre no Início** ("Boas-vindas de volta!"), com os atalhos **Precisa de ajuda?**, **Exercícios
  pendentes** e **Minha dor piorou**. Isso muda a 4.1 ("abre direto na Conversa"), por decisão do time. O resto não mudou.
- **Minha dor piorou:** com plano ativo, vira uma checagem extra na hora, com os sinais de alerta de novo (D3); sem plano,
  vira uma autoanamnese nova. Nenhuma regra clínica nova (ADR 0016). Pendente para a D5: piora moderada fora das semanas.
- O botão do topo da conversa diz **"Ligue 192"** e ficou menor (continua com 44 pt de altura).
- Testes automáticos novos: 4 na API (sem plano, piora leve, nota 7 → saída 2, alerta novo → saída 3 com "vá hoje"),
  3 no motor (checagem extra não dispara regras de semana; nota 7 sai da saída 1; nota 8 e alerta → saída 3) e 3 na
  conversa. Fluxos Maestro novos: `08-inicio`, `09-piora-com-plano`, `10-piora-com-alerta` e `11-ligue-192`.
- **No celular (Galaxy S24), os 11 fluxos passaram** com o APK do repositório novo: 10 numa bateria de 17 min e o 05 com
  a API em `LEVIA_HOJE=2026-11-12`.
- Bugs que a bateria pegou e foram corrigidos: (1) na primeira vez que a conversa abria pelo "Minha dor piorou", o app
  começava duas conversas (dois mapas); (2) no fim de uma checagem, o teclado ficava aberto e escondia as abas.

## 9. Bateria do Ritmo e de outras áreas (sem a conversa)

**Bugs encontrados e corrigidos:**
1. **Laço de pedidos ao servidor.** Com a aba Ritmo aberta, o app pedia o placar ~28 vezes por segundo, sem parar. A aba
   Exercícios e a checagem da conversa também entravam em laço. Isso gastava bateria e internet, sobrecarregava o
   servidor e apagava a mensagem de erro antes de ela aparecer. Causa: `useTexto` devolvia uma função nova a cada render,
   e ela estava nas dependências do "carregar ao focar a aba". Agora a função é memorizada. Medição no celular: **0
   pedidos em 10 s** com qualquer aba parada. Há um teste de regressão (`apps/mobile/test/sessao.test.tsx`), e conferi
   que ele falha sem a correção.
2. **Sair e entrar de novo no Ritmo no mesmo dia dava erro interno.** O consentimento e a participação tentavam gravar
   linhas com a mesma chave. Agora a mesma linha é reaproveitada.
3. **Apelido repetido na mesma equipe era aceito.** Agora é recusado, sem diferença de maiúsculas e acentos ("Ana" =
   "ana"), com a mensagem "Alguém da sua equipe já usa esse apelido". Em outra equipe pode.
4. **O dia de hoje contava contra antes de acabar** (de manhã, quem ainda não tinha feito parecia ter falhado). Agora
   hoje só conta depois de cumprido.
5. **Equipe só com pessoas em pausa aparecia com 0%**, o que contraria a D6. Agora aparece "sem dias que contam
   ainda", sem posição no ranking.
6. **Apelidos fora de ordem** ("Colega 10" antes de "Colega 2"). Agora em ordem natural.
7. **Mensagem de erro enganosa** ao entrar no Ritmo: dizia sempre "use um apelido de 2 a 20 letras". Agora cada erro
   tem a mensagem certa.
8. **Confirmação do "Fiz!" no topo da tela**, fora de vista em exercícios mais abaixo. Agora aparece abaixo do botão
   tocado e é anunciada ao leitor de tela. O botão evita registro duplo e vira "Feito hoje" no limite da dose.
9. **Visual:** ao rolar, o conteúdo passava por baixo do relógio (agora há um fundo atrás da barra de status). Quando a
   equipe da pessoa ainda não aparece no ranking, há uma explicação ("Sua equipe aparece aqui quando tiver pelo menos
   5 pessoas no Ritmo").

**Testes:** 10 testes novos na API do Ritmo (`apps/api/test/ritmo.test.ts`) e 1 de regressão no app. Fluxos Maestro
novos: `12-ritmo-entrar-sair`, `13-ritmo-apelido-repetido`, `14-ritmo-fiz`, `15-voce-dados`, `16-revogar-triagem` e
`17-rh-setores`. **Os 6 passaram no celular.** Por pedido do time, os fluxos da conversa não rodaram nesta bateria.
Na anterior, todos passaram, mas eles ainda não rodaram com as correções de agora (`useTexto` memorizado e o fundo
atrás da barra de status também mexem na conversa).

## 10. Menu único e área do RH aberta a todos (decisão do time, provisória)

- **Um menu de baixo só para o app inteiro:** Início, Conversa, Exercícios, Ritmo, Você e **RH**. Na área do RH, as três
  telas (Visão geral, Setores, Relatório NR-1) ficam em abas no topo, e o menu de baixo continua levando de volta à Home
  e ao resto do app.
- **Por enquanto, a aba RH aparece para todos**, e qualquer aparelho registrado lê os agregados
  (`LEVIA_RH_PARA_TODOS`, ligada por padrão). As rotas do RH continuam devolvendo **só agregados com k ≥ 10**.
  TODO(login): desligar (`LEVIA_RH_PARA_TODOS=0`) quando houver login; isso muda a 4.8, que separava a área do RH por papel.
- **Quem tem papel de RH também usa a própria área de funcionário** (os próprios dados). O RH continua sem ver dado
  de outra pessoa.
- Com 6 abas, os rótulos usam 12 pt (antes 13), para "Exercícios" caber inteiro.
- Testes: 2 testes novos na API (RH na própria área de funcionário; agregados para todos com a chave ligada).

