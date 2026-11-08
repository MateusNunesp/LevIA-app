// Guardrails do chatbot (R12, M10). Resposta padrão aprovada, sem variação.
import { normalizarTexto } from "@levia/shared";

export type Guardrail = "diagnostico" | "profissional" | "exercicio_fora" | "contra_diretriz" | "porque" | "fora_escopo";

const R: [Guardrail, RegExp][] = [
  [
    "profissional",
    /\b(me indica\w*|indicacao|indique|recomenda\w* (um|uma|algum|alguma)|qual (fisio\w*|clinica|medico|ortopedista|profissional|hospital)|marca\w* (uma )?consulta|agenda\w*|onde (eu )?(procuro|acho|encontro|vou)|telefone d[ae]|contato d[ae]|bom (fisio\w*|medico|ortopedista)|plano (de saude )?(cobre|aceita))\b/,
  ],
  [
    "contra_diretriz",
    /\b(cinta|colete|repouso|(ficar|fico|devo ficar) (deitad[oa]|de cama|parad[oa])|de cama|deitad[oa] o dia|ressonancia|raio ?x|tomografia|exame de imagem|ultrassom|ultrasom|fazer (um )?exame|faco (um )?exame|preciso de (um )?exame|pedir (um )?exame)\b/,
  ],
  [
    "exercicio_fora",
    /\b((me )?(passa|manda|da|ensina|indica)\w* (um|uns|algum|alguns)? ?(exercicio|alongamento)\w*|(exercicio|alongamento)s? (pra|para|de) \w+|que (exercicio|alongamento)|qual (exercicio|alongamento)|pilates|musculacao|academia|crossfit)\b/,
  ],
  [
    "diagnostico",
    /\b(hernia\w*|bico de papagaio|artrose|artrite|tendinite|bursite|escoliose|ciatic[oa]|fibromialgia|lombalgia|diagnostic\w*|o que (eu )?tenho|o que (e|sera) isso|e grave|e serio|sera que (e|tenho)|remedio\w*|medicamento\w*|medicacao|dipirona|ibuprofeno|paracetamol|tylenol|dorflex|nimesulida|diclofenaco|cataflam|torsilax|buscopan|novalgina|neosaldina|relaxante\w*|anti[ -]?inflamatori\w*|pomada|posso tomar|tomar o que|o que (eu )?tomo|que (eu )?tomo|comprimido|injecao|dose|miosan|cetoprofeno|naproxeno|codeina|tramadol)\b/,
  ],
  ["fora_escopo", /\b(piada|previsao do tempo|futebol|receita de|horoscopo|bitcoin|politica|me conta uma historia)\b/],
];

export function detectarGuardrail(texto: string): Guardrail | null {
  const t = normalizarTexto(texto).replace(/[.,;!?]/g, " ").replace(/\s+/g, " ").trim();
  const bruto = texto.trim().toLowerCase();
  if (/^(e )?(por ?qu[eê]|pq|por qual motivo|qual o motivo)\s*\??$/.test(bruto)) return "porque";
  for (const [g, re] of R) if (re.test(t)) return g;
  return null;
}

export const TEXTO_GUARDRAIL: Record<Guardrail, string> = {
  diagnostico: "guardrail.diagnostico",
  profissional: "guardrail.profissional",
  exercicio_fora: "guardrail.exercicio_fora",
  contra_diretriz: "guardrail.contra_diretriz",
  porque: "guardrail.porque",
  fora_escopo: "guardrail.fora_escopo",
};
