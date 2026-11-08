// Aba Ritmo: constância por equipe (setor). Opcional, com consentimento próprio.
// O ranking mostra só equipes. O progresso individual aparece só para a própria pessoa.
import React, { useCallback, useState } from "react";
import { TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Botao, Texto, espaco, fonte, tipo, useTema } from "@levia/ui";
import { api, type Placar } from "../../src/api.ts";
import { useSessao, useTexto } from "../../src/sessao.tsx";
import { Bloco, Tela } from "../../src/Tela.tsx";

export default function Ritmo() {
  const t = useTema();
  const tx = useTexto();
  const s = useSessao();
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [apelido, setApelido] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try { setPlacar(await api.placar()); setErro(null); } catch { setErro(tx("estado.offline")); }
  }, [tx]);
  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  const entrar = async () => {
    setErro(null);
    try {
      await api.consentir("ritmo");
      await api.entrarRitmo(apelido.trim());
      await s.recarregar();
      await carregar();
    } catch {
      setErro("Use um apelido de 2 a 20 letras ou números.");
    }
  };

  return (
    <Tela titulo="Ritmo" onAtualizar={carregar}>
      <Texto>{tx("consentimento.ritmo.texto")}</Texto>
      {!placar?.participando ? (
        <Bloco>
          <Texto negrito>Escolha um apelido</Texto>
          <TextInput
            value={apelido}
            onChangeText={setApelido}
            placeholder="Apelido"
            placeholderTextColor={t.textoSuave}
            accessibilityLabel="Apelido para a sua equipe"
            maxLength={20}
            style={{ minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: t.borda, paddingHorizontal: espaco.m, color: t.texto, fontFamily: fonte.regular, fontSize: tipo.corpo }}
          />
          {erro && <Texto cor={t.saida2}>{erro}</Texto>}
          <Botao titulo="Entrar no Ritmo" desabilitado={apelido.trim().length < 2} onPress={() => void entrar()} />
        </Bloco>
      ) : (
        <>
          {placar.meuProgresso && (
            <Bloco cor={t.primaria}>
              <Texto negrito>Só você vê isto</Texto>
              <Texto>Você fez exercícios em {placar.meuProgresso.diasCumpridos} de {placar.meuProgresso.diasQueContam} dias que contam.</Texto>
              <Texto variante="pequeno" cor={t.textoSuave}>Dias com exercícios pausados não contam nem tiram pontos.</Texto>
            </Bloco>
          )}
          <Bloco>
            <Texto negrito accessibilityRole="header">Equipes</Texto>
            {placar.equipes.length === 0 && <Texto>As equipes aparecem quando têm pelo menos 5 pessoas.</Texto>}
            {placar.equipes.map((e, i) => (
              <View key={e.nome} accessible accessibilityLabel={`${i + 1}º lugar, ${e.nome}, constância ${e.constancia} por cento${e.minha ? ", sua equipe" : ""}`} style={{ gap: 4, paddingVertical: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Texto negrito={e.minha}>{i + 1}. {e.nome}{e.minha ? " (sua equipe)" : ""}</Texto>
                  <Texto negrito>{e.constancia}%</Texto>
                </View>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: t.primariaSuave }}>
                  <View style={{ width: `${e.constancia}%`, height: 10, borderRadius: 5, backgroundColor: t.primaria }} />
                </View>
              </View>
            ))}
          </Bloco>
          <Bloco>
            <Texto negrito>Na sua equipe</Texto>
            <Texto>{placar.minhaEquipe.join(", ")}</Texto>
            <Texto variante="pequeno" cor={t.textoSuave}>Ninguém vê os pontos de outra pessoa. O Ritmo nunca entra em avaliação nem em bônus.</Texto>
          </Bloco>
          <Botao variante="secundario" titulo="Sair do Ritmo" onPress={async () => { await api.revogar("ritmo"); await s.recarregar(); await carregar(); }} />
        </>
      )}
    </Tela>
  );
}
