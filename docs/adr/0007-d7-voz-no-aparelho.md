# D7 · Voz no aparelho

**Status:** Aceita

**Decisão:** `expo-speech-recognition` com `requiresOnDeviceRecognition` quando `supportsOnDeviceRecognition()`; senão, aviso único e opção de digitar. O áudio nunca vai para o servidor da LevIA; a rota aceita só texto.

**Onde:** `apps/mobile/src/voz.ts`.
