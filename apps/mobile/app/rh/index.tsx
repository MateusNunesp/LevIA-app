import React from "react";
import { Texto, useTema } from "@levia/ui";
import { REGIOES, NOME_REGIAO } from "@levia/shared";
import { Bloco, Tela } from "../../src/Tela.tsx";
import { Barras } from "../../src/Barras.tsx";
import { SeletorDemo } from "../../src/SeletorDemo.tsx";
import { nomeMes, useAgregados } from "../../src/rhDados.ts";

export default function VisaoGeral() {
  const t = useTema();
  const a = useAgregados();
  const ultimo = a.mesReferencia;
  const TODA = "Toda a empresa";
  return (
    <Tela titulo="Visão geral" onAtualizar={a.carregar}>
      <Texto cor={t.textoSuave}>{a.aviso}</Texto>
      {a.erro && <Texto>{a.erro}</Texto>}
      <Bloco>
        <Texto negrito accessibilityRole="header">Pessoas ativas por mês</Texto>
        <Barras dados={a.meses.map((m) => {
          const c = a.pegar(TODA, m, "pessoas_ativas");
          return { rotulo: nomeMes(m), valor: c?.valor ?? null, suprimido: c?.suprimido ?? true };
        })} />
      </Bloco>
      {ultimo && (
        <Bloco>
          <Texto negrito accessibilityRole="header">Resultados em {nomeMes(ultimo)}</Texto>
          <Barras dados={[1, 2, 3].map((s) => {
            const c = a.pegar(TODA, ultimo, `saida_${s}`);
            const nome = s === 1 ? "Cuidar em casa" : s === 2 ? "Fisioterapeuta por vídeo" : "Atendimento presencial";
            return { rotulo: nome, valor: c?.valor ?? null, suprimido: c?.suprimido ?? true };
          })} />
        </Bloco>
      )}
      {ultimo && (
        <Bloco>
          <Texto negrito accessibilityRole="header">Regiões mais citadas em {nomeMes(ultimo)}</Texto>
          <Barras dados={REGIOES.map((r) => {
            const c = a.pegar(TODA, ultimo, `regiao_${r}`);
            return { rotulo: NOME_REGIAO[r], valor: c?.valor ?? null, suprimido: c?.suprimido ?? true };
          }).filter((d) => d.suprimido || (d.valor ?? 0) > 0).sort((x, y) => (y.valor ?? -1) - (x.valor ?? -1))} />
        </Bloco>
      )}
      {ultimo && (
        <Bloco>
          <Texto negrito accessibilityRole="header">Constância média do Ritmo</Texto>
          <Barras unidade="%" dados={[{ rotulo: nomeMes(ultimo), valor: a.pegar(TODA, ultimo, "ritmo_constancia_pct")?.valor ?? null, suprimido: a.pegar(TODA, ultimo, "ritmo_constancia_pct")?.suprimido ?? true }]} />
        </Bloco>
      )}
      <SeletorDemo />
    </Tela>
  );
}
