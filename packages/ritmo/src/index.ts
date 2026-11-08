// Ritmo: constância por equipe (D6, D8, D11). Puro.
// - no máximo 1 ponto por dia por pessoa, só com exercício do plano ativo, dentro da dose (M9);
// - dias em pausa (saídas 2 e 3) são neutros: não somam, não tiram, saem do denominador;
// - equipes com menos de 5 participantes não aparecem;
// - nunca há pontuação individual visível para a equipe nem para o RH.
import { diasEntre } from "@levia/shared";

export const MINIMO_EQUIPE = 5;
export const MAX_REGISTROS_DIA = 20;
export const JANELA_RETROATIVA_HORAS = 24;

export interface ExercicioDoPlano {
  id: string;
  maximoPorDia: number;
}

export interface PlanoAtual {
  status: "ativo" | "pausado" | "encerrado";
  exercicios: ExercicioDoPlano[];
}

export interface RegistroExistente {
  exercicioId: string;
  dia: string;
  quantidade: number;
}

export type MotivoRecusa =
  | "sem_plano_ativo"
  | "fora_do_plano"
  | "acima_da_dose"
  | "retroativo"
  | "futuro"
  | "limite_diario"
  | "quantidade_invalida";

export function validarRegistro(
  plano: PlanoAtual | null,
  existentes: RegistroExistente[],
  novo: { exercicioId: string; dia: string; quantidade: number },
  hoje: string,
): { ok: true } | { ok: false; motivo: MotivoRecusa } {
  if (!plano || plano.status !== "ativo") return { ok: false, motivo: "sem_plano_ativo" };
  const ex = plano.exercicios.find((e) => e.id === novo.exercicioId);
  if (!ex) return { ok: false, motivo: "fora_do_plano" };
  if (!Number.isInteger(novo.quantidade) || novo.quantidade < 1) return { ok: false, motivo: "quantidade_invalida" };
  const d = diasEntre(novo.dia, hoje);
  if (d < 0) return { ok: false, motivo: "futuro" };
  // registro do dia anterior só vale dentro de 24 h (aproximação por dia de calendário)
  if (d > JANELA_RETROATIVA_HORAS / 24) return { ok: false, motivo: "retroativo" };
  const doDia = existentes.filter((r) => r.dia === novo.dia);
  if (doDia.length >= MAX_REGISTROS_DIA) return { ok: false, motivo: "limite_diario" };
  const feitas = doDia.filter((r) => r.exercicioId === novo.exercicioId).reduce((a, r) => a + r.quantidade, 0);
  if (feitas + novo.quantidade > ex.maximoPorDia) return { ok: false, motivo: "acima_da_dose" };
  return { ok: true };
}

export interface DiaPessoa {
  dia: string;
  /** plano ativo naquele dia (false = pausa ou sem plano -> dia neutro) */
  planoAtivo: boolean;
  /** houve ao menos um registro válido do plano, dentro da dose */
  cumpriu: boolean;
}

/** Pontos de uma pessoa: dias cumpridos (máx 1 por dia) e dias que contam (não neutros). */
export function constanciaPessoa(dias: DiaPessoa[]): { cumpridos: number; contam: number } {
  const porDia = new Map<string, DiaPessoa>();
  for (const d of dias) {
    const atual = porDia.get(d.dia);
    // duplicado do mesmo dia nunca vale 2 pontos
    porDia.set(d.dia, atual ? { dia: d.dia, planoAtivo: atual.planoAtivo || d.planoAtivo, cumpriu: atual.cumpriu || d.cumpriu } : d);
  }
  let cumpridos = 0;
  let contam = 0;
  for (const d of porDia.values()) {
    if (!d.planoAtivo) continue; // neutro
    contam += 1;
    if (d.cumpriu) cumpridos += 1;
  }
  return { cumpridos, contam };
}

export interface EquipeEntrada {
  setorId: string;
  nome: string;
  membros: DiaPessoa[][];
}

export interface PlacarEquipe {
  setorId: string;
  nome: string;
  /** média, entre participantes ativos, da fração de dias cumpridos — em % inteiro */
  constancia: number;
  participantes: number;
}

export function placar(equipes: EquipeEntrada[], minimo = MINIMO_EQUIPE): PlacarEquipe[] {
  const out: PlacarEquipe[] = [];
  for (const e of equipes) {
    // participantes do Ritmo (inclusive os em pausa) definem se a equipe aparece
    if (e.membros.length < minimo) continue;
    const fracoes = e.membros
      .map(constanciaPessoa)
      .filter((p) => p.contam > 0) // participante ativo = tem dias que contam
      .map((p) => p.cumpridos / p.contam);
    const constancia = fracoes.length ? Math.round((fracoes.reduce((a, b) => a + b, 0) / fracoes.length) * 100) : 0;
    out.push({ setorId: e.setorId, nome: e.nome, constancia, participantes: e.membros.length });
  }
  return out.sort((a, b) => b.constancia - a.constancia || a.nome.localeCompare(b.nome));
}
