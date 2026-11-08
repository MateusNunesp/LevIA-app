// Dados simulados do mapa de calor do Ritmo (por enquanto, a pedido do time).
// TODO(mock): trocar por placar.minhasAtividades, que a API já devolve (só da própria pessoa).
import type { DiaAtividade } from "./MapaCalor.tsx";

export const USAR_ATIVIDADES_SIMULADAS = true;

// quantidade de atividades por dia, do mais antigo (13 dias atrás) até hoje — padrão fixo, sem sorteio
const PADRAO = [1, 0, 2, 3, 1, 0, 0, 2, 4, 1, 3, 0, 2, 1];

function somarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** 14 dias simulados terminando em `hoje` (AAAA-MM-DD). */
export function atividadesSimuladas(hoje: string): DiaAtividade[] {
  return PADRAO.map((quantidade, i) => ({ dia: somarDias(hoje, i - 13), quantidade, planoAtivo: true }));
}
