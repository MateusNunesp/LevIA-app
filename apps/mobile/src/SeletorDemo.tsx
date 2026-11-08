// Modo demo (marco 14): troca rápida entre perfis para o pitch. Também é o único caminho para o RH sem login.
// TODO(login): remover quando a D13 for definida. Não usar com dados reais.
import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Botao, Texto, espaco, useTema } from "@levia/ui";
import { MODO_DEMO, PERFIS_DEMO, usarPerfilDemo } from "./identidade.ts";
import { useSessao } from "./sessao.tsx";

export function SeletorDemo() {
  const t = useTema();
  const s = useSessao();
  const router = useRouter();
  if (!MODO_DEMO) return null;
  const trocar = async (id: string | null) => {
    await usarPerfilDemo(id);
    await s.recarregar();
    router.replace("/");
  };
  return (
    <View style={{ gap: espaco.s, padding: espaco.l, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.borda }}>
      <Texto negrito>Modo demonstração</Texto>
      <Texto variante="pequeno" cor={t.textoSuave}>Sem login nesta versão. Não use com dados reais.</Texto>
      {PERFIS_DEMO.map((p) => (
        <Botao key={p.id} variante={s.id === p.id ? "primario" : "secundario"} titulo={p.nome} onPress={() => void trocar(p.id)} />
      ))}
      <Botao variante="texto" titulo="Usar este aparelho" onPress={() => void trocar(null)} />
    </View>
  );
}
