// Aba Início: atalhos. Não substitui nada; a conversa continua sendo o lugar de responder.
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { ALVO_MINIMO, Texto, espaco, useTema } from "@levia/ui";
import { api, type Plano } from "../../src/api.ts";
import { useTexto } from "../../src/sessao.tsx";
import { Tela } from "../../src/Tela.tsx";

type Icone = "conversa" | "exercicio" | "piora";

function Desenho({ nome, cor }: { nome: Icone; cor: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      {nome === "conversa" && (
        <Path d="M4 5h16v11H9l-5 4z" fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" />
      )}
      {nome === "exercicio" && (
        <>
          <Circle cx={12} cy={5} r={2.5} fill={cor} />
          <Path
            d="M5 10l7 1 7-1M12 11v5l-3 5M12 16l3 5"
            stroke={cor}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {nome === "piora" && (
        <Path
          d="M4 7l6 6 4-4 6 6M14 15h6v-6"
          stroke={cor}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

function Atalho(p: {
  titulo: string;
  detalhe: string;
  icone: Icone;
  destaque?: boolean;
  onPress: () => void;
  dica: string;
}) {
  const t = useTema();
  const fundo = p.destaque ? t.primaria : t.superficie;
  const frente = p.destaque ? t.sobrePrimaria : t.texto;
  return (
    <Pressable
      onPress={p.onPress}
      accessibilityRole="button"
      // pausa entre título e detalhe para o leitor de tela
      accessibilityLabel={p.titulo.endsWith("?") ? `${p.titulo} ${p.detalhe}.` : `${p.titulo}. ${p.detalhe}.`}
      accessibilityHint={p.dica}
      style={({ pressed }) => [
        st.atalho,
        {
          backgroundColor: fundo,
          borderColor: p.destaque ? t.primaria : t.borda,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[st.icone, { backgroundColor: p.destaque ? "rgba(255,255,255,0.18)" : t.primariaSuave }]}>
        <Desenho nome={p.icone} cor={p.destaque ? t.sobrePrimaria : t.primaria} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto variante="destaque" negrito cor={frente}>
          {p.titulo}
        </Texto>
        <Texto variante="pequeno" cor={p.destaque ? t.sobrePrimaria : t.textoSuave}>
          {p.detalhe}
        </Texto>
      </View>
    </Pressable>
  );
}

function resumoExercicios(plano: Plano | null): string {
  if (!plano || plano.status === "nenhum") return "Você ainda não tem exercícios";
  if (plano.status === "pausado") return "Pausados por agora";
  if (plano.status === "encerrado") return "Acompanhamento terminado";
  const faltam = plano.exercicios.filter((e) => {
    const feitas = plano.registrosHoje
      .filter((r) => r.exercicioId === e.id)
      .reduce((a, r) => a + r.quantidade, 0);
    return feitas === 0;
  }).length;
  if (plano.checagemPendente) return "Tem uma pergunta rápida esperando";
  if (faltam === 0) return "Tudo feito hoje";
  return faltam === 1 ? "1 para hoje" : `${faltam} para hoje`;
}

export default function Inicio() {
  const t = useTema();
  const tx = useTexto();
  const router = useRouter();
  const [plano, setPlano] = useState<Plano | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .plano()
        .then(setPlano)
        .catch(() => setPlano(null));
    }, []),
  );

  return (
    <Tela titulo="Boas-vindas de volta!">
      <Texto cor={t.textoSuave}>O que você quer fazer agora?</Texto>
      <View style={{ gap: espaco.m }}>
        <Atalho
          destaque
          icone="conversa"
          titulo="Precisa de ajuda?"
          detalhe="Converse com a LevIA"
          dica="Abre a conversa"
          onPress={() => router.navigate("/conversa")}
        />
        <Atalho
          icone="exercicio"
          titulo="Exercícios pendentes"
          detalhe={resumoExercicios(plano)}
          dica="Abre a aba Exercícios"
          onPress={() => router.navigate("/exercicios")}
        />
        <Atalho
          icone="piora"
          titulo="Minha dor piorou"
          detalhe="Conte para a LevIA agora"
          dica="Abre a conversa e envia: minha dor piorou"
          // o parâmetro t faz cada toque valer, mesmo se a conversa já estiver aberta
          onPress={() =>
            router.navigate({ pathname: "/conversa", params: { acao: "piora", t: String(Date.now()) } })
          }
        />
      </View>
      <Texto variante="pequeno" cor={t.textoSuave}>
        {tx("aviso.fixo")}
      </Texto>
    </Tela>
  );
}

const st = StyleSheet.create({
  atalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaco.m,
    minHeight: ALVO_MINIMO + 28,
    padding: espaco.l,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  icone: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
