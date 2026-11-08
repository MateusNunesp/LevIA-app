// Empresa de demonstração para o pitch (NÃO é a empresa simulada do juiz).
// Cria setores, pessoas com episódios em 3 meses, Ritmo, e os 3 perfis do seletor de demo.
// uso: LEVIA_DB=levia-demo.db pnpm seed
import { randomUUID } from "node:crypto";
import { abrirDb, schema } from "../apps/api/src/db/index.ts";
import { garantirPadrao, montarServico } from "../apps/api/src/montar.ts";
import type { Regiao, RespostasConfirmadas } from "@levia/shared";
import { somarDias } from "@levia/shared";

const db = abrirDb(process.env.LEVIA_DB ?? "levia-demo.db");
const EMPRESA = process.env.LEVIA_EMPRESA_PADRAO ?? "empresa-demo";
garantirPadrao(db, EMPRESA, process.env.LEVIA_SETOR_PADRAO ?? "setor-geral");

const SETORES = [
  { id: "setor-operacoes", nome: "Operações", pessoas: 18 },
  { id: "setor-administrativo", nome: "Administrativo", pessoas: 13 },
  { id: "setor-atendimento", nome: "Atendimento", pessoas: 11 },
  { id: "setor-ti", nome: "TI", pessoas: 4 }, // pequeno de propósito: aparece como "menos de 10"
];
for (const s of SETORES) db.insert(schema.setor).values({ id: s.id, empresaId: EMPRESA, nome: s.nome }).onConflictDoNothing().run();

const PERFIS = [
  { id: "demo-funcionario-0000000000001", setor: "setor-operacoes", papel: "funcionario" as const, apelido: "Ana" },
  { id: "demo-colega-000000000000000002", setor: "setor-operacoes", papel: "funcionario" as const, apelido: "Beto" },
  { id: "demo-rh-0000000000000000000003", setor: "setor-administrativo", papel: "rh" as const, apelido: null },
];

// relógio controlado para espalhar os episódios nos últimos 3 meses
let hoje = process.env.LEVIA_HOJE ?? new Date().toISOString().slice(0, 10);
const fim = hoje;
const sv = montarServico({ db, nlu: null, relogio: { hoje: () => hoje, agora: () => `${hoje}T12:00:00.000Z` } });

let semente = 7;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const REG: Regiao[] = ["lombar", "pescoco", "ombros", "punhos_maos", "costas_alta", "joelhos"];

function respostas(): RespostasConfirmadas {
  const r = rnd();
  return {
    regioes: [REG[Math.floor(rnd() * REG.length)]!],
    duracaoDias: Math.floor(rnd() * 30),
    dorNota: Math.floor(rnd() * 9) + 1,
    achados: r < 0.06 ? { febre: true } : {},
    startBack: Array.from({ length: 9 }, () => (rnd() < 0.25 ? 1 : 0)),
  };
}

function pessoa(id: string, setor: string, papel: "funcionario" | "rh") {
  db.insert(schema.pessoa).values({ idPseudonimo: id, empresaId: EMPRESA, setorId: setor, papel, criadoEm: `${somarDias(fim, -95)}T09:00:00.000Z` }).onConflictDoNothing().run();
  if (papel === "funcionario") sv.consentir(id, "triagem", 1);
}

for (const p of PERFIS) pessoa(p.id, p.setor, p.papel);
const funcionarios: { id: string; setor: string }[] = [];
for (const s of SETORES) for (let i = 0; i < s.pessoas; i++) {
  const id = `demo-${s.id}-${String(i).padStart(3, "0")}-${randomUUID().slice(0, 8)}`;
  pessoa(id, s.id, "funcionario");
  funcionarios.push({ id, setor: s.id });
}

// 3 meses de episódios
for (const dias of [80, 50, 15]) {
  hoje = somarDias(fim, -dias);
  for (const f of funcionarios) if (rnd() < 0.85) sv.concluirAutoanamnese(f.id, respostas());
}
// a Ana tem um caso leve recente (plano ativo); o colega também
hoje = somarDias(fim, -3);
for (const p of PERFIS.slice(0, 2)) sv.concluirAutoanamnese(p.id, { regioes: ["lombar"], duracaoDias: 3, dorNota: 4, achados: {}, startBack: [0, 0, 0, 0, 0, 0, 0, 0, 0] });

// Ritmo: Operações e Administrativo com mais de 5 participantes
hoje = somarDias(fim, -3);
for (const [i, f] of funcionarios.entries()) {
  if (f.setor === "setor-ti" || rnd() < 0.3) continue;
  sv.consentir(f.id, "ritmo", 1);
  sv.entrarRitmo(f.id, `Colega ${i}`);
}
for (const p of PERFIS.slice(0, 2)) {
  sv.consentir(p.id, "ritmo", 1);
  sv.entrarRitmo(p.id, p.apelido!);
}
for (let d = 3; d >= 0; d--) {
  hoje = somarDias(fim, -d);
  for (const f of [...funcionarios, ...PERFIS.slice(0, 2).map((p) => ({ id: p.id, setor: p.setor }))]) {
    const plano = sv.planoAtivo(f.id);
    if (!plano || rnd() < 0.35) continue;
    const ex = (JSON.parse(plano.exercicios) as string[])[0];
    if (ex) sv.registrar(f.id, { exercicioId: ex, dia: hoje, quantidade: 1 });
  }
}
hoje = fim;
process.stdout.write(`demo pronta: ${funcionarios.length + 2} funcionários em ${SETORES.length + 1} setores, perfis: ${PERFIS.map((p) => p.id).join(", ")}\n`);
