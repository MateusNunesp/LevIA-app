// Aba Exercícios: plano do catálogo, dose e o registro "Fiz!". Pausado nas saídas 2 e 3 (D4).
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Botao, CartaoExercicio, Texto, espaco, useTema } from "@levia/ui";
import { api, type Plano } from "../../src/api.ts";
import { useTexto } from "../../src/sessao.tsx";
import { Bloco, Tela, hojeIso } from "../../src/Tela.tsx";

const MOTIVO: Record<string, string> = {
  acima_da_dose: "Você já fez o máximo de hoje. Descanse e volte amanhã.",
  sem_plano_ativo: "Seus exercícios estão pausados.",
  fora_do_plano: "Este exercício não está no seu plano.",
  limite_diario: "Você já registrou muitas vezes hoje.",
};

export default function Exercicios() {
  const t = useTema();
  const tx = useTexto();
  const router = useRouter();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Carregar ao entrar na aba não mostra o indicador de "puxar para atualizar"; só o gesto mostra.
  const carregar = useCallback(async (puxando = false) => {
    if (puxando) setCarregando(true);
    try {
      setPlano(await api.plano());
      setMsg((m) => (m === tx("estado.offline") ? null : m));
    } catch {
      setMsg(tx("estado.offline"));
    } finally {
      setCarregando(false);
    }
  }, [tx]);
  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  const fiz = async (id: string) => {
    const r = await api.registrarExercicio(id, hojeIso());
    setMsg(r.aceito ? "Registrado. Bom trabalho!" : (MOTIVO[r.motivo ?? ""] ?? "Não deu para registrar agora."));
    void carregar();
  };

  return (
    <Tela titulo="Exercícios" onAtualizar={() => void carregar(true)} atualizando={carregando}>
      {msg && <Texto accessibilityLiveRegion="polite" cor={t.primariaProfunda}>{msg}</Texto>}
      {plano?.checagemPendente && (
        <Bloco cor={t.primaria}>
          <Texto negrito>{tx("notificacao.texto")}</Texto>
          <Botao titulo="Responder na conversa" onPress={() => router.navigate("/conversa")} />
        </Bloco>
      )}
      {(!plano || plano.status === "nenhum") && (
        <Bloco><Texto>Você ainda não tem exercícios. Converse com a LevIA na aba Conversa.</Texto></Bloco>
      )}
      {plano && (plano.status === "pausado" || plano.status === "encerrado") && (
        <Bloco cor={plano.status === "pausado" ? t.saida2 : t.primaria}>
          <Texto>{plano.status === "pausado" ? tx("exercicios.pausados") : "Seu acompanhamento terminou."}</Texto>
        </Bloco>
      )}
      {plano?.status === "ativo" &&
        plano.exercicios.map((e) => {
          const feitas = plano.registrosHoje.filter((r) => r.exercicioId === e.id).reduce((a, r) => a + r.quantidade, 0);
          const dose = `${e.dose.series} séries de ${e.dose.repeticoes}, ${e.dose.vezes_por_semana} vezes por semana. No máximo ${e.dose.maximo_por_dia} por dia.`;
          return (
            <View key={e.id} style={{ marginHorizontal: -espaco.m }}>
              <CartaoExercicio nome={e.nome} passos={e.passos} dose={dose} quandoParar={e.quandoParar} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: espaco.l }}>
                <Texto variante="pequeno" cor={t.textoSuave}>Hoje: {feitas} de {e.dose.maximo_por_dia}</Texto>
                <Botao titulo="Fiz!" dica={`Registra que você fez ${e.nome} hoje`} desabilitado={feitas >= e.dose.maximo_por_dia} onPress={() => void fiz(e.id)} />
              </View>
            </View>
          );
        })}
      {plano?.status === "ativo" && plano.checagens.length > 0 && (
        <Bloco>
          <Texto negrito>Próximas perguntas rápidas</Texto>
          {plano.checagens.map((c) => (
            <Texto key={c.semana}>Semana {c.semana}: {c.data.split("-").reverse().join("/")}</Texto>
          ))}
        </Bloco>
      )}
    </Tela>
  );
}
