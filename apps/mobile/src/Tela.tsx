import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Texto, espaco, useTema } from "@levia/ui";

export function Tela({
  titulo,
  children,
  onAtualizar,
  atualizando,
}: {
  titulo: string;
  children: React.ReactNode;
  onAtualizar?: () => void;
  atualizando?: boolean;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.fundo }}
        contentContainerStyle={{
          paddingTop: insets.top + espaco.l,
          paddingHorizontal: espaco.l,
          paddingBottom: espaco.xl * 2,
          gap: espaco.l,
        }}
        refreshControl={
          onAtualizar ? (
            <RefreshControl
              refreshing={!!atualizando}
              onRefresh={onAtualizar}
              tintColor={t.primaria}
              colors={[t.primaria]}
              progressBackgroundColor={t.superficie}
            />
          ) : undefined
        }
      >
        <Texto variante="titulo" accessibilityRole="header">
          {titulo}
        </Texto>
        {children}
      </ScrollView>
      {/* fundo atrás da barra de status: o conteúdo rolado não passa por baixo do relógio */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: t.fundo,
        }}
      />
    </View>
  );
}

export function Bloco({ children, cor }: { children: React.ReactNode; cor?: string }) {
  const t = useTema();
  return (
    <View
      style={{
        backgroundColor: t.superficie,
        borderRadius: 14,
        padding: espaco.l,
        gap: espaco.s,
        borderLeftWidth: cor ? 5 : 0,
        borderLeftColor: cor,
      }}
    >
      {children}
    </View>
  );
}

export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
