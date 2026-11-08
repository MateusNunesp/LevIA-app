// Componentes de interface da LevIA. Padrões de conversa parecidos com mensageiros, identidade própria.
import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, TextInput, View, type ViewStyle } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useTema, Texto } from "./tema.tsx";
import { ALVO_MINIMO, corDaSaida, espaco, fonte, tipo } from "./tokens.ts";

// ---------- balão ----------

export interface BubbleProps {
  autor: "levia" | "pessoa";
  hora: string;
  children: React.ReactNode;
  /** rótulo para o leitor de tela (quem disse + texto) */
  rotulo: string;
  pendente?: boolean;
  largura?: "normal" | "larga";
}

/** Balão com "rabinho". LevIA à esquerda, pessoa à direita. */
export function Bubble({ autor, hora, children, rotulo, pendente, largura = "normal" }: BubbleProps) {
  const t = useTema();
  const daLevia = autor === "levia";
  const fundo = daLevia ? t.superficie : t.balaoPessoa;
  return (
    <View style={[s.linha, { justifyContent: daLevia ? "flex-start" : "flex-end" }]} accessible accessibilityLabel={rotulo}>
      <View style={[s.balao, { backgroundColor: fundo, maxWidth: largura === "larga" ? "92%" : "82%" }, daLevia ? s.balaoEsq : s.balaoDir, !daLevia && pendente ? { opacity: 0.7 } : null]}>
        {children}
        <Texto variante="pequeno" cor={t.textoSuave} style={s.hora}>
          {pendente ? "enviando…" : hora}
        </Texto>
      </View>
      <Svg width={10} height={14} style={[s.rabo, daLevia ? { left: espaco.m - 3 } : { right: espaco.m - 3, transform: [{ scaleX: -1 }] }]}>
        <Path d="M10 0 L10 14 L0 0 Z" fill={fundo} />
      </Svg>
    </View>
  );
}

// ---------- separador de data e "digitando" ----------

export function SeparadorData({ texto }: { texto: string }) {
  const t = useTema();
  return (
    <View style={s.separador} accessibilityRole="header">
      <View style={[s.pilula, { backgroundColor: t.primariaSuave }]}>
        <Texto variante="pequeno" cor={t.primariaProfunda}>
          {texto}
        </Texto>
      </View>
    </View>
  );
}

export function Digitando({ reduzirMovimento }: { reduzirMovimento?: boolean }) {
  const t = useTema();
  const v = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (reduzirMovimento) return;
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true }), Animated.timing(v, { toValue: 0.3, duration: 450, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [reduzirMovimento, v]);
  return (
    <View style={[s.linha, { justifyContent: "flex-start" }]} accessible accessibilityLabel="LevIA está digitando" accessibilityLiveRegion="polite">
      <Animated.View style={[s.balao, s.balaoEsq, { backgroundColor: t.superficie, flexDirection: "row", gap: 5, opacity: v }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primaria }} />
        ))}
      </Animated.View>
    </View>
  );
}

// ---------- botões ----------

export interface BotaoProps {
  titulo: string;
  onPress: () => void;
  variante?: "primario" | "secundario" | "urgente" | "texto";
  dica?: string;
  desabilitado?: boolean;
  estilo?: ViewStyle;
  icone?: React.ReactNode;
}

export function Botao({ titulo, onPress, variante = "primario", dica, desabilitado, estilo, icone }: BotaoProps) {
  const t = useTema();
  const cores = {
    primario: { bg: t.primaria, fg: t.sobrePrimaria, borda: t.primaria },
    secundario: { bg: "transparent", fg: t.primaria, borda: t.primaria },
    urgente: { bg: t.urgente, fg: t.escuro ? "#1a0b0a" : "#ffffff", borda: t.urgente },
    texto: { bg: "transparent", fg: t.primaria, borda: "transparent" },
  }[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: !!desabilitado }}
      style={({ pressed }) => [s.botao, { backgroundColor: cores.bg, borderColor: cores.borda, opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1 }, estilo]}
    >
      {icone}
      <Texto negrito cor={cores.fg}>
        {titulo}
      </Texto>
    </Pressable>
  );
}

// ---------- cartões dentro da conversa ----------

export function CartaoResultado(p: { saida: 1 | 2 | 3; urgenteHoje: boolean; titulo: string; texto: string; porque: string; frasesUrgentes: string[] }) {
  const t = useTema();
  const [aberto, setAberto] = React.useState(false);
  const c = corDaSaida(t, p.saida);
  const reduzir = useReduzirMovimento();
  const altura = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (p.urgenteHoje) AccessibilityInfo.announceForAccessibility(p.frasesUrgentes[0] ?? p.titulo);
  }, [p.urgenteHoje, p.frasesUrgentes, p.titulo]);
  const alternar = () => {
    setAberto((x) => !x);
    if (!reduzir) Animated.timing(altura, { toValue: aberto ? 0 : 1, duration: 180, useNativeDriver: false }).start();
  };
  // O "vá hoje" fica em destaque, na cor de urgência, separado do resto do texto.
  let corpo = p.texto;
  for (const f of p.frasesUrgentes) corpo = corpo.replace(f, "").trim();
  return (
    <View style={[s.cartao, { backgroundColor: t.superficie, borderLeftColor: c.cor }]}>
      <Texto variante="destaque" negrito cor={c.cor} accessibilityRole="header">
        {p.titulo}
      </Texto>
      {p.urgenteHoje && (
        <View style={[s.faixaUrgente, { backgroundColor: c.fundo }]}>
          <Texto variante="destaque" negrito cor={t.urgente}>
            {p.frasesUrgentes[0]}
          </Texto>
        </View>
      )}
      <Texto style={{ marginTop: espaco.s }}>{corpo}</Texto>
      <Pressable onPress={alternar} accessibilityRole="button" accessibilityState={{ expanded: aberto }} accessibilityLabel="Por quê?" style={s.linkPorque}>
        <Texto negrito cor={t.primaria}>
          Por quê?
        </Texto>
      </Pressable>
      {aberto && (
        <View style={[s.porque, { backgroundColor: t.fundo }]} accessibilityLiveRegion="polite">
          <Texto>{p.porque}</Texto>
        </View>
      )}
    </View>
  );
}

export function CartaoExercicio(p: { nome: string; passos: string[]; dose: string; quandoParar: string }) {
  const t = useTema();
  return (
    <View style={[s.cartao, { backgroundColor: t.superficie, borderLeftColor: t.primaria }]}>
      <View style={[s.midia, { backgroundColor: t.primariaSuave }]} accessible accessibilityLabel={`Imagem do exercício ${p.nome}, ainda não disponível`}>
        <Svg width={48} height={48} viewBox="0 0 48 48">
          <Circle cx={24} cy={12} r={6} fill={t.primaria} />
          <Rect x={18} y={20} width={12} height={18} rx={6} fill={t.primaria} opacity={0.6} />
        </Svg>
      </View>
      <Texto variante="destaque" negrito accessibilityRole="header">
        {p.nome}
      </Texto>
      {p.passos.map((x, i) => (
        <Texto key={i} style={{ marginTop: 4 }}>
          {i + 1}. {x}
        </Texto>
      ))}
      <Texto negrito style={{ marginTop: espaco.s }} cor={t.primariaProfunda}>
        {p.dose}
      </Texto>
      <Texto variante="pequeno" cor={t.textoSuave} style={{ marginTop: 4 }}>
        {p.quandoParar}
      </Texto>
    </View>
  );
}

export function CartaoEmergencia(p: { texto: string; telefones: string[]; onLigar: (n: string) => void }) {
  const t = useTema();
  useEffect(() => AccessibilityInfo.announceForAccessibility(p.texto), [p.texto]);
  return (
    <View style={[s.cartao, { backgroundColor: t.urgenteFundo, borderLeftColor: t.urgente }]} accessibilityRole="alert">
      <Texto variante="destaque" negrito cor={t.urgente}>
        {p.texto}
      </Texto>
      <View style={{ flexDirection: "row", gap: espaco.s, marginTop: espaco.m, flexWrap: "wrap" }}>
        {p.telefones.map((n) => (
          <Botao key={n} variante="urgente" titulo={n === "188" ? "Ligar para o CVV, 188" : "Ligar para o SAMU, 192"} onPress={() => p.onLigar(n)} />
        ))}
      </View>
    </View>
  );
}

// ---------- barra de digitação ----------

export interface ComposerProps {
  valor: string;
  onMudar: (t: string) => void;
  onEnviar: () => void;
  onMicrofone: () => void;
  gravando: boolean;
  segundos: number;
  onCancelarGravacao: () => void;
  vozDisponivel: boolean;
  desabilitado?: boolean;
}

/** Campo "Mensagem" + microfone que vira enviar quando há texto. Toque para gravar, toque para parar. */
export function Composer(p: ComposerProps) {
  const t = useTema();
  const temTexto = p.valor.trim().length > 0;
  const mmss = `${Math.floor(p.segundos / 60)}:${String(p.segundos % 60).padStart(2, "0")}`;
  return (
    <View style={[s.composer, { backgroundColor: t.fundo, borderTopColor: t.borda }]}>
      {p.gravando ? (
        <View style={[s.campo, { backgroundColor: t.superficie, flexDirection: "row", alignItems: "center", gap: espaco.m }]} accessibilityLiveRegion="polite">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.primaria }} />
          <Texto accessibilityLabel={`Gravando, ${p.segundos} segundos`}>Gravando {mmss}</Texto>
          <View style={{ flex: 1 }} />
          <Pressable onPress={p.onCancelarGravacao} accessibilityRole="button" accessibilityLabel="Cancelar gravação" style={s.alvo}>
            <Texto negrito cor={t.textoSuave}>
              Cancelar
            </Texto>
          </Pressable>
        </View>
      ) : (
        <TextInput
          value={p.valor}
          onChangeText={p.onMudar}
          placeholder="Mensagem"
          placeholderTextColor={t.textoSuave}
          accessibilityLabel="Mensagem"
          accessibilityHint="Escreva sua resposta para a LevIA"
          multiline
          editable={!p.desabilitado}
          style={[s.campo, { backgroundColor: t.superficie, color: t.texto, fontFamily: fonte.regular, fontSize: tipo.corpo }]}
          onSubmitEditing={p.onEnviar}
          submitBehavior="submit"
          returnKeyType="send"
          allowFontScaling
        />
      )}
      <Pressable
        onPress={temTexto && !p.gravando ? p.onEnviar : p.onMicrofone}
        disabled={p.desabilitado || (!temTexto && !p.vozDisponivel && !p.gravando)}
        accessibilityRole="button"
        accessibilityLabel={temTexto && !p.gravando ? "Enviar" : p.gravando ? "Parar gravação" : "Gravar mensagem de voz"}
        accessibilityHint={!temTexto && !p.vozDisponivel ? "A voz não está disponível. Escreva sua resposta." : undefined}
        style={({ pressed }) => [s.botaoRedondo, { backgroundColor: t.primaria, opacity: pressed ? 0.85 : !temTexto && !p.vozDisponivel ? 0.4 : 1 }]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          {temTexto && !p.gravando ? (
            <Path d="M3 20 L21 12 L3 4 L3 10 L15 12 L3 14 Z" fill={t.sobrePrimaria} />
          ) : p.gravando ? (
            <Rect x={6} y={6} width={12} height={12} rx={2} fill={t.sobrePrimaria} />
          ) : (
            <>
              <Rect x={9} y={3} width={6} height={12} rx={3} fill={t.sobrePrimaria} />
              <Path d="M6 11 a6 6 0 0 0 12 0 M12 17 L12 21 M9 21 L15 21" stroke={t.sobrePrimaria} strokeWidth={2} fill="none" strokeLinecap="round" />
            </>
          )}
        </Svg>
      </Pressable>
    </View>
  );
}

// ---------- movimento reduzido ----------

export function useReduzirMovimento(): boolean {
  const [r, setR] = React.useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setR).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setR);
    return () => sub.remove();
  }, []);
  return r;
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", paddingHorizontal: espaco.m, marginVertical: 3 },
  balao: { borderRadius: 18, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6 },
  balaoEsq: { borderTopLeftRadius: 4, marginLeft: 6 },
  balaoDir: { borderTopRightRadius: 4, marginRight: 6 },
  rabo: { position: "absolute", top: 0 },
  hora: { alignSelf: "flex-end", marginTop: 2 },
  separador: { alignItems: "center", marginVertical: espaco.m },
  pilula: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  botao: { minHeight: ALVO_MINIMO, paddingHorizontal: espaco.l, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: espaco.s },
  cartao: { borderRadius: 14, borderLeftWidth: 5, padding: espaco.l, marginHorizontal: espaco.m, marginVertical: espaco.s },
  faixaUrgente: { borderRadius: 10, padding: espaco.m, marginTop: espaco.s },
  linkPorque: { minHeight: ALVO_MINIMO, justifyContent: "center", alignSelf: "flex-start", marginTop: espaco.s },
  porque: { borderRadius: 10, padding: espaco.m },
  midia: { height: 96, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: espaco.m },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: espaco.s, padding: espaco.s, borderTopWidth: StyleSheet.hairlineWidth },
  campo: { flex: 1, minHeight: ALVO_MINIMO + 4, maxHeight: 140, borderRadius: 24, paddingHorizontal: espaco.l, paddingVertical: 12 },
  botaoRedondo: { width: ALVO_MINIMO + 4, height: ALVO_MINIMO + 4, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  alvo: { minHeight: ALVO_MINIMO, minWidth: ALVO_MINIMO, justifyContent: "center", alignItems: "center" },
});
