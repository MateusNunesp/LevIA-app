# Aba Início, "Minha dor piorou" e botão "Ligue 192"

**Status:** Aceita (decisão do time, depois do MVP)

**Decisão:**
- O app abre na aba **Início**, e não mais direto na Conversa (muda a 4.1). O Início tem a frase "Boas-vindas de volta!"
  e três atalhos: **Precisa de ajuda?** (abre a Conversa), **Exercícios pendentes** (abre Exercícios, com o resumo do dia)
  e **Minha dor piorou**. Nada existente foi removido: a Conversa continua com as mesmas regras (respostas só por texto ou
  voz; mapa como primeira pergunta).
- **Minha dor piorou** abre a Conversa com essa mensagem já enviada e pede ao servidor `POST /v1/sessoes {modo: "piora"}`:
  - com plano ativo (saída 1): **checagem extra** agora (nota, trabalho e sinais de alerta de novo), aplicando a D3
    ("qualquer dia, piora forte ou sinal novo → a árvore reavalia"). A checagem extra é gravada com `semana: 0` e não casa
    com as regras de semana da D3. Nenhuma regra clínica nova: com nota > 6 o caso sai da saída 1 (S1 exige nota ≤ 6 →
    saída 2 pela D1); com nota ≥ 8 é caso complexo (saída 3); com alerta, saída 3 com "vá hoje". A agenda das semanas 1, 2,
    4 e 6 não muda.
  - sem plano ativo: autoanamnese nova, com uma frase de acolhida antes do mapa.
- O botão do topo da Conversa diz **"Ligue 192"** (antes "Emergência? Ligue 192", texto da 5.2). Ficou menor na largura,
  mas mantém 44 pt de altura (alvo mínimo de toque). O rótulo para leitor de tela é "Ligue 192, emergência".
- A folha de consentimento do primeiro uso passou para o layout das abas: aparece sobre qualquer aba até a pessoa aceitar.

**TODO(D5):** dizer se uma piora moderada (nota que sobe mas fica ≤ 6) fora das semanas da D3 deve mudar a saída.
Hoje ela mantém a saída 1 e o plano.

**Onde:** `apps/mobile/app/(funcionario)/inicio.tsx`, `conversa.tsx`, `src/Consentimento.tsx`, `apps/api/src/servico.ts`,
`packages/conversation` (`iniciarPiora`, checagem `semana: 0`).
