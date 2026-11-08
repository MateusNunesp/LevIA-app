import React from "react";
import { Tabs } from "expo-router";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { fonte, useTema } from "@levia/ui";

function Icone({ nome, cor }: { nome: string; cor: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {nome === "conversa" && <Path d="M4 5h16v11H9l-5 4z" fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" />}
      {nome === "exercicios" && <><Circle cx={12} cy={5} r={2.5} fill={cor} /><Path d="M5 10l7 1 7-1M12 11v5l-3 5M12 16l3 5" stroke={cor} strokeWidth={2} fill="none" strokeLinecap="round" /></>}
      {nome === "ritmo" && <Path d="M3 13h4l2-6 4 12 2-6h6" stroke={cor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {nome === "voce" && <><Circle cx={12} cy={8} r={4} fill="none" stroke={cor} strokeWidth={2} /><Rect x={4} y={15} width={16} height={6} rx={3} fill="none" stroke={cor} strokeWidth={2} /></>}
    </Svg>
  );
}

export default function Abas() {
  const t = useTema();
  const aba = (nome: string, titulo: string) => ({
    title: titulo,
    tabBarAccessibilityLabel: titulo,
    tabBarIcon: ({ color }: { color: unknown }) => <Icone nome={nome} cor={String(color)} />,
  });
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: t.primaria,
        tabBarInactiveTintColor: t.textoSuave,
        tabBarStyle: { backgroundColor: t.superficie, borderTopColor: t.borda, minHeight: 60 },
        tabBarLabelStyle: { fontFamily: fonte.regular, fontSize: 13 },
        tabBarAllowFontScaling: true,
      }}
    >
      <Tabs.Screen name="conversa" options={aba("conversa", "Conversa")} />
      <Tabs.Screen name="exercicios" options={aba("exercicios", "Exercícios")} />
      <Tabs.Screen name="ritmo" options={aba("ritmo", "Ritmo")} />
      <Tabs.Screen name="voce" options={aba("voce", "Você")} />
    </Tabs>
  );
}
