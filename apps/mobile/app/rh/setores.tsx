import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Texto, espaco, useTema } from "@levia/ui";
import { Bloco, Tela } from "../../src/Tela.tsx";
import { Barras } from "../../src/Barras.tsx";
import { nomeMes, useAgregados } from "../../src/rhDados.ts";

const INDICADORES = [
  { id: "pessoas_ativas", nome: "Pessoas ativas" },
  { id: "saida_1", nome: "Cuidar em casa" },
  { id: "saida_2", nome: "Fisioterapeuta por vídeo" },
  { id: "saida_3", nome: "Atendimento presencial" },
];

export default function Setores() {
  const t = useTema();
  const a = useAgregados();
  const [mes, setMes] = useState<string | null>(null);
  const atual = mes ?? a.mesReferencia;
  return (
    <Tela titulo="Setores" onAtualizar={a.carregar}>
      <Texto cor={t.textoSuave}>{a.aviso}</Texto>
      {/* corte fixo: só o mês. Sem filtros livres combináveis. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.s }} accessibilityRole="tablist">
        {a.meses.map((m) => (
          <Pressable key={m} onPress={() => setMes(m)} accessibilityRole="tab" accessibilityState={{ selected: m === atual }} style={{ minHeight: 44, paddingHorizontal: espaco.l, borderRadius: 22, justifyContent: "center", borderWidth: 1.5, borderColor: t.primaria, backgroundColor: m === atual ? t.primaria : "transparent" }}>
            <Texto negrito cor={m === atual ? t.sobrePrimaria : t.primaria}>{nomeMes(m)}</Texto>
          </Pressable>
        ))}
      </View>
      {atual && INDICADORES.map((ind) => (
        <Bloco key={ind.id}>
          <Texto negrito accessibilityRole="header">{ind.nome}</Texto>
          <Barras dados={a.setores.map((s) => {
            const c = a.pegar(s, atual, ind.id);
            return { rotulo: s, valor: c?.valor ?? null, suprimido: c?.suprimido ?? true };
          })} />
        </Bloco>
      ))}
    </Tela>
  );
}
