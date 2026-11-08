// Monta as mensagens do resultado a partir do TriageResult. Só templates aprovados.
import type { MensagemLevia, Regiao, TriageResult } from "@levia/shared";
import { texto as tx, type Catalogo, type Exercicio, type Textos } from "@levia/content";

export interface DadosResultado {
  episodioId: string;
  regioes: Regiao[];
  /** AAAA-MM-DD da próxima checagem (só saída 1) */
  proximaChecagem?: string;
}

const MAX_EXERCICIOS = 4;

/** Exercícios do plano: só do catálogo (R8), só na saída 1 (D4), ordem determinística. */
export function escolherExercicios(catalogo: Catalogo, regioes: readonly Regiao[]): Exercicio[] {
  const out: Exercicio[] = [];
  for (const r of regioes) {
    for (const e of catalogo.exercicios) {
      if (out.length >= MAX_EXERCICIOS) return out;
      if (e.regioes.includes(r) && !out.some((o) => o.id === e.id)) {
        out.push(e);
        if (out.filter((o) => o.regioes.includes(r)).length >= 2) break;
      }
    }
  }
  return out;
}

export function textoDose(e: Exercicio): string {
  const d = e.dose;
  return `${d.series} séries de ${d.repeticoes}, ${d.vezes_por_semana} vezes por semana. No máximo ${d.maximo_por_dia} por dia.`;
}

function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function montarResultado(
  r: TriageResult,
  conteudo: { textos: Textos; catalogo: Catalogo },
  dados: DadosResultado,
): { mensagens: MensagemLevia[]; exercicios: Exercicio[] } {
  const t = conteudo.textos;
  const mensagens: MensagemLevia[] = [];
  if (r.emergencia) {
    mensagens.push({ tipo: "emergencia", motivo: "alerta", texto: tx(t, "emergencia.cardiaca"), telefones: ["192"] });
  }
  let corpo = tx(t, `saida${r.saida}.texto`);
  if (r.saida === 3 && r.urgenteHoje) corpo = `${tx(t, "saida3.urgente")} ${corpo} ${tx(t, "saida3.emergencia")}`;
  else if (r.saida === 3) corpo = `${corpo} ${tx(t, "saida3.emergencia")}`;
  if (r.saida === 1 && dados.proximaChecagem) corpo = `${corpo} ${tx(t, "saida1.checagem", { data: dataBr(dados.proximaChecagem) })}`;
  mensagens.push({
    tipo: "resultado",
    saida: r.saida,
    urgenteHoje: r.urgenteHoje,
    titulo: tx(t, `saida${r.saida}.titulo`),
    texto: corpo,
    porque: tx(t, r.porque),
    episodioId: dados.episodioId,
  });
  mensagens.push({
    tipo: "resumo",
    episodioId: dados.episodioId,
    texto: r.saida === 1 ? tx(t, "resumo.texto") : `${tx(t, "resumo.leve")} ${tx(t, "resumo.texto")}`,
  });
  // D4: nas saídas 2 e 3, nenhum exercício (nem novo, nem antigo).
  const exercicios = r.exerciciosPermitidos && r.saida === 1 ? escolherExercicios(conteudo.catalogo, dados.regioes) : [];
  for (const e of exercicios) {
    mensagens.push({ tipo: "exercicio", exercicioId: e.id, nome: e.nome, passos: e.passos, dose: textoDose(e), quandoParar: e.quando_parar });
  }
  return { mensagens, exercicios };
}
