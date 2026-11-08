// Sem tela de entrar (login fora do MVP): o app abre direto na Conversa.
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { Botao, Texto, useTema } from "@levia/ui";
import { useSessao } from "../src/sessao.tsx";

export default function Inicio() {
  const s = useSessao();
  const t = useTema();
  if (!s.pronto) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.primaria} accessibilityLabel="Carregando" /></View>;
  if (s.erro)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Texto variante="destaque" negrito>Não foi possível falar com a LevIA.</Texto>
        <Texto>Confira a internet e tente de novo.</Texto>
        <Botao titulo="Tentar de novo" onPress={() => void s.recarregar()} />
      </View>
    );
  return <Redirect href={s.papel === "rh" ? "/rh" : "/conversa"} />;
}
