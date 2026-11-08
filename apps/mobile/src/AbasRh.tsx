// Abas do topo da área do RH (Visão geral, Setores, Relatório NR-1). O menu de baixo é o mesmo do app inteiro.
import React from "react";
import { Pressable, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { ALVO_MINIMO, Texto, espaco, useTema } from "@levia/ui";

const ABAS = [
  { rota: "/rh", titulo: "Visão geral" },
  { rota: "/rh/setores", titulo: "Setores" },
  { rota: "/rh/nr1", titulo: "Relatório NR-1" },
] as const;

export function AbasRh() {
  const t = useTema();
  const router = useRouter();
  const rota = usePathname();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: t.primaria,
        overflow: "hidden",
      }}
    >
      {ABAS.map((a) => {
        const ativa = rota === a.rota;
        return (
          <Pressable
            key={a.rota}
            onPress={() => !ativa && router.replace(a.rota)}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativa }}
            accessibilityLabel={a.titulo}
            style={{
              flex: 1,
              minHeight: ALVO_MINIMO,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: espaco.xs,
              backgroundColor: ativa ? t.primaria : "transparent",
            }}
          >
            <Texto variante="pequeno" negrito cor={ativa ? t.sobrePrimaria : t.primaria} numberOfLines={1}>
              {a.titulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}
