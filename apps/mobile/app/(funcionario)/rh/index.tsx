// Área do RH: "Visão geral" como painel. Só agregados com k >= 10; célula suprimida é sempre "menos de 10", nunca 0.
import React from "react";
import { View } from "react-native";
import { Texto, espaco, useTema } from "@levia/ui";
import { REGIOES, NOME_REGIAO } from "@levia/shared";
import { Bloco, Tela } from "../../../src/Tela.tsx";
import { AbasRh } from "../../../src/AbasRh.tsx";
import { AmostraTraco, Linhas, type Serie, type Traco } from "../../../src/Linhas.tsx";
import { SeletorDemo } from "../../../src/SeletorDemo.tsx";
import { nomeMes, useAgregados } from "../../../src/rhDados.ts";

const TODA = "Toda a empresa";
const SUPRIMIDO = "menos de 10";
const TRACOS: Traco[] = ["cheio", "tracejado", "pontilhado"];

type Agregados = ReturnType<typeof useAgregados>;

/** Valor visível da célula, ou null se suprimida ou ausente. */
function valor(a: Agregados, setor: string, mes: string | undefined, indicador: string): number | null {
  if (!mes) return null;
  const c = a.pegar(setor, mes, indicador);
  return c && !c.suprimido && c.valor !== null ? c.valor : null;
}

function mesAnterior(a: Agregados, mes: string | undefined): string | undefined {
  if (!mes) return undefined;
  const i = a.meses.indexOf(mes);
  return i > 0 ? a.meses[i - 1] : undefined;
}

/** Região mais citada num setor e mês, entre as células visíveis. */
function regiaoMaisCitada(a: Agregados, setor: string, mes: string | undefined) {
  let melhor: { regiao: (typeof REGIOES)[number]; n: number } | null = null;
  for (const r of REGIOES) {
    const n = valor(a, setor, mes, `regiao_${r}`);
    if (n !== null && n > 0 && (!melhor || n > melhor.n)) melhor = { regiao: r, n };
  }
  return melhor;
}

function sinal(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

// ---------- 1. indicadores ----------

function Cartao({
  rotulo,
  valorTexto,
  detalhe,
  suprimido,
}: {
  rotulo: string;
  valorTexto: string;
  detalhe?: string;
  suprimido?: boolean;
}) {
  const t = useTema();
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${valorTexto}${detalhe ? `. ${detalhe}` : ""}`}
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        backgroundColor: t.fundo,
        borderColor: t.borda,
        borderWidth: 1,
        borderRadius: 14,
        padding: espaco.m,
        gap: 2,
        minHeight: 96,
      }}
    >
      <Texto variante="pequeno" cor={t.textoSuave}>
        {rotulo}
      </Texto>
      <Texto variante={suprimido ? "corpo" : "titulo"} negrito cor={suprimido ? t.textoSuave : t.texto}>
        {valorTexto}
      </Texto>
      {detalhe ? (
        <Texto variante="pequeno" cor={t.textoSuave}>
          {detalhe}
        </Texto>
      ) : null}
    </View>
  );
}

function Indicadores({ a }: { a: Agregados }) {
  const mes = a.mesReferencia;
  const ant = mesAnterior(a, mes);
  const pessoas = valor(a, TODA, mes, "pessoas_ativas");
  const pessoasAnt = valor(a, TODA, ant, "pessoas_ativas");
  const ritmo = valor(a, TODA, mes, "ritmo_constancia_pct");
  const ritmoAnt = valor(a, TODA, ant, "ritmo_constancia_pct");
  const noRanking = a.setores.filter((s) => valor(a, s, mes, "ritmo_constancia_pct") !== null).length;
  const regiao = regiaoMaisCitada(a, TODA, mes);
  const sobre = ant ? ` sobre ${nomeMes(ant)}` : "";

  const varPessoas =
    pessoas !== null && pessoasAnt !== null && pessoasAnt > 0
      ? `${sinal(Math.round(((pessoas - pessoasAnt) / pessoasAnt) * 100))}%${sobre}`
      : "sem comparação";
  const varRitmo =
    ritmo !== null && ritmoAnt !== null ? `${sinal(ritmo - ritmoAnt)} pontos${sobre}` : "sem comparação";

  return (
    <Bloco>
      <Texto negrito accessibilityRole="header">
        Indicadores de {mes ? nomeMes(mes) : "—"}
      </Texto>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.s }}>
        <Cartao
          rotulo="Pessoas ativas"
          valorTexto={pessoas === null ? SUPRIMIDO : String(pessoas)}
          detalhe={varPessoas}
          suprimido={pessoas === null}
        />
        <Cartao
          rotulo="Constância no Ritmo"
          valorTexto={ritmo === null ? SUPRIMIDO : `${ritmo}%`}
          detalhe={varRitmo}
          suprimido={ritmo === null}
        />
        <Cartao
          rotulo="Setores no ranking"
          valorTexto={`${noRanking} de ${a.setores.length}`}
          detalhe="com 10 pessoas ou mais no Ritmo"
        />
        <Cartao
          rotulo="Região mais citada"
          valorTexto={regiao ? NOME_REGIAO[regiao.regiao] : SUPRIMIDO}
          detalhe={regiao ? `${regiao.n} pessoas` : undefined}
          suprimido={!regiao}
        />
      </View>
    </Bloco>
  );
}

// ---------- 2. evolução ----------

function Evolucao({ a }: { a: Agregados }) {
  const t = useTema();
  const meses = a.meses.slice(-6);
  const cores = [t.primaria, t.primariaProfunda, t.textoSuave];
  const comDados = a.setores
    .map((s) => ({ s, valores: meses.map((m) => valor(a, s, m, "ritmo_constancia_pct")) }))
    .filter((x) => x.valores.some((v) => v !== null))
    // as 3 equipes com o valor mais recente maior; as outras ficam citadas no texto (sem repetir cor e traço)
    .sort(
      (x, y) =>
        (y.valores.filter((v) => v !== null).pop() ?? -1) - (x.valores.filter((v) => v !== null).pop() ?? -1),
    );
  const series: Serie[] = comDados
    .slice(0, 3)
    .map((x, i) => ({ nome: x.s, valores: x.valores, traco: TRACOS[i]!, cor: cores[i]! }));
  const outras = comDados.slice(3).map((x) => x.s);
  const semDados = a.setores.filter((s) => !comDados.some((x) => x.s === s));

  const resumo =
    `Constância no Ritmo por equipe, de ${meses[0] ? nomeMes(meses[0]) : "—"} a ${meses.length ? nomeMes(meses[meses.length - 1]!) : "—"}. ` +
    (series.length
      ? series
          .map(
            (s) =>
              `${s.nome}: ${s.valores.map((v, i) => `${nomeMes(meses[i]!)} ${v === null ? SUPRIMIDO : `${v}%`}`).join(", ")}`,
          )
          .join(". ")
      : "Nenhuma equipe com 10 pessoas ou mais no Ritmo nesses meses") +
    (semDados.length ? `. Sem dados visíveis: ${semDados.join(", ")}` : "");

  return (
    <Bloco>
      <Texto negrito accessibilityRole="header">
        Evolução das equipes
      </Texto>
      <Texto variante="pequeno" cor={t.textoSuave}>
        Constância no Ritmo (%), últimos {meses.length} meses. Meses com menos de 10 pessoas ficam em branco.
      </Texto>
      {series.length ? (
        <>
          <Linhas meses={meses.map(nomeMes)} series={series} rotuloA11y={resumo} />
          <View
            style={{ gap: espaco.xs }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {series.map((s) => (
              <View key={s.nome} style={{ flexDirection: "row", alignItems: "center", gap: espaco.s }}>
                <AmostraTraco traco={s.traco} cor={s.cor} />
                <Texto variante="pequeno">{s.nome}</Texto>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Texto accessibilityLabel={resumo}>
          Nenhuma equipe com 10 pessoas ou mais no Ritmo nesses meses.
        </Texto>
      )}
      {outras.length > 0 && (
        <Texto variante="pequeno" cor={t.textoSuave}>
          Também no Ritmo: {outras.join(", ")}.
        </Texto>
      )}
      {semDados.length > 0 && (
        <Texto variante="pequeno" cor={t.textoSuave}>
          Sem dados visíveis ({SUPRIMIDO}): {semDados.join(", ")}.
        </Texto>
      )}
    </Bloco>
  );
}

// ---------- 3. ranking ----------

function Ranking({ a }: { a: Agregados }) {
  const t = useTema();
  // mês do ranking: o mais recente em que alguma equipe tem constância visível
  const mes =
    [...a.meses]
      .reverse()
      .find((m) => a.setores.some((s) => valor(a, s, m, "ritmo_constancia_pct") !== null)) ?? a.mesReferencia;
  const ant = mesAnterior(a, mes);
  const linhas = a.setores.map((s) => ({
    s,
    v: valor(a, s, mes, "ritmo_constancia_pct"),
    antes: valor(a, s, ant, "ritmo_constancia_pct"),
  }));
  const visiveis = linhas
    .filter((l) => l.v !== null)
    .sort((x, y) => (y.v as number) - (x.v as number) || x.s.localeCompare(y.s, "pt-BR"));
  const ocultas = linhas.filter((l) => l.v === null).sort((x, y) => x.s.localeCompare(y.s, "pt-BR"));

  return (
    <Bloco>
      <Texto negrito accessibilityRole="header">
        Ranking das equipes{mes ? ` em ${nomeMes(mes)}` : ""}
      </Texto>
      <Texto variante="pequeno" cor={t.textoSuave}>
        Constância no Ritmo. A variação é contra o mês anterior.
      </Texto>
      {visiveis.map((l, i) => {
        const delta = l.antes !== null ? (l.v as number) - l.antes : null;
        const textoDelta = delta === null ? "" : `${sinal(delta)} pts`;
        return (
          <View
            key={l.s}
            accessible
            accessibilityLabel={`${i + 1}º lugar, ${l.s}, ${l.v} por cento${delta === null ? "" : `, ${delta >= 0 ? "subiu" : "caiu"} ${Math.abs(delta)} pontos`}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.m,
              minHeight: 44,
              borderBottomWidth: 1,
              borderBottomColor: t.borda,
            }}
          >
            <Texto negrito style={{ width: 32 }}>
              {i + 1}º
            </Texto>
            <Texto style={{ flex: 1 }} numberOfLines={1}>
              {l.s}
            </Texto>
            <Texto negrito>{l.v}%</Texto>
            <Texto
              variante="pequeno"
              cor={delta !== null && delta < 0 ? t.textoSuave : t.primaria}
              style={{ width: 56, textAlign: "right" }}
            >
              {textoDelta}
            </Texto>
          </View>
        );
      })}
      {ocultas.map((l) => (
        <View
          key={l.s}
          accessible
          accessibilityLabel={`${l.s}, ${SUPRIMIDO} no Ritmo, sem posição`}
          style={{ flexDirection: "row", alignItems: "center", gap: espaco.m, minHeight: 44 }}
        >
          <Texto cor={t.textoSuave} style={{ width: 32 }}>
            –
          </Texto>
          <Texto cor={t.textoSuave} style={{ flex: 1 }} numberOfLines={1}>
            {l.s}
          </Texto>
          <Texto variante="pequeno" cor={t.textoSuave}>
            {SUPRIMIDO}
          </Texto>
        </View>
      ))}
      {visiveis.length === 0 && ocultas.length === 0 && (
        <Texto cor={t.textoSuave}>Ainda não há equipes.</Texto>
      )}
    </Bloco>
  );
}

// ---------- 4. onde mais dói ----------

function OndeMaisDoi({ a }: { a: Agregados }) {
  const t = useTema();
  const mes = a.mesReferencia;
  return (
    <Bloco>
      <Texto negrito accessibilityRole="header">
        Onde mais dói, por setor{mes ? ` em ${nomeMes(mes)}` : ""}
      </Texto>
      {a.setores.map((s) => {
        const r = regiaoMaisCitada(a, s, mes);
        return (
          <View
            key={s}
            accessible
            accessibilityLabel={r ? `${s}: ${NOME_REGIAO[r.regiao]}, ${r.n} pessoas` : `${s}: ${SUPRIMIDO}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: espaco.m,
              minHeight: 44,
            }}
          >
            <Texto style={{ flex: 1 }} numberOfLines={1}>
              {s}
            </Texto>
            {r ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.s }}>
                <View
                  style={{
                    backgroundColor: t.primariaSuave,
                    borderRadius: 10,
                    paddingHorizontal: espaco.m,
                    paddingVertical: espaco.xs,
                  }}
                >
                  <Texto variante="pequeno" negrito cor={t.primariaProfunda}>
                    {NOME_REGIAO[r.regiao]}
                  </Texto>
                </View>
                <Texto variante="pequeno" cor={t.textoSuave}>
                  {r.n} pessoas
                </Texto>
              </View>
            ) : (
              <Texto variante="pequeno" cor={t.textoSuave}>
                {SUPRIMIDO}
              </Texto>
            )}
          </View>
        );
      })}
    </Bloco>
  );
}

export default function VisaoGeral() {
  const t = useTema();
  const a = useAgregados();
  return (
    <Tela titulo="Visão geral" onAtualizar={a.carregar}>
      <AbasRh />
      <Texto cor={t.textoSuave}>{a.aviso}</Texto>
      {a.erro && <Texto>{a.erro}</Texto>}
      <Indicadores a={a} />
      <Evolucao a={a} />
      <Ranking a={a} />
      <OndeMaisDoi a={a} />
      <SeletorDemo />
    </Tela>
  );
}
