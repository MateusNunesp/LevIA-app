// Vídeos curtos dos exercícios (MVP). Só os que batem com os passos do catálogo.
// Fonte: Pexels, série de Maksim Goncharenok (licença Pexels: uso livre, sem crédito obrigatório,
// sem sugerir que a pessoa do vídeo endossa o produto). TODO(D5): o fisioterapeuta revisor aprova cada vídeo.
//   EX-OMBRO-CIRCULOS ← https://www.pexels.com/video/young-woman-doing-a-shoulder-exercise-5510073/ (540p)
import React, { useEffect } from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { espaco, useReduzirMovimento, useTema } from "@levia/ui";

/* eslint-disable @typescript-eslint/no-require-imports */
const VIDEOS: Record<string, number> = {
  "EX-OMBRO-CIRCULOS": require("../assets/exercicios/ombro-circulos.mp4"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** O vídeo do exercício para o cartão, ou undefined (o cartão mostra o desenho de sempre). */
export function midiaDoExercicio(exercicioId: string, nome: string): React.ReactNode | undefined {
  const fonte = VIDEOS[exercicioId];
  return fonte === undefined ? undefined : <VideoExercicio fonte={fonte} nome={nome} />;
}

function VideoExercicio({ fonte, nome }: { fonte: number; nome: string }) {
  const t = useTema();
  const reduzir = useReduzirMovimento();
  const player = useVideoPlayer(fonte, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // Com "reduzir movimento" ligado, nada toca sozinho: a pessoa usa os controles se quiser.
  // No Android, um play() pedido antes de o vídeo carregar pode se perder: por isso pedimos de novo
  // quando o player fica pronto (readyToPlay).
  useEffect(() => {
    if (reduzir) {
      player.pause();
      return;
    }
    player.play();
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay" && !player.playing) player.play();
    });
    return () => sub.remove();
  }, [reduzir, player]);
  return (
    <View
      style={{
        height: 320,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: espaco.m,
        backgroundColor: t.primariaSuave,
      }}
      accessible
      accessibilityLabel={`Vídeo curto, sem som, mostrando o exercício ${nome}`}
    >
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        nativeControls={reduzir}
      />
    </View>
  );
}
