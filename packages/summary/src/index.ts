// Resumo da autoanamnese: template -> HTML (o PDF é gerado no aparelho com expo-print).
// Sem diagnóstico. Nunca é enviado a ninguém automaticamente.
import type { Achado, Regiao, RiscoStart, Saida } from "@levia/shared";
import { NOME_REGIAO } from "@levia/shared";

export interface DadosResumo {
  data: string; // AAAA-MM-DD
  regioes: Regiao[];
  duracaoDias: number;
  dorNota: number;
  achadosPerguntados: { achado: Achado; nome: string; presente: boolean }[];
  startBack: { total: number; risco: RiscoStart };
  /** TODO(D5): o STarT Back foi validado para dor lombar; fora dela o resultado vai marcado. */
  startBackForaDaLombar?: boolean;
  saida: Saida;
  tituloSaida: string;
  versaoRegras: string;
  avisoFixo: string;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const RISCO: Record<RiscoStart, string> = { baixo: "baixo", medio: "médio", alto: "alto" };

export function resumoHtml(d: DadosResumo): string {
  const presentes = d.achadosPerguntados.filter((a) => a.presente);
  const ausentes = d.achadosPerguntados.filter((a) => !a.presente);
  const li = (xs: { nome: string }[]) => xs.map((x) => `<li>${esc(x.nome)}</li>`).join("") || "<li>nenhum</li>";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo LevIA</title>
<style>
body{font-family:"Atkinson Hyperlegible",system-ui,sans-serif;color:#12443a;margin:32px;line-height:1.5}
h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:20px 0 6px;color:#1f6f5c}
table{border-collapse:collapse;width:100%} td{padding:6px 8px;border-bottom:1px solid #dcefe8;vertical-align:top}
td:first-child{width:40%;color:#3d5f57}
.aviso{margin-top:28px;font-size:12px;color:#3d5f57;border-top:1px solid #dcefe8;padding-top:10px}
</style></head><body>
<h1>Resumo da autoanamnese</h1>
<div>${esc(dataBr(d.data))}</div>
<h2>O que a pessoa contou</h2>
<table>
<tr><td>Onde dói</td><td>${esc(d.regioes.map((r) => NOME_REGIAO[r]).join(", "))}</td></tr>
<tr><td>Há quanto tempo</td><td>${d.duracaoDias} dia(s)</td></tr>
<tr><td>Nota da dor (0 a 10)</td><td>${d.dorNota}</td></tr>
<tr><td>STarT Back</td><td>${d.startBack.total} de 9 · risco ${RISCO[d.startBack.risco]}${d.startBackForaDaLombar ? " (ferramenta feita para dor lombar; uso aqui em revisão)" : ""}</td></tr>
<tr><td>Orientação da LevIA</td><td>${esc(d.tituloSaida)}</td></tr>
</table>
<h2>Sinais de alerta marcados</h2><ul>${li(presentes)}</ul>
<h2>Sinais perguntados e negados</h2><ul>${li(ausentes)}</ul>
<div class="aviso">Este resumo foi feito a partir das respostas da própria pessoa. Não é diagnóstico.<br>
${esc(d.avisoFixo)}<br>Regras: ${esc(d.versaoRegras)}</div>
</body></html>`;
}
