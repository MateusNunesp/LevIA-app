# Técnica · NLU atrás de `NluProvider`

**Status:** Aceita

**Decisão:** Mock determinístico por padrão; Anthropic com `messages.parse` + `zodOutputFormat`, `effort: low`, sem raciocínio estendido, `max_tokens` 300, `maxRetries: 1`, cache da aplicação por texto normalizado e prompt fixo marcado para prompt caching. A IA só acrescenta alerta: "nenhuma" dita pela IA vira repergunta um sinal por vez. Falha da IA → leitor determinístico e reperguntas simples.

**Onde:** `packages/nlu`, `conversation.lerNlu`.
