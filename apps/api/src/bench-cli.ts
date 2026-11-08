// pnpm --filter @levia/api bench:conversa --in roteiro.json [--nlu mock|anthropic|nenhuma]
import { readFileSync } from "node:fs";
import { escolherNlu } from "./montar.ts";
import { rodarConversa, servicoBench } from "./bench.ts";

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const arquivo = arg("--in");
if (!arquivo) {
  process.stderr.write("uso: bench:conversa --in roteiro.json [--nlu mock|anthropic|nenhuma]\n");
  process.exit(2);
}
const roteiro = JSON.parse(readFileSync(arquivo, "utf8")) as { hoje?: string };
const sv = servicoBench(escolherNlu(arg("--nlu") ?? "mock"), roteiro.hoje);
const r = await rodarConversa(sv, roteiro);
process.stdout.write(JSON.stringify(r, null, 2) + "\n");
