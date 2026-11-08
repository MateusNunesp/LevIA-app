import { criarApp } from "./app.ts";
import { EMPRESA_PADRAO, SETOR_PADRAO, logSemSaude, montarServico } from "./montar.ts";

const modo = (process.env.LEVIA_MODE ?? "dev") as "producao" | "dev" | "bench";
const sv = montarServico({ log: logSemSaude });
// TODO(login): por enquanto todos veem a área do RH (só agregados). LEVIA_RH_PARA_TODOS=0 volta a exigir o papel de RH.
const rhParaTodos = process.env.LEVIA_RH_PARA_TODOS !== "0";
const app = criarApp(sv, { empresaPadrao: EMPRESA_PADRAO, setorPadrao: SETOR_PADRAO, modo, logger: true, rhParaTodos });

// Job de retenção (D12): na subida e uma vez por dia.
sv.retencao();
setInterval(() => sv.retencao(), 24 * 60 * 60 * 1000).unref();

const porta = Number(process.env.PORT ?? 3333);
await app.listen({ port: porta, host: "0.0.0.0" });
logSemSaude({ evento: "api_no_ar", porta, modo, nlu: sv.nlu?.nome ?? "nenhuma" });
