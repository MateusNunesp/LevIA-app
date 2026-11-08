// Aba Conversa: a pessoa responde SEMPRE escrevendo ou falando. Não há botões de resposta.
// A única exceção é a primeira pergunta, o mapa do corpo.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, FlatList, Keyboard, KeyboardAvoidingView, Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Pattern, Rect, Defs } from "react-native-svg";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import type { MensagemLevia, Regiao } from "@levia/shared";
import { NOME_REGIAO } from "@levia/shared";
import {
  BodyMap, Botao, Bubble, CartaoEmergencia, CartaoExercicio, CartaoResultado, Composer, Digitando, SeparadorData, Texto,
  espaco, useReduzirMovimento, useTema, type Lado,
} from "@levia/ui";
import { api, ErroApi, type EntradaMensagem } from "../../src/api.ts";
import { useSessao, useTexto } from "../../src/sessao.tsx";
import { falar, pararFala, sttNativo } from "../../src/voz.ts";
import { compartilharResumo } from "../../src/pdf.ts";
import { agendarChecagens } from "../../src/notificacoes.ts";

type Item =
  | { id: string; autor: "levia"; m: MensagemLevia; em: Date; respondido?: boolean }
  | { id: string; autor: "pessoa"; texto: string; em: Date; pendente?: boolean; voz?: boolean }
  | { id: string; autor: "rascunho_voz"; texto: string; em: Date };

const hora = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const dia = (d: Date) => {
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
let seq = 0;
const novoId = () => `i${Date.now()}-${seq++}`;

export default function Conversa() {
  const t = useTema();
  const tx = useTexto();
  const sessao = useSessao();
  const insets = useSafeAreaInsets();
  const reduzir = useReduzirMovimento();
  const [itens, setItens] = useState<Item[]>([]);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [terminada, setTerminada] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState("");
  const [mapaAberto, setMapaAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [parcial, setParcial] = useState("");
  const fila = useRef<EntradaMensagem[]>([]);
  const lista = useRef<FlatList<Item>>(null);
  const avisouVozNuvem = useRef(false);
  const vozDisponivel = sttNativo.disponivel();

  // O topo da conversa é escuro nos dois temas: ícones da barra de status claros só enquanto ela está em foco.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle(t.escuro ? "light" : "dark");
    }, [t.escuro]),
  );

  // ---------- chegada de mensagens da LevIA ----------
  const receber = useCallback(
    (ms: MensagemLevia[]) => {
      const agora = new Date();
      setItens((xs) => [...xs, ...ms.map((m) => ({ id: novoId(), autor: "levia" as const, m, em: agora }))]);
      const falavel = ms.filter((m) => "texto" in m).map((m) => ("titulo" in m ? `${m.titulo}. ${m.texto}` : (m as { texto: string }).texto));
      // anúncio para leitor de tela
      for (const f of falavel) AccessibilityInfo.announceForAccessibility(f);
      if (sessao.soVoz && falavel.length) {
        falar(falavel.join(" "), () => {
          if (vozDisponivel) iniciarGravacao();
        });
      }
      // checagens agendadas como lembretes locais
      if (ms.some((m) => m.tipo === "resultado" && m.saida === 1)) {
        void api.plano().then((p) => agendarChecagens(p.checagens.map((c) => c.data), tx("notificacao.texto"))).catch(() => {});
      }
    },
    [sessao.soVoz, vozDisponivel],
  );

  const comecar = useCallback(
    async (modo: "autoanamnese" | "checagem" = "autoanamnese") => {
      setDigitando(true);
      try {
        const s = await api.novaSessao(modo);
        setSessaoId(s.id);
        setTerminada(false);
        receber(s.mensagens);
      } catch (e) {
        setAviso(e instanceof ErroApi && e.codigo === "sem_conexao" ? tx("estado.offline") : null);
      } finally {
        setDigitando(false);
      }
    },
    [receber, tx],
  );

  // Ao abrir: se há checagem pendente (D3), ela vira a conversa; senão, começa a autoanamnese.
  const iniciando = useRef(false);
  useEffect(() => {
    if (!sessao.triagemAceita || sessaoId || iniciando.current) return;
    iniciando.current = true;
    api.plano()
      .then((p) => comecar(p.checagemPendente ? "checagem" : "autoanamnese"))
      .catch(() => comecar())
      .finally(() => { iniciando.current = false; });
  }, [sessao.triagemAceita, sessaoId, comecar]);

  // Checagem pendente quando a conversa anterior já terminou.
  useFocusEffect(
    useCallback(() => {
      if (!sessao.triagemAceita || !sessaoId || !terminada) return;
      api.plano().then((p) => {
        if (p.checagemPendente) void comecar("checagem");
      }).catch(() => {});
    }, [sessao.triagemAceita, sessaoId, terminada, comecar]),
  );

  // ---------- envio (com fila offline) ----------
  const enviar = useCallback(
    async (e: EntradaMensagem, rotulo: string, voz = false) => {
      if (!sessaoId) return;
      const id = novoId();
      setItens((xs) => [
        ...xs.map((x) => (x.autor === "levia" && x.m.tipo === "cartao_mapa" ? { ...x, respondido: true } : x)),
        { id, autor: "pessoa", texto: rotulo, em: new Date(), pendente: true, voz },
      ]);
      setDigitando(true);
      const tentar = async (): Promise<void> => {
        try {
          const r = await api.enviar(sessaoId, e);
          setAviso(null);
          setItens((xs) => xs.map((x) => (x.id === id ? { ...x, pendente: false } : x)));
          if (r.novaSessaoId) setSessaoId(r.novaSessaoId);
          setTerminada(r.terminada);
          receber(r.mensagens);
        } catch (err) {
          if (err instanceof ErroApi && err.codigo === "sem_conexao") {
            setAviso(tx("estado.offline"));
            fila.current.push(e);
            await new Promise((ok) => setTimeout(ok, 5000));
            fila.current = fila.current.filter((x) => x !== e);
            return tentar();
          }
          if (err instanceof ErroApi && err.status === 404) {
            // a conversa expirou no servidor: começa de novo
            await comecar();
          }
        }
      };
      await tentar();
      setDigitando(false);
    },
    [sessaoId, receber, comecar, tx],
  );

  const enviarTexto = () => {
    const v = texto.trim();
    if (!v) return;
    setTexto("");
    void enviar({ tipo: "texto", texto: v }, v);
  };

  // ---------- voz ----------
  const iniciarGravacao = useCallback(async () => {
    if (!vozDisponivel) {
      setAviso(tx("estado.voz_off"));
      return;
    }
    if (!(await sttNativo.pedirPermissao())) {
      setAviso(tx("estado.voz_off"));
      return;
    }
    if (!sttNativo.noAparelho() && !avisouVozNuvem.current) {
      avisouVozNuvem.current = true;
      setAviso(tx("estado.voz_nuvem")); // avisa uma vez
    }
    pararFala();
    setParcial("");
    setSegundos(0);
    setGravando(true);
    sttNativo.iniciar();
  }, [vozDisponivel, tx]);

  useEffect(() => {
    if (!gravando) return;
    const h = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(h);
  }, [gravando]);

  useSpeechRecognitionEvent("result", (ev) => {
    const tr = ev.results[0]?.transcript ?? "";
    setParcial(tr);
    if (ev.isFinal && tr) {
      setGravando(false);
      if (sessao.soVoz) {
        void enviar({ tipo: "voz", texto: tr }, tr, true);
      } else {
        // a transcrição vira um balão com "Editar" antes de confirmar
        setItens((xs) => [...xs.filter((x) => x.autor !== "rascunho_voz"), { id: novoId(), autor: "rascunho_voz", texto: tr, em: new Date() }]);
      }
    }
  });
  useSpeechRecognitionEvent("end", () => setGravando(false));
  useSpeechRecognitionEvent("error", () => {
    setGravando(false);
    setAviso(tx("estado.voz_off"));
  });

  const alternarMicrofone = () => {
    if (gravando) sttNativo.parar();
    else void iniciarGravacao();
  };

  // ---------- render ----------
  // Rolagem: segue o fim da conversa, mas quando chega um resultado a tela para no começo do cartão,
  // para o "Vá hoje" e o título da saída nunca ficarem fora de vista.
  const ultimoResultado = useRef<string | null>(null);
  useEffect(() => {
    const idx = itens.map((x) => x.autor === "levia" && x.m.tipo === "resultado").lastIndexOf(true);
    const alvo = idx >= 0 ? itens[idx]! : null;
    if (alvo && alvo.id !== ultimoResultado.current) {
      ultimoResultado.current = alvo.id;
      Keyboard.dismiss(); // o teclado não pode cobrir o resultado
      setTimeout(() => lista.current?.scrollToIndex({ index: idx, viewPosition: 0, animated: !reduzir }), 120);
      return;
    }
    if (idx >= 0 && idx >= itens.length - 4 && !digitando) return; // ainda lendo o resultado
    setTimeout(() => lista.current?.scrollToEnd({ animated: !reduzir }), 50);
  }, [itens, digitando, reduzir]);

  const ligar = (n: string) => void Linking.openURL(`tel:${n}`);

  const renderItem = ({ item, index }: { item: Item; index: number }) => {
    const anterior = itens[index - 1];
    const separador = !anterior || dia(anterior.em) !== dia(item.em) ? <SeparadorData texto={dia(item.em)} /> : null;
    let corpo: React.ReactNode = null;
    if (item.autor === "pessoa") {
      corpo = (
        <Bubble autor="pessoa" hora={hora(item.em)} pendente={item.pendente} rotulo={`Você${item.voz ? ", por voz" : ""}: ${item.texto}`}>
          <Texto>{item.texto}</Texto>
        </Bubble>
      );
    } else if (item.autor === "rascunho_voz") {
      corpo = (
        <View style={st.rascunho}>
          <Bubble autor="pessoa" hora={hora(item.em)} rotulo={`Sua mensagem de voz: ${item.texto}`}>
            <Texto>{item.texto}</Texto>
          </Bubble>
          <View style={st.acoesRascunho}>
            <Botao variante="texto" titulo="Editar" dica="Coloca o texto na caixa de mensagem para corrigir" onPress={() => { setTexto(item.texto); setItens((xs) => xs.filter((x) => x.id !== item.id)); }} />
            <Botao variante="secundario" titulo="Enviar" onPress={() => { setItens((xs) => xs.filter((x) => x.id !== item.id)); void enviar({ tipo: "voz", texto: item.texto }, item.texto, true); }} />
          </View>
        </View>
      );
    } else {
      const m = item.m;
      switch (m.tipo) {
        case "texto":
          corpo = <Bubble autor="levia" hora={hora(item.em)} rotulo={`LevIA: ${m.texto}`}><Texto>{m.texto}</Texto></Bubble>;
          break;
        case "cartao_mapa":
          corpo = (
            <Bubble autor="levia" hora={hora(item.em)} rotulo={`LevIA: ${m.texto}`} largura="larga">
              <Texto>{m.texto}</Texto>
              {!item.respondido && (
                <Pressable onPress={() => setMapaAberto(true)} accessibilityRole="button" accessibilityLabel="Abrir o mapa do corpo" accessibilityHint="Abre o desenho do corpo em tela cheia" style={[st.previaMapa, { backgroundColor: t.fundo }]}>
                  <BodyMap lado="frente" selecionadas={[]} onAlternar={() => {}} altura={150} reduzirMovimento interativo={false} />
                  <BodyMap lado="costas" selecionadas={[]} onAlternar={() => {}} altura={150} reduzirMovimento interativo={false} />
                </Pressable>
              )}
            </Bubble>
          );
          break;
        case "resultado": {
          const urgentes = [tx("saida3.urgente")].filter((f) => m.urgenteHoje && f);
          corpo = <CartaoResultado saida={m.saida} urgenteHoje={m.urgenteHoje} titulo={m.titulo} texto={m.texto} porque={m.porque} frasesUrgentes={urgentes} />;
          break;
        }
        case "resumo":
          corpo = (
            <View style={[st.cartaoResumo, { backgroundColor: t.superficie, borderColor: t.borda }]}>
              <Texto>{m.texto}</Texto>
              <View style={{ flexDirection: "row", gap: espaco.s, marginTop: espaco.m, flexWrap: "wrap" }}>
                <Botao variante="secundario" titulo="Salvar" dica="Gera o PDF no seu celular" onPress={() => void compartilharResumo(m.episodioId)} />
                <Botao variante="secundario" titulo="Compartilhar" dica="Você escolhe com quem compartilhar" onPress={() => void compartilharResumo(m.episodioId)} />
              </View>
            </View>
          );
          break;
        case "exercicio":
          corpo = <CartaoExercicio nome={m.nome} passos={m.passos} dose={m.dose} quandoParar={m.quandoParar} />;
          break;
        case "emergencia":
          corpo = <CartaoEmergencia texto={m.texto} telefones={m.telefones} onLigar={ligar} />;
          break;
      }
    }
    return (
      <View>
        {separador}
        {corpo}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      {/* topo: escuro nos dois temas, para o botão de emergência e o texto terem contraste */}
      <View style={[st.topo, { paddingTop: insets.top + 6, backgroundColor: t.escuro ? t.superficie : t.primariaProfunda }]}>
        <View style={st.topoLinha}>
          <View style={[st.avatar, { backgroundColor: t.primaria }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={26} height={26} viewBox="0 0 28 28">
              <Path d="M4 16h5l2-6 4 10 2-4h7" stroke={t.sobrePrimaria} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }} accessible accessibilityRole="header" accessibilityLabel="LevIA. Cuidado com a dor, não é atendimento médico.">
            <Texto variante="destaque" negrito cor={t.escuro ? t.texto : "#ffffff"}>LevIA</Texto>
          </View>
          <Pressable onPress={() => ligar("192")} accessibilityRole="button" accessibilityLabel="Emergência? Ligue 192" style={[st.emergencia, { backgroundColor: t.urgente }]}>
            <Texto variante="pequeno" negrito cor={t.escuro ? "#1a0b0a" : "#ffffff"}>Emergência? Ligue 192</Texto>
          </Pressable>
        </View>
        <Texto variante="pequeno" cor={t.escuro ? t.textoSuave : "#d6ebe4"} style={st.subtitulo} accessibilityElementsHidden importantForAccessibility="no">
          cuidado com a dor, não é atendimento médico
        </Texto>
      </View>
      {__DEV__ && sessao.revisaoPendente && (
        <View style={[st.faixa, { backgroundColor: t.saida2Fundo }]}>
          <Texto variante="pequeno" cor={t.saida2}>{tx("revisao.faixa")}</Texto>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1 }}>
          <FundoTextura />
          <FlatList
            ref={lista}
            data={itens}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: espaco.m }}
            onScrollToIndexFailed={(info) => {
              lista.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
              setTimeout(() => lista.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: false }), 100);
            }}
            ListHeaderComponent={
              <View style={[st.avisoFixo, { backgroundColor: t.primariaSuave }]}>
                <Texto variante="pequeno" cor={t.primariaProfunda}>{tx("aviso.fixo")}</Texto>
              </View>
            }
            ListFooterComponent={digitando ? <Digitando reduzirMovimento={reduzir} /> : gravando && parcial ? (
              <Bubble autor="pessoa" hora="" rotulo={`Ouvindo: ${parcial}`} pendente><Texto cor={t.textoSuave}>{parcial}</Texto></Bubble>
            ) : undefined}
          />
        </View>
        {aviso && (
          <View style={[st.faixa, { backgroundColor: t.primariaSuave }]} accessibilityLiveRegion="polite">
            <Texto variante="pequeno" cor={t.primariaProfunda}>{aviso}</Texto>
          </View>
        )}
        <View>
          <Composer
            valor={texto}
            onMudar={setTexto}
            onEnviar={enviarTexto}
            onMicrofone={alternarMicrofone}
            gravando={gravando}
            segundos={segundos}
            onCancelarGravacao={() => { sttNativo.cancelar(); setGravando(false); setParcial(""); }}
            vozDisponivel={vozDisponivel}
            desabilitado={!sessaoId}
          />
        </View>
      </KeyboardAvoidingView>

      <MapaTelaCheia
        aberto={mapaAberto}
        onFechar={() => setMapaAberto(false)}
        onEnviar={(regs) => {
          setMapaAberto(false);
          void enviar({ tipo: "mapa", regioes: regs }, regs.map((r) => NOME_REGIAO[r]).join(", "));
        }}
        reduzir={reduzir}
      />

      <Consentimento visivel={sessao.pronto && !sessao.triagemAceita} />
    </View>
  );
}

function FundoTextura() {
  const t = useTema();
  // textura sutil: pequenas marcas de pulso, quase invisíveis
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="p" width={56} height={56} patternUnits="userSpaceOnUse">
            <Path d="M6 30h8l3-6 4 10 3-4h6" stroke={t.fundoTextura} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            <Circle cx={44} cy={12} r={1.6} fill={t.fundoTextura} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#p)" />
      </Svg>
    </View>
  );
}

function MapaTelaCheia({ aberto, onFechar, onEnviar, reduzir }: { aberto: boolean; onFechar: () => void; onEnviar: (r: Regiao[]) => void; reduzir: boolean }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [lado, setLado] = useState<Lado>("frente");
  const [sel, setSel] = useState<Regiao[]>([]);
  const alternar = (r: Regiao) => setSel((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]));
  return (
    <Modal visible={aberto} animationType={reduzir ? "none" : "slide"} onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: t.fundo, paddingTop: insets.top + espaco.m, paddingBottom: insets.bottom + espaco.m }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: espaco.l }}>
          <Texto variante="titulo" accessibilityRole="header" style={{ flex: 1 }}>Onde dói?</Texto>
          <Botao variante="texto" titulo="Fechar" onPress={onFechar} />
        </View>
        <View style={[st.seletorLado, { borderColor: t.primaria }]} accessibilityRole="tablist">
          {(["frente", "costas"] as Lado[]).map((l) => (
            <Pressable key={l} onPress={() => setLado(l)} accessibilityRole="tab" accessibilityState={{ selected: lado === l }} accessibilityLabel={l === "frente" ? "Corpo de frente" : "Corpo de costas"} style={[st.lado, lado === l && { backgroundColor: t.primaria }]}>
              <Texto negrito cor={lado === l ? t.sobrePrimaria : t.primaria}>{l === "frente" ? "Frente" : "Costas"}</Texto>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <BodyMap lado={lado} selecionadas={sel} onAlternar={alternar} altura={460} reduzirMovimento={reduzir} />
        </View>
        <View style={{ paddingHorizontal: espaco.l, gap: espaco.m }}>
          <Texto cor={t.textoSuave} accessibilityLiveRegion="polite">
            {sel.length ? `Você marcou: ${sel.map((r) => NOME_REGIAO[r]).join(", ")}` : "Toque em uma ou mais partes. Você também pode fechar e escrever onde dói."}
          </Texto>
          <Botao titulo="Pronto" desabilitado={!sel.length} onPress={() => { onEnviar(sel); setSel([]); }} />
        </View>
      </View>
    </Modal>
  );
}

function Consentimento({ visivel }: { visivel: boolean }) {
  const t = useTema();
  const tx = useTexto();
  const s = useSessao();
  const insets = useSafeAreaInsets();
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal visible={visivel} transparent animationType="slide">
      <View style={st.veu}>
        <View style={[st.folha, { backgroundColor: t.superficie, paddingBottom: insets.bottom + espaco.l }]} accessibilityViewIsModal>
          <Texto variante="titulo" accessibilityRole="header">{tx("consentimento.triagem.titulo")}</Texto>
          <Texto style={{ marginTop: espaco.m }}>{tx("consentimento.triagem.texto")}</Texto>
          <Texto style={{ marginTop: espaco.m }}>{tx("consentimento.rh.explicacao")}</Texto>
          <Texto variante="pequeno" cor={t.textoSuave} style={{ marginTop: espaco.m }}>{tx("aviso.fixo")}</Texto>
          <Botao
            titulo={tx("consentimento.aceito") || "Aceito"}
            estilo={{ marginTop: espaco.l }}
            desabilitado={enviando}
            onPress={async () => {
              setEnviando(true);
              try { await s.aceitarTriagem(); } finally { setEnviando(false); }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  topo: { paddingHorizontal: espaco.m, paddingBottom: espaco.m },
  topoLinha: { flexDirection: "row", alignItems: "center", gap: espaco.m },
  subtitulo: { marginLeft: 40 + espaco.m, marginTop: espaco.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emergencia: { minHeight: 44, borderRadius: 22, paddingHorizontal: 12, justifyContent: "center" },
  faixa: { paddingHorizontal: espaco.l, paddingVertical: 6 },
  avisoFixo: { marginHorizontal: espaco.l, marginBottom: espaco.s, padding: espaco.s, borderRadius: 10 },
  previaMapa: { flexDirection: "row", justifyContent: "center", gap: espaco.l, marginTop: espaco.m, paddingVertical: espaco.s, borderRadius: 12 },
  cartaoResumo: { marginHorizontal: espaco.m, marginVertical: espaco.s, padding: espaco.l, borderRadius: 14, borderWidth: 1 },
  rascunho: { marginVertical: 2 },
  acoesRascunho: { flexDirection: "row", justifyContent: "flex-end", gap: espaco.s, paddingHorizontal: espaco.m },
  seletorLado: { flexDirection: "row", alignSelf: "center", borderWidth: 1.5, borderRadius: 24, marginTop: espaco.m, overflow: "hidden" },
  lado: { minHeight: 44, paddingHorizontal: espaco.xl, justifyContent: "center" },
  veu: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,30,25,0.45)" },
  folha: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: espaco.xl },
});
