// Gráfico de linhas (react-native-svg) para o painel do RH.
// - Cada série se identifica pelo rótulo escrito no fim da linha e por um traço diferente
//   (cheio, tracejado, pontilhado), nunca só pela cor.
// - Valor null (célula suprimida, k < 10) vira lacuna na linha; ponto isolado vira um círculo.
// - Os textos são <Texto> (Atkinson) por cima do desenho; o gráfico inteiro tem um accessibilityLabel.
import React, { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Texto, espaco, useTema } from "@levia/ui";

export type Traco = "cheio" | "tracejado" | "pontilhado";

export interface Serie {
  nome: string;
  valores: (number | null)[];
  traco: Traco;
  cor: string;
}

const DASH: Record<Traco, string | undefined> = { cheio: undefined, tracejado: "7 5", pontilhado: "1 5" };
const ALTURA = 180;
const MARGEM = { topo: 10, base: 26, esq: 34, dir: 104 }; // dir: espaço para o rótulo no fim da linha
const ALTURA_ROTULO = 18;

export function Linhas({
  meses,
  series,
  max = 100,
  rotuloA11y,
}: {
  meses: string[];
  series: Serie[];
  max?: number;
  rotuloA11y: string;
}) {
  const t = useTema();
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  const w = Math.max(0, largura - MARGEM.esq - MARGEM.dir);
  const h = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (i: number) => MARGEM.esq + (meses.length <= 1 ? w / 2 : (i * w) / (meses.length - 1));
  const y = (v: number) => MARGEM.topo + h - (Math.min(Math.max(v, 0), max) / max) * h;

  // segmentos contínuos de cada série (null quebra a linha)
  const segmentos = (vals: (number | null)[]) => {
    const out: { i: number; v: number }[][] = [];
    let atual: { i: number; v: number }[] = [];
    vals.forEach((v, i) => {
      if (v === null) {
        if (atual.length) out.push(atual);
        atual = [];
      } else atual.push({ i, v });
    });
    if (atual.length) out.push(atual);
    return out;
  };

  // rótulos no fim de cada linha, afastados verticalmente para não se sobreporem
  const finais = series
    .map((s) => {
      const ult = s.valores
        .map((v, i) => ({ v, i }))
        .filter((p): p is { v: number; i: number } => p.v !== null)
        .pop();
      return ult ? { nome: s.nome, xFim: x(ult.i), yFim: y(ult.v) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.yFim - b.yFim);
  const rotulos: { nome: string; xFim: number; topo: number }[] = [];
  for (const r of finais) {
    const anterior = rotulos[rotulos.length - 1];
    const topo = Math.max(r.yFim - ALTURA_ROTULO / 2, anterior ? anterior.topo + ALTURA_ROTULO : -Infinity);
    rotulos.push({ nome: r.nome, xFim: r.xFim, topo });
  }

  const grade = [0, max / 2, max];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotuloA11y}
      onLayout={aoMedir}
      style={{ height: ALTURA }}
    >
      {largura > 0 && (
        <>
          <Svg
            width={largura}
            height={ALTURA}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {grade.map((g) => (
              <Line
                key={g}
                x1={MARGEM.esq}
                x2={MARGEM.esq + w}
                y1={y(g)}
                y2={y(g)}
                stroke={t.borda}
                strokeWidth={1}
              />
            ))}
            {series.map((s) =>
              segmentos(s.valores).map((seg, k) =>
                seg.length === 1 ? (
                  <Circle key={`${s.nome}-${k}`} cx={x(seg[0]!.i)} cy={y(seg[0]!.v)} r={4} fill={s.cor} />
                ) : (
                  <Path
                    key={`${s.nome}-${k}`}
                    d={seg.map((p, j) => `${j ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ")}
                    stroke={s.cor}
                    strokeWidth={2.5}
                    strokeDasharray={DASH[s.traco]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ),
              ),
            )}
          </Svg>
          {/* eixo y */}
          {grade.map((g) => (
            <Texto
              key={g}
              variante="pequeno"
              cor={t.textoSuave}
              maxFontSizeMultiplier={1.2}
              style={{
                position: "absolute",
                left: 0,
                top: y(g) - 9,
                width: MARGEM.esq - espaco.xs,
                textAlign: "right",
              }}
            >
              {g}
            </Texto>
          ))}
          {/* eixo x: primeiro e último mês */}
          {meses.length > 0 && (
            <Texto
              variante="pequeno"
              cor={t.textoSuave}
              maxFontSizeMultiplier={1.2}
              style={{ position: "absolute", left: MARGEM.esq - 8, top: ALTURA - MARGEM.base + 4 }}
            >
              {meses[0]}
            </Texto>
          )}
          {meses.length > 1 && (
            <Texto
              variante="pequeno"
              cor={t.textoSuave}
              maxFontSizeMultiplier={1.2}
              style={{
                position: "absolute",
                left: MARGEM.esq + w - 40,
                top: ALTURA - MARGEM.base + 4,
                width: 56,
                textAlign: "center",
              }}
            >
              {meses[meses.length - 1]}
            </Texto>
          )}
          {/* rótulo no fim de cada linha (identidade pelo texto, não pela cor) */}
          {rotulos.map((r) => (
            <Texto
              key={r.nome}
              variante="pequeno"
              negrito
              cor={t.texto}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              style={{
                position: "absolute",
                left: r.xFim + espaco.s,
                top: r.topo,
                width: MARGEM.dir - espaco.s,
              }}
            >
              {r.nome}
            </Texto>
          ))}
        </>
      )}
    </View>
  );
}

/** Amostra do traço, para a legenda escrita abaixo do gráfico. */
export function AmostraTraco({ traco, cor }: { traco: Traco; cor: string }) {
  return (
    <Svg width={28} height={10} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line
        x1={2}
        x2={26}
        y1={5}
        y2={5}
        stroke={cor}
        strokeWidth={2.5}
        strokeDasharray={DASH[traco]}
        strokeLinecap="round"
      />
    </Svg>
  );
}
