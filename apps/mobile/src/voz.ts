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

// Voz em português do Brasil. Com o celular em outro idioma (ex.: en-US), alguns motores (como o da Samsung)
// ignoram language: "pt-BR" e leem com a voz padrão, em inglês. Por isso escolhemos a voz pelo identificador.
let vozPt: string | null | undefined; // undefined = ainda não procurou; null = não há voz em português

const normalizar = (idioma: string) => idioma.toLowerCase().replace(/_/g, "-");

async function escolherVozPt(): Promise<string | null> {
  if (vozPt !== undefined) return vozPt;
  try {
    const vozes = await Speech.getAvailableVoicesAsync();
    const brasil = vozes.filter((v) => /^(pt-br|por-bra)/.test(normalizar(v.language)));
    const portugues = brasil.length
      ? brasil
      : vozes.filter((v) => /^(pt|por)\b/.test(normalizar(v.language)));
    // prefere a voz de melhor qualidade e que não depende de internet
    const ordenadas = [...portugues].sort((a, b) => {
      const q = (v: Speech.Voice) => (v.quality === Speech.VoiceQuality.Enhanced ? 0 : 1);
      const rede = (v: Speech.Voice) => (/network/i.test(v.identifier) ? 1 : 0);
      return q(a) - q(b) || rede(a) - rede(b);
    });
    vozPt = ordenadas[0]?.identifier ?? null;
  } catch {
    vozPt = null;
  }
  return vozPt;
}

/** O celular tem alguma voz em português para ler as mensagens? */
export async function temVozPt(): Promise<boolean> {
  return (await escolherVozPt()) !== null;
}

/** Leitura em voz alta (TTS do sistema, pt-BR). Se não houver voz, o fluxo segue por texto. */
export function falar(texto: string, aoTerminar?: () => void): void {
  void Speech.stop();
  void escolherVozPt().then((voz) => {
    Speech.speak(texto, {
      language: "pt-BR",
      ...(voz ? { voice: voz } : {}),
      rate: 0.95,
      onDone: aoTerminar,
      onError: aoTerminar,
    });
  });
}

export function pararFala(): void {
  Speech.stop();
}
