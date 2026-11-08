// Aba Exercícios: plano do catálogo, dose e o registro "Fiz!". Pausado nas saídas 2 e 3 (D4).
import React, { useCallback, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Botao, CartaoExercicio, Texto, espaco, useTema } from "@levia/ui";
import { api, type Plano } from "../../src/api.ts";
import { useTexto } from "../../src/sessao.tsx";
import { Bloco, Tela, hojeIso } from "../../src/Tela.tsx";
import { midiaDoExercicio } from "../../src/videosExercicios.tsx";

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
  const carregar = useCallback(
    async (puxando = false) => {
      if (puxando) setCarregando(true);
      try {
        setPlano(await api.plano());
        setMsg((m) => (m === tx("estado.offline") ? null : m));
      } catch {
        setMsg(tx("estado.offline"));
      } finally {
        setCarregando(false);
      }
    },
    [tx],
  );
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  // A confirmação aparece logo abaixo do botão tocado (e é anunciada ao leitor de tela), não no topo da tela.
  const [aviso, setAviso] = useState<{ id: string; texto: string } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const fiz = async (id: string) => {
    if (enviando) return; // evita registro duplo com toques seguidos
    setEnviando(id);
    try {
      const r = await api.registrarExercicio(id, hojeIso());
      const texto = r.aceito
        ? "Registrado. Bom trabalho!"
        : (MOTIVO[r.motivo ?? ""] ?? "Não deu para registrar agora.");
      setAviso({ id, texto });
      AccessibilityInfo.announceForAccessibility(texto);
      await carregar();
    } catch {
      setAviso({ id, texto: tx("estado.offline") });
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Tela titulo="Exercícios" onAtualizar={() => void carregar(true)} atualizando={carregando}>
      {msg && (
        <Texto accessibilityLiveRegion="polite" cor={t.primariaProfunda}>
          {msg}
        </Texto>
      )}
      {plano?.checagemPendente && (
        <Bloco cor={t.primaria}>
          <Texto negrito>{tx("notificacao.texto")}</Texto>
          <Botao titulo="Responder na conversa" onPress={() => router.navigate("/conversa")} />
        </Bloco>
      )}
      {(!plano || plano.status === "nenhum") && (
        <Bloco>
          <Texto>Você ainda não tem exercícios. Converse com a LevIA na aba Conversa.</Texto>
        </Bloco>
      )}
      {plano && (plano.status === "pausado" || plano.status === "encerrado") && (
        <Bloco cor={plano.status === "pausado" ? t.saida2 : t.primaria}>
          <Texto>
            {plano.status === "pausado" ? tx("exercicios.pausados") : "Seu acompanhamento terminou."}
          </Texto>
        </Bloco>
      )}
      {plano?.status === "ativo" &&
        plano.exercicios.map((e) => {
          const feitas = plano.registrosHoje
            .filter((r) => r.exercicioId === e.id)
            .reduce((a, r) => a + r.quantidade, 0);
          const dose = `${e.dose.series} séries de ${e.dose.repeticoes}, ${e.dose.vezes_por_semana} vezes por semana. No máximo ${e.dose.maximo_por_dia} por dia.`;
          return (
            <View key={e.id} style={{ marginHorizontal: -espaco.m }}>
              <CartaoExercicio
                nome={e.nome}
                passos={e.passos}
                dose={dose}
                quandoParar={e.quandoParar}
                midia={midiaDoExercicio(e.id, e.nome)}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: espaco.l,
                }}
              >
                <Texto variante="pequeno" cor={t.textoSuave}>
                  Hoje: {feitas} de {e.dose.maximo_por_dia}
                </Texto>
                <Botao
                  titulo={feitas >= e.dose.maximo_por_dia ? "Feito hoje" : "Fiz!"}
                  variante={feitas >= e.dose.maximo_por_dia ? "secundario" : "primario"}
                  dica={
                    feitas >= e.dose.maximo_por_dia
                      ? "Você já fez o máximo de hoje"
                      : `Registra que você fez ${e.nome} hoje`
                  }
                  desabilitado={feitas >= e.dose.maximo_por_dia || enviando === e.id}
                  onPress={() => void fiz(e.id)}
                />
              </View>
              {aviso?.id === e.id && (
                <Texto
                  accessibilityLiveRegion="polite"
                  cor={t.primariaProfunda}
                  style={{ paddingHorizontal: espaco.l, marginTop: espaco.xs }}
                >
                  {aviso.texto}
                </Texto>
              )}
            </View>
          );
        })}
      {plano?.status === "ativo" && plano.checagens.length > 0 && (
        <Bloco>
          <Texto negrito>Próximas perguntas rápidas</Texto>
          {plano.checagens.map((c) => (
            <Texto key={c.semana}>
              Semana {c.semana}: {c.data.split("-").reverse().join("/")}
            </Texto>
          ))}
        </Bloco>
      )}
    </Tela>
  );
}
