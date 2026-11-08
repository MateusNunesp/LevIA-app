import { criarApp } from "./app.ts";
import { EMPRESA_PADRAO, SETOR_PADRAO, logSemSaude, montarServico } from "./montar.ts";

const modo = (process.env.LEVIA_MODE ?? "dev") as "producao" | "dev" | "bench";
const sv = montarServico({ log: logSemSaude });
const app = criarApp(sv, { empresaPadrao: EMPRESA_PADRAO, setorPadrao: SETOR_PADRAO, modo, logger: true });

// Job de retenção (D12): na subida e uma vez por dia.
sv.retencao();
setInterval(() => sv.retencao(), 24 * 60 * 60 * 1000).unref();

const porta = Number(process.env.PORT ?? 3333);
await app.listen({ port: porta, host: "0.0.0.0" });
logSemSaude({ evento: "api_no_ar", porta, modo, nlu: sv.nlu?.nome ?? "nenhuma" });
