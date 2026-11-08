// Aba Você: meus dados, apagar tudo, revogar, modo só voz e (no modo demo) troca de perfil.
import React, { useState } from "react";
import { Alert, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Botao, Texto, espaco, useTema } from "@levia/ui";
import { api } from "../../src/api.ts";
import { useSessao, useTexto } from "../../src/sessao.tsx";
import { esquecerAparelho } from "../../src/identidade.ts";
import { cancelarLembretes } from "../../src/notificacoes.ts";
import { Bloco, Tela } from "../../src/Tela.tsx";
import { SeletorDemo } from "../../src/SeletorDemo.tsx";

export default function Voce() {
  const t = useTema();
  const tx = useTexto();
  const s = useSessao();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const baixar = async () => {
    try {
      const dados = await api.meusDados();
      const f = new File(Paths.cache, "meus-dados-levia.json");
      f.write(JSON.stringify(dados, null, 2));
      await Sharing.shareAsync(f.uri, { mimeType: "application/json", dialogTitle: "Meus dados da LevIA" });
    } catch {
      setMsg(tx("estado.offline"));
    }
  };

  const apagar = () =>
    Alert.alert("Apagar tudo?", "Isso apaga suas respostas, seus exercícios e o seu Ritmo. Não dá para desfazer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar tudo",
        style: "destructive",
        onPress: async () => {
          await api.apagarTudo();
          await cancelarLembretes();
          await esquecerAparelho();
          await s.recarregar();
          router.replace("/");
        },
      },
    ]);

  const revogarTriagem = () =>
    Alert.alert("Parar a triagem?", "Suas respostas de saúde serão apagadas agora.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Parar e apagar", style: "destructive", onPress: async () => { await api.revogar("triagem"); await cancelarLembretes(); await s.recarregar(); } },
    ]);

  return (
    <Tela titulo="Você">
      <Bloco>
        <Texto negrito accessibilityRole="header">O que o RH vê</Texto>
        <Texto>{tx("consentimento.rh.explicacao")}</Texto>
      </Bloco>
      <Bloco>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.m }}>
          <View style={{ flex: 1 }}>
            <Texto negrito>Modo só voz</Texto>
            <Texto variante="pequeno" cor={t.textoSuave}>A LevIA lê as mensagens em voz alta e você responde falando.</Texto>
          </View>
          <Switch value={s.soVoz} onValueChange={s.definirSoVoz} accessibilityLabel="Modo só voz" trackColor={{ true: t.primaria, false: t.borda }} />
        </View>
      </Bloco>
      <Bloco>
        <Texto negrito accessibilityRole="header">Meus dados</Texto>
        <Botao variante="secundario" titulo="Baixar meus dados" onPress={() => void baixar()} />
        {s.triagemAceita && <Botao variante="secundario" titulo="Parar a triagem e apagar respostas" onPress={revogarTriagem} />}
        <Botao variante="secundario" titulo="Apagar tudo" dica="Apaga todos os seus dados da LevIA" onPress={apagar} />
        {msg && <Texto>{msg}</Texto>}
      </Bloco>
      <Texto variante="pequeno" cor={t.textoSuave}>{tx("aviso.fixo")}</Texto>
      <SeletorDemo />
    </Tela>
  );
}
