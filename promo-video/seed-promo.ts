// Dados fictícios para o vídeo promocional (não é código de produção; não é a empresa do juiz).
// Empresa fictícia "Horizonte Logística", 5 setores, 6 meses de histórico, Ritmo com apelidos brasileiros.
// Usa o próprio serviço da API (mesmas regras, mesma árvore), num banco separado: promo-video/promo.db.
//
// uso (na raiz do repositório):
//   LEVIA_DB=promo-video/promo.db LEVIA_EMPRESA_PADRAO=empresa-horizonte LEVIA_SETOR_PADRAO=setor-operacoes \
//     npx tsx promo-video/seed-promo.ts
import { randomUUID } from "node:crypto";
import { abrirDb, schema } from "../apps/api/src/db/index.ts";
import { garantirPadrao, montarServico } from "../apps/api/src/montar.ts";
import type { Regiao, RespostasConfirmadas } from "@levia/shared";
import { somarDias } from "@levia/shared";

const EMPRESA = process.env.LEVIA_EMPRESA_PADRAO ?? "empresa-horizonte";
const db = abrirDb(process.env.LEVIA_DB ?? "promo-video/promo.db");
garantirPadrao(db, EMPRESA, "setor-operacoes");
db.update(schema.empresa).set({ nome: "Horizonte Logística" }).run();
db.update(schema.setor).set({ nome: "Operações" }).run();

// tamanho, regiões mais comuns (peso) e adesão ao Ritmo de cada setor
const SETORES: { id: string; nome: string; pessoas: number; regioes: [Regiao, number][]; ritmo: number; adesao: number }[] = [
  { id: "setor-operacoes", nome: "Operações", pessoas: 40, regioes: [["lombar", 6], ["ombros", 2], ["joelhos", 1], ["punhos_maos", 1]], ritmo: 0.8, adesao: 0.74 },
  { id: "setor-atendimento", nome: "Atendimento", pessoas: 28, regioes: [["pescoco", 5], ["ombros", 3], ["lombar", 2]], ritmo: 0.75, adesao: 0.66 },
  { id: "setor-administrativo", nome: "Administrativo", pessoas: 22, regioes: [["punhos_maos", 5], ["pescoco", 3], ["lombar", 2]], ritmo: 0.7, adesao: 0.58 },
  { id: "setor-tecnologia", nome: "Tecnologia", pessoas: 18, regioes: [["punhos_maos", 6], ["pescoco", 3], ["costas_alta", 1]], ritmo: 0.85, adesao: 0.83 },
  // pequeno de propósito: mostra a privacidade ("menos de 10") de forma natural
  { id: "setor-comercial", nome: "Comercial", pessoas: 7, regioes: [["joelhos", 3], ["lombar", 2]], ritmo: 0.5, adesao: 0.6 },
];
for (const s of SETORES) {
  db.insert(schema.setor).values({ id: s.id, empresaId: EMPRESA, nome: s.nome }).onConflictDoUpdate({ target: schema.setor.id, set: { nome: s.nome } }).run();
}

const NOMES = [
  "Ana", "Bia", "Carla", "Dani", "Duda", "Fer", "Gabi", "Iza", "Jéssica", "Ju", "Lari", "Lu", "Malu", "Mari", "Nanda", "Paty", "Rê", "Sol", "Tati", "Vivi",
  "Beto", "Caio", "Davi", "Edu", "Fábio", "Gui", "Henrique", "Igor", "Jota", "Leo", "Marcão", "Nando", "Paulinho", "Rafa", "Rodrigo", "Thiago", "Vini", "Zé",
];

let hoje = process.env.LEVIA_HOJE ?? new Date().toISOString().slice(0, 10);
const fim = hoje;
const sv = montarServico({ db, nlu: null, relogio: { hoje: () => hoje, agora: () => `${hoje}T12:00:00.000Z` } });

let semente = 20261108;
const rnd = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const sortear = <T,>(pesos: [T, number][]): T => {
  const total = pesos.reduce((a, [, p]) => a + p, 0);
  let x = rnd() * total;
  for (const [v, p] of pesos) if ((x -= p) <= 0) return v;
  return pesos[pesos.length - 1]![0];
};

interface Pessoa { id: string; setor: (typeof SETORES)[number]; regioesUsadas: Regiao[] }
const pessoas: Pessoa[] = [];
for (const s of SETORES) {
  for (let i = 0; i < s.pessoas; i++) {
    const id = `promo-${s.id.slice(6)}-${String(i).padStart(3, "0")}-${randomUUID().slice(0, 8)}`;
    db.insert(schema.pessoa).values({ idPseudonimo: id, empresaId: EMPRESA, setorId: s.id, papel: "funcionario", criadoEm: `${somarDias(fim, -200)}T09:00:00.000Z` }).run();
    sv.consentir(id, "triagem", 1);
    pessoas.push({ id, setor: s, regioesUsadas: [] });
  }
}

function respostas(p: Pessoa, leve = false): RespostasConfirmadas {
  const regiao = sortear(p.setor.regioes);
  p.regioesUsadas.push(regiao);
  const r = rnd();
  return {
    regioes: [regiao],
    duracaoDias: leve ? 2 + Math.floor(rnd() * 10) : Math.floor(rnd() * 50),
    dorNota: leve ? 2 + Math.floor(rnd() * 4) : 2 + Math.floor(rnd() * 7),
    achados: !leve && r < 0.04 ? { trauma: true } : {},
    startBack: Array.from({ length: 9 }, () => (!leve && rnd() < 0.22 ? 1 : 0)),
  };
}

// 6 meses de autoanamneses (meados de cada mês)
for (let m = 5; m >= 1; m--) {
  hoje = somarDias(fim, -30 * m - 5 + Math.floor(rnd() * 6));
  for (const p of pessoas) if (rnd() < 0.62) sv.concluirAutoanamnese(p.id, respostas(p));
}

// Ritmo: quem participa tem um caso leve recente (plano ativo há ~4 semanas) e registra exercícios
const APELIDOS_USADOS = new Map<string, Set<string>>();
const participantes: Pessoa[] = [];
hoje = somarDias(fim, -27);
for (const p of pessoas) {
  if (rnd() > p.setor.ritmo) continue;
  // região do plano: uma com exercício no catálogo e sem 3ª crise (senão a árvore manda ao fisioterapeuta)
  const opcoes = (["lombar", "pescoco", "ombros", "punhos_maos", "costas_alta"] as Regiao[]).filter((r) => p.regioesUsadas.filter((x) => x === r).length < 2);
  const favorita = p.setor.regioes.map(([r]) => r).find((r) => opcoes.includes(r)) ?? opcoes[0];
  if (!favorita) continue;
  const resp = { ...respostas(p, true), regioes: [favorita] };
  const r = sv.concluirAutoanamnese(p.id, resp);
  if (r.resultado.saida !== 1) continue;
  sv.consentir(p.id, "ritmo", 1);
  const usados = APELIDOS_USADOS.get(p.setor.id) ?? new Set<string>();
  const livre = NOMES.filter((n) => !usados.has(n));
  const apelido = livre.length ? livre[Math.floor(rnd() * livre.length)]! : `${NOMES[Math.floor(rnd() * NOMES.length)]} ${usados.size}`;
  usados.add(apelido);
  APELIDOS_USADOS.set(p.setor.id, usados);
  sv.entrarRitmo(p.id, apelido);
  participantes.push(p);
}
// O painel do RH só lista meses com autoanamnese, e o Ritmo é calculado só no mês atual.
// Por isso, no começo do mês atual: os participantes refazem um caso leve (o plano se renova sem quebrar a
// sequência) e parte dos outros conta uma dor nova.
const diaNovo = Math.min(27, Math.max(1, Number(fim.slice(8, 10)) - 2)); // ~3 dias depois do dia 1
function casosDoMes(): void {
  const noRitmo = new Set(participantes.map((p) => p.id));
  for (const p of pessoas) {
    if (noRitmo.has(p.id)) {
      const opcoes = (["lombar", "pescoco", "ombros", "punhos_maos", "costas_alta"] as Regiao[]).filter((r) => p.regioesUsadas.filter((x) => x === r).length < 2);
      const regiao = p.setor.regioes.map(([r]) => r).find((r) => opcoes.includes(r)) ?? opcoes[0];
      if (regiao) sv.concluirAutoanamnese(p.id, { ...respostas(p, true), regioes: [regiao] });
    } else if (rnd() < 0.6) sv.concluirAutoanamnese(p.id, respostas(p));
  }
}

// registros diários dentro da dose, nos últimos 27 dias
for (let d = 27; d >= 0; d--) {
  hoje = somarDias(fim, -d);
  if (d === diaNovo) casosDoMes();
  for (const p of participantes) {
    if (rnd() > p.setor.adesao) continue;
    const plano = sv.planoAtivo(p.id);
    const ex = plano ? (JSON.parse(plano.exercicios) as string[])[0] : undefined;
    if (ex) sv.registrar(p.id, { exercicioId: ex, dia: hoje, quantidade: 1 });
  }
}
hoje = fim;

process.stdout.write(
  `promo pronta: ${pessoas.length} pessoas em ${SETORES.length} setores, ${participantes.length} no Ritmo (empresa ${EMPRESA}, até ${fim})\n`,
);
