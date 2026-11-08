// pnpm --filter @levia/triage cli --in vinheta.json  ->  TriageResult + exercicios[]
// Fora de src/: o CLI carrega o conteúdo; o motor em src/ continua puro.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { carregarConteudo } from "@levia/content";
import { escolherExercicios } from "@levia/conversation";
import { triage } from "../src/index.ts";

const i = process.argv.indexOf("--in");
const arquivo = i >= 0 ? process.argv[i + 1] : undefined;
if (!arquivo) {
  process.stderr.write("uso: cli --in vinheta.json\n");
  process.exit(2);
}
// pnpm --filter roda dentro do pacote; caminhos relativos valem a partir de onde o comando foi chamado
const base = process.env.INIT_CWD ?? process.cwd();
const v = JSON.parse(readFileSync(resolve(base, arquivo), "utf8"));
const c = carregarConteudo();
const r = triage(v.respostas, v.historico, c.arvore, v.hoje ?? new Date().toISOString().slice(0, 10));
const exercicios = r.exerciciosPermitidos ? escolherExercicios(c.catalogo, v.respostas.regioes).map((e) => e.id) : [];
process.stdout.write(JSON.stringify({ ...r, exercicios }, null, 2) + "\n");
