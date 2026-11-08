// Área do RH, dentro do mesmo menu de baixo do app: quem é do RH continua indo para Início, Ritmo, Você etc.
// As três telas do RH ficam numa barra de abas no topo (src/AbasRh.tsx). Só agregados (k >= 10).
import React from "react";
import { Stack } from "expo-router";
import { useTema } from "@levia/ui";

export default function LayoutRh() {
  const t = useTema();
  // Por enquanto, sem restrição por cargo (decisão do time). TODO(login).
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: t.fundo } }}
    />
  );
}
