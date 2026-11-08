import { carregarConteudo } from "@levia/content";
import type { RespostasConfirmadas } from "@levia/shared";

export const conteudo = carregarConteudo();
export const arvore = conteudo.arvore;
export const HOJE = "2026-11-08";

/** Caso base: lombar, 3 dias, nota 4, sem alerta, STarT baixo -> saída 1. */
export function base(over: Partial<RespostasConfirmadas> = {}): RespostasConfirmadas {
  return {
    regioes: ["lombar"],
    duracaoDias: 3,
    dorNota: 4,
    achados: {},
    startBack: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ...over,
  };
}
