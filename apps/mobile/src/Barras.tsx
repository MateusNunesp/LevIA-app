// Barras horizontais de uma série só (cor única, identidade pelo rótulo, nunca só pela cor).
// Célula suprimida (< 10 pessoas) aparece como "menos de 10", com barra tracejada sem tamanho.
import React from "react";
import { View } from "react-native";
import { Texto, espaco, useTema } from "@levia/ui";

export interface Barra {
  rotulo: string;
  valor: number | null;
  suprimido: boolean;
}

export function Barras({ dados, unidade = "" }: { dados: Barra[]; unidade?: string }) {
  const t = useTema();
  const max = Math.max(1, ...dados.map((d) => d.valor ?? 0));
  return (
    <View style={{ gap: espaco.m }}>
      {dados.map((d) => {
        const valorTexto = d.suprimido ? "menos de 10" : `${d.valor}${unidade}`;
        return (
          <View key={d.rotulo} accessible accessibilityLabel={`${d.rotulo}: ${valorTexto}`} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: espaco.s }}>
              <Texto style={{ flexShrink: 1 }}>{d.rotulo}</Texto>
              <Texto negrito cor={d.suprimido ? t.textoSuave : t.texto}>{valorTexto}</Texto>
            </View>
            {d.suprimido ? (
              <View style={{ height: 12, borderRadius: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.borda }} />
            ) : (
              <View style={{ height: 12, borderRadius: 4, backgroundColor: t.primariaSuave }}>
                <View style={{ width: `${Math.max(2, ((d.valor ?? 0) / max) * 100)}%`, height: 12, borderRadius: 4, backgroundColor: t.primaria }} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
