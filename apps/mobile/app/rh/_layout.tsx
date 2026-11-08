// Área do RH: mesma app, área separada por papel. Só agregados (k >= 10).
import React from "react";
import { Redirect, Tabs } from "expo-router";
import { fonte, useTema } from "@levia/ui";
import { useSessao } from "../../src/sessao.tsx";

export default function AbasRh() {
  const t = useTema();
  const s = useSessao();
  if (s.pronto && s.papel !== "rh") return <Redirect href="/conversa" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primaria,
        tabBarInactiveTintColor: t.textoSuave,
        tabBarStyle: { backgroundColor: t.superficie, borderTopColor: t.borda, minHeight: 60 },
        tabBarLabelStyle: { fontFamily: fonte.regular, fontSize: 13 },
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Visão geral" }} />
      <Tabs.Screen name="setores" options={{ title: "Setores" }} />
      <Tabs.Screen name="nr1" options={{ title: "Relatório NR-1" }} />
    </Tabs>
  );
}
