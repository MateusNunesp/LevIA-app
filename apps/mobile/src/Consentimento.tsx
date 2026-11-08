// Folha de consentimento do primeiro uso (R15). Aparece sobre qualquer tela até a pessoa aceitar.
import React, { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Texto, espaco, useTema } from "@levia/ui";
import { useSessao, useTexto } from "./sessao.tsx";

export function Consentimento() {
  const t = useTema();
  const tx = useTexto();
  const s = useSessao();
  const insets = useSafeAreaInsets();
  const [enviando, setEnviando] = useState(false);
  const visivel = s.pronto && !s.triagemAceita;
  return (
    <Modal visible={visivel} transparent animationType="slide">
      <View style={st.veu}>
        <View
          style={[st.folha, { backgroundColor: t.superficie, paddingBottom: insets.bottom + espaco.l }]}
          accessibilityViewIsModal
        >
          <Texto variante="titulo" accessibilityRole="header">
            {tx("consentimento.triagem.titulo")}
          </Texto>
          <Texto style={{ marginTop: espaco.m }}>{tx("consentimento.triagem.texto")}</Texto>
          <Texto style={{ marginTop: espaco.m }}>{tx("consentimento.rh.explicacao")}</Texto>
          <Texto variante="pequeno" cor={t.textoSuave} style={{ marginTop: espaco.m }}>
            {tx("aviso.fixo")}
          </Texto>
          <Botao
            titulo={tx("consentimento.aceito") || "Aceito"}
            estilo={{ marginTop: espaco.l }}
            desabilitado={enviando}
            onPress={async () => {
              setEnviando(true);
              try {
                await s.aceitarTriagem();
              } finally {
                setEnviando(false);
              }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  veu: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,30,25,0.45)" },
  folha: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: espaco.xl },
});
