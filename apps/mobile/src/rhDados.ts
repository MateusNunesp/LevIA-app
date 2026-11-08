import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api, type CelulaRh } from "./api.ts";

export function useAgregados() {
  const [celulas, setCelulas] = useState<CelulaRh[]>([]);
  const [aviso, setAviso] = useState("Grupos com menos de 10 pessoas ficam ocultos.");
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    try {
      const r = await api.agregados();
      setCelulas(r.celulas);
      setAviso(r.aviso);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar os números agora.");
    }
  }, []);
  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));
  const meses = [...new Set(celulas.map((c) => c.mes))].sort();
  const setores = [...new Set(celulas.map((c) => c.setor))].filter((s) => s !== "Toda a empresa");
  const pegar = (setor: string, mes: string, indicador: string) => celulas.find((c) => c.setor === setor && c.mes === mes && c.indicador === indicador);
  // Mês de referência: o mais recente em que o total da empresa já tem 10 pessoas ou mais.
  const mesesVisiveis = meses.filter((m) => pegar("Toda a empresa", m, "pessoas_ativas")?.suprimido === false);
  const mesReferencia = mesesVisiveis[mesesVisiveis.length - 1] ?? meses[meses.length - 1];
  return { celulas, aviso, erro, carregar, meses, setores, pegar, mesReferencia };
}

export function nomeMes(m: string): string {
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [a, mm] = m.split("-");
  return `${nomes[Number(mm) - 1]}/${a}`;
}
