// Mapa de calor das 2 últimas semanas no Ritmo: um quadrado por dia, mais forte quanto mais atividades.
// Só a própria pessoa vê. Dia sem atividade fica vazio (só a borda).
import React from "react";
import { View } from "react-native";
import { Texto, espaco, useTema } from "@levia/ui";

export interface DiaAtividade {
  dia: string; // AAAA-MM-DD
  quantidade: number;
  planoAtivo: boolean;
}

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const INICIAL = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
// intensidade da cor por nível (0 = nenhuma atividade; 4 = 4 ou mais)
const OPACIDADE = [0, 0.3, 0.55, 0.8, 1];

/** Cor sólida do nível: primária misturada ao fundo. Sólida para não sobrar anel sob a borda transparente. */
function corNivel(n: number, primaria: string, fundo: string): string {
  const canal = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const f = OPACIDADE[n] ?? 0;
  const c = [0, 1, 2].map((i) => Math.round(canal(fundo, i) + (canal(primaria, i) - canal(fundo, i)) * f));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const data = (iso: string) => new Date(`${iso}T12:00:00Z`);
const nivel = (q: number) => Math.min(q, 4);

function rotulo(d: DiaAtividade, hoje: string): string {
  const dt = data(d.dia);
  const quando = `${d.dia === hoje ? "hoje, " : ""}${SEMANA[dt.getUTCDay()]}, ${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()]}`;
  if (d.quantidade === 0) return `${quando}: nenhuma atividade`;
  return `${quando}: ${d.quantidade} ${d.quantidade === 1 ? "atividade" : "atividades"}`;
}

export function MapaCalor({ dias, hoje }: { dias: DiaAtividade[]; hoje: string }) {
  const t = useTema();
  const semanas = [dias.slice(0, 7), dias.slice(7, 14)];
  const total = dias.reduce((a, d) => a + d.quantidade, 0);
  const comAtividade = dias.filter((d) => d.quantidade > 0).length;

  const Quadrado = ({ d }: { d: DiaAtividade }) => {
    const n = nivel(d.quantidade);
    const eHoje = d.dia === hoje;
    return (
      <View
        accessible
        accessibilityLabel={rotulo(d, hoje)}
        style={{
          flex: 1,
          aspectRatio: 1,
          minHeight: 36,
          borderRadius: 8,
          // mesma borda em todos os dias (transparente nos coloridos), para o número ficar sempre na mesma altura
          borderWidth: 2,
          borderColor: eHoje ? t.primariaProfunda : n === 0 ? t.borda : "transparent",
          backgroundColor: corNivel(n, t.primaria, t.fundo),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Texto
          variante="pequeno"
          negrito={eHoje}
          maxFontSizeMultiplier={1.2}
          cor={n >= 3 ? t.sobrePrimaria : n > 0 ? t.primariaProfunda : t.textoSuave}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {data(d.dia).getUTCDate()}
        </Texto>
      </View>
    );
  };

  return (
    <View style={{ gap: espaco.s }}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`Suas últimas 2 semanas: ${total} ${total === 1 ? "atividade" : "atividades"} em ${comAtividade} ${comAtividade === 1 ? "dia" : "dias"}`}
      >
        <Texto negrito>Suas últimas 2 semanas</Texto>
        <Texto variante="pequeno" cor={t.textoSuave}>
          {total} {total === 1 ? "atividade" : "atividades"} em {comAtividade}{" "}
          {comAtividade === 1 ? "dia" : "dias"}. Só você vê isto.
        </Texto>
      </View>
      {/* dias da semana (as duas linhas começam no mesmo dia da semana) */}
      <View
        style={{ flexDirection: "row", gap: espaco.xs }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {semanas[0]!.map((d) => (
          <Texto
            key={d.dia}
            variante="pequeno"
            cor={t.textoSuave}
            style={{ flex: 1, textAlign: "center" }}
            maxFontSizeMultiplier={1.2}
          >
            {INICIAL[data(d.dia).getUTCDay()]}
          </Texto>
        ))}
      </View>
      {semanas.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", gap: espaco.xs }}>
          {s.map((d) => (
            <Quadrado key={d.dia} d={d} />
          ))}
        </View>
      ))}
      {/* legenda */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: espaco.xs, flexWrap: "wrap" }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Texto variante="pequeno" cor={t.textoSuave}>
          Menos
        </Texto>
        {[0, 1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              borderWidth: n === 0 ? 1.5 : 0,
              borderColor: t.borda,
              backgroundColor: t.fundo,
              overflow: "hidden",
            }}
          >
            {n > 0 && <View style={{ flex: 1, backgroundColor: t.primaria, opacity: OPACIDADE[n] }} />}
          </View>
        ))}
        <Texto variante="pequeno" cor={t.textoSuave}>
          Mais
        </Texto>
      </View>
    </View>
  );
}
