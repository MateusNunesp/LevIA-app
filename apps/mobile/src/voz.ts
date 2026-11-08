// Voz (D7): reconhecimento NATIVO do sistema, pedindo o modo no aparelho quando existir.
// O áudio nunca vai para o servidor da LevIA: só a transcrição, depois que a pessoa vê e confirma.
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export interface SpeechToText {
  disponivel(): boolean;
  noAparelho(): boolean;
  pedirPermissao(): Promise<boolean>;
  iniciar(): void;
  parar(): void;
  cancelar(): void;
}

export const sttNativo: SpeechToText = {
  disponivel: () => {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  },
  noAparelho: () => {
    try {
      return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      return false;
    }
  },
  pedirPermissao: async () => {
    try {
      return (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  },
  iniciar: () => {
    const local = sttNativo.noAparelho();
    ExpoSpeechRecognitionModule.start({
      lang: "pt-BR",
      interimResults: true,
      continuous: false,
      // pede o modo local quando o sistema oferece
      requiresOnDeviceRecognition: local,
      addsPunctuation: true,
    });
  },
  parar: () => ExpoSpeechRecognitionModule.stop(),
  cancelar: () => ExpoSpeechRecognitionModule.abort(),
};

/** Leitura em voz alta (TTS do sistema, pt-BR). Se não houver voz, o fluxo segue por texto. */
export function falar(texto: string, aoTerminar?: () => void): void {
  Speech.stop();
  Speech.speak(texto, { language: "pt-BR", rate: 0.95, onDone: aoTerminar, onError: aoTerminar });
}

export function pararFala(): void {
  Speech.stop();
}
