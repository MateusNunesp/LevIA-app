# Plano de design da LevIA (skill frontend-design)

## Assunto, público e tarefa
App de celular que a empresa oferece para cuidar de dor no corpo. Público: funcionários de qualquer escolaridade, muitas
vezes com dor, às vezes com baixa visão ou usando só a voz. Tarefa principal: responder poucas perguntas sem medo e sair
com uma orientação clara. Tom: calmo, sério sem ser clínico.

## Cor (teoria das cores, a partir do petróleo #1f6f5c, matiz ~166°)
| token | claro | escuro | papel |
|---|---|---|---|
| fundo | #fbfaf7 | #0f1a17 | conversa |
| superficie | #ffffff | #17261f | balões da LevIA, cartões |
| primaria | #1f6f5c | #5fbfa4 | identidade, saída 1, ações |
| primariaProfunda | #12443a | #d6ebe4 | texto forte, topo |
| primariaSuave | #d5e7e0 | #24443a | seixos do mapa, faixas |
| balaoPessoa | #dcefe8 | #1e4a3f | balão do funcionário |
| saida2 (âmbar) | #8a5a00 | #e0b45c | saída 2 |
| urgente (complementar) | #b3261e | #ff8a80 | só saída 3, "vá hoje", emergência |

As três saídas formam uma escala (análoga → meio-termo → complementar), não um semáforo genérico. O vermelho aparece só
onde a urgência é real.

Contraste medido (WCAG): texto/fundo 10,5 (claro) e 15,3 (escuro); texto/balão da pessoa 9,2 e 8,6; texto suave/fundo 6,1 e 9,7;
âmbar/superfície 5,9 e 8,1; urgente/superfície 6,5 e 6,9; branco sobre primária 6,0; branco sobre urgente 6,5. Tudo ≥ AA (4,5).

## Tipo
Uma família só, Atkinson Hyperlegible (feita para baixa visão, cobre os acentos do português). Escala 13/17/20/24, sem
caixa alta em rótulos, `allowFontScaling` em todo texto (fonte dinâmica do sistema).

## Layout
```
┌──────────────────────────────┐
│ (L)  LevIA              [192]│  topo petróleo profundo, botão de emergência vermelho
│      cuidado com a dor…      │
├──────────────────────────────┤
│ [aviso fixo]                 │
│ ┌──────────┐                 │  LevIA à esquerda, com rabinho
│ │ Toque no │                 │
│ │ desenho… │ ●●  ●●          │  prévia do mapa (frente e costas)
│ └──────────┘                 │
│                 ┌──────────┐ │  pessoa à direita
│                 │ lombar   │ │
│                 └──────────┘ │
├──────────────────────────────┤
│ ( Mensagem            ) (🎤) │  microfone vira enviar
└──────────────────────────────┘
```
Texto alinhado à esquerda. Cartões de resultado com uma borda lateral na cor da saída (a borda informa a saída).

## Onde ousar
O mapa do corpo: uma figura feita de "seixos" arredondados e separados por um respiro, frente e costas, que se acendem em
petróleo ao toque, com uma pequena mola (desligada com movimento reduzido). Todo o resto é quieto.

## Revisão do plano contra o briefing
- Fundo creme claro com acento quente é um padrão genérico; aqui o fundo veio do briefing e o acento é frio (petróleo),
  então mantive. Cortei a ideia inicial de um degradê no topo: virou cor sólida.
- Cartões todos iguais com a mesma sombra seriam o "kit SaaS": troquei sombra por hierarquia (balão 18, cartão 14,
  pílula 10) e a borda lateral só nos cartões que carregam uma saída.
- A textura de fundo usa um traço de "pulso" quase invisível, ligado ao Ritmo, em vez do padrão de rabiscos do mensageiro.

## Autocrítica
Sem emulador nem SDK Android nesta máquina, não houve capturas de tela. A crítica visual com o emulador fica pendente
(ver RELATORIO.md).
