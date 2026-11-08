// Mapa do corpo: o elemento marcante da LevIA. Uma figura feita de "seixos" separados,
// frente e costas. Cada região é um seixo que se acende ao toque.
// Acessibilidade: o desenho fica escondido do leitor de tela; por cima dele há áreas de toque
// transparentes (>= 44 pt), cada uma com accessibilityLabel e estado "marcado".
import React, { useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Rect } from "react-native-svg";
import type { Regiao } from "@levia/shared";
import { NOME_REGIAO } from "@levia/shared";
import { useTema } from "./tema.tsx";
import { ALVO_MINIMO } from "./tokens.ts";

type Forma =
  | { k: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { k: "circ"; cx: number; cy: number; r: number }
  | { k: "elip"; cx: number; cy: number; rx: number; ry: number };

interface Seixo {
  forma: Forma;
  regiao?: Regiao;
}

export type Lado = "frente" | "costas";

// Altura com folga embaixo, para a área de toque dos pés (>= 44 pt) não ser cortada.
const VB = { w: 200, h: 436 };

function espelhar(f: Forma): Forma {
  if (f.k === "rect") return { ...f, x: VB.w - f.x - f.w };
  return { ...f, cx: VB.w - f.cx };
}

function par(f: Forma, regiao?: Regiao): Seixo[] {
  return [{ forma: f, regiao }, { forma: espelhar(f), regiao }];
}

function figura(lado: Lado): Seixo[] {
  const tronco: Seixo[] =
    lado === "frente"
      ? [{ forma: { k: "rect", x: 70, y: 90, w: 60, h: 118, r: 22 } }]
      : [
          { forma: { k: "rect", x: 70, y: 90, w: 60, h: 60, r: 20 }, regiao: "costas_alta" },
          { forma: { k: "rect", x: 70, y: 154, w: 60, h: 54, r: 18 }, regiao: "lombar" },
        ];
  return [
    { forma: { k: "elip", cx: 100, cy: 38, rx: 25, ry: 29 } },
    { forma: { k: "rect", x: 88, y: 66, w: 24, h: 20, r: 9 }, regiao: "pescoco" },
    ...par({ k: "circ", cx: 58, cy: 100, r: 15 }, "ombros"),
    ...tronco,
    ...par({ k: "rect", x: 39, y: 118, w: 18, h: 44, r: 9 }),
    ...par({ k: "circ", cx: 48, cy: 172, r: 11 }, "cotovelos"),
    ...par({ k: "rect", x: 38, y: 186, w: 18, h: 44, r: 9 }),
    ...par({ k: "elip", cx: 46, cy: 248, rx: 12, ry: 15 }, "punhos_maos"),
    { forma: { k: "rect", x: 70, y: 212, w: 60, h: 40, r: 18 }, regiao: "quadril" },
    ...par({ k: "rect", x: 72, y: 256, w: 26, h: 62, r: 13 }),
    ...par({ k: "circ", cx: 85, cy: 331, r: 13 }, "joelhos"),
    ...par({ k: "rect", x: 75, y: 348, w: 20, h: 42, r: 10 }),
    ...par({ k: "elip", cx: 84, cy: 402, rx: 15, ry: 10 }, "tornozelos_pes"),
  ];
}

function caixa(f: Forma): { x: number; y: number; w: number; h: number } {
  if (f.k === "rect") return { x: f.x, y: f.y, w: f.w, h: f.h };
  if (f.k === "circ") return { x: f.cx - f.r, y: f.cy - f.r, w: 2 * f.r, h: 2 * f.r };
  return { x: f.cx - f.rx, y: f.cy - f.ry, w: 2 * f.rx, h: 2 * f.ry };
}

const ROTULO_LADO: Record<Lado, string> = { frente: "de frente", costas: "de costas" };

export interface BodyMapProps {
  lado: Lado;
  selecionadas: Regiao[];
  onAlternar: (r: Regiao) => void;
  altura: number;
  reduzirMovimento?: boolean;
  /** false = só o desenho (prévia dentro do balão): sem áreas de toque, invisível ao leitor de tela */
  interativo?: boolean;
}

export function BodyMap({ lado, selecionadas, onAlternar, altura, reduzirMovimento, interativo = true }: BodyMapProps) {
  const t = useTema();
  const largura = (altura * VB.w) / VB.h;
  const escala = altura / VB.h;
  const seixos = useMemo(() => figura(lado), [lado]);
  const pulso = useRef(new Animated.Value(1)).current;

  // áreas de toque: uma por região (as duas metades de um par viram uma área só por lado)
  const areas = useMemo(() => {
    const porRegiao = new Map<Regiao, { x: number; y: number; w: number; h: number }[]>();
    for (const s of seixos) if (s.regiao) porRegiao.set(s.regiao, [...(porRegiao.get(s.regiao) ?? []), caixa(s.forma)]);
    const out: { regiao: Regiao; x: number; y: number; w: number; h: number }[] = [];
    for (const [regiao, cs] of porRegiao) {
      for (const c of cs) {
        const w = Math.max(c.w * escala, ALVO_MINIMO);
        const h = Math.max(c.h * escala, ALVO_MINIMO);
        out.push({ regiao, x: (c.x + c.w / 2) * escala - w / 2, y: (c.y + c.h / 2) * escala - h / 2, w, h });
      }
    }
    return out;
  }, [seixos, escala]);

  const tocar = (r: Regiao) => {
    onAlternar(r);
    if (!reduzirMovimento) {
      pulso.setValue(0.97);
      Animated.spring(pulso, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
    }
    const ja = selecionadas.includes(r);
    AccessibilityInfo.announceForAccessibility(`${NOME_REGIAO[r]} ${ja ? "desmarcado" : "marcado"}`);
  };

  return (
    <Animated.View
      style={{ width: largura, height: altura, transform: [{ scale: pulso }] }}
      pointerEvents={interativo ? "auto" : "none"}
      importantForAccessibility={interativo ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!interativo}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <Svg width={largura} height={altura} viewBox={`0 0 ${VB.w} ${VB.h}`}>
          <G>
            {seixos.map((s, i) => {
              const sel = s.regiao && selecionadas.includes(s.regiao);
              const fill = sel ? t.primaria : s.regiao ? t.primariaSuave : t.escuro ? t.borda : t.fundoTextura;
              const stroke = s.regiao && !sel ? t.primaria : "none";
              const comum = { fill, stroke, strokeWidth: s.regiao && !sel ? 1.2 : 0, strokeOpacity: t.escuro ? 0.7 : 0.45 };
              const f = s.forma;
              if (f.k === "rect") return <Rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} {...comum} />;
              if (f.k === "circ") return <Circle key={i} cx={f.cx} cy={f.cy} r={f.r} {...comum} />;
              return <Ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} {...comum} />;
            })}
          </G>
        </Svg>
      </View>
      {interativo && areas.map((a, i) => {
        const sel = selecionadas.includes(a.regiao);
        // As duas metades de um par (ombro esquerdo e direito) são a mesma região: só a primeira aparece para o leitor de tela.
        const principal = areas.findIndex((x) => x.regiao === a.regiao) === i;
        return (
          <Pressable
            key={`${a.regiao}-${i}`}
            onPress={() => tocar(a.regiao)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={`${NOME_REGIAO[a.regiao]}, ${ROTULO_LADO[lado]}`}
            accessibilityHint="Toque para marcar ou desmarcar onde dói"
            accessible={principal}
            importantForAccessibility={principal ? "yes" : "no-hide-descendants"}
            accessibilityElementsHidden={!principal}
            hitSlop={4}
            style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h, borderRadius: Math.min(a.w, a.h) / 2 }}
          />
        );
      })}
    </Animated.View>
  );
}
