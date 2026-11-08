import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible";
import { TemaProvider, useTema } from "@levia/ui";
import { SessaoProvider } from "../src/sessao.tsx";

function Raiz() {
  const t = useTema();
  return (
    <>
      <StatusBar style={t.escuro ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.fundo } }} />
    </>
  );
}

export default function Layout() {
  const [ok] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  if (!ok) return null;
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <SessaoProvider>
          <Raiz />
        </SessaoProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}
