// Privacidade do RH: agregação com cortes fixos (setor × mês), k >= 10 e supressão complementar.
// É o ÚNICO caminho do banco para as rotas do RH. Nada aqui devolve id, apelido, data individual ou texto livre.
import type { Regiao, Saida } from "@levia/shared";
import { REGIOES } from "@levia/shared";

export const K_MINIMO = 10;

/** Fatos mínimos que a fonte entrega. Ficam só dentro deste módulo. */
export interface FatoUso {
  pessoa: string; // pseudônimo, nunca sai daqui
  setorId: string;
  mes: string; // AAAA-MM
}
export interface FatoEpisodio extends FatoUso {
  regioes: Regiao[];
  saida: Saida;
}
export interface FatoRitmo extends FatoUso {
  /** fração 0..1 de dias cumpridos no mês */
  constancia: number;
}

export interface FonteRh {
  setores(empresaId: string): { id: string; nome: string }[];
  usos(empresaId: string): FatoUso[];
  episodios(empresaId: string): FatoEpisodio[];
  ritmo(empresaId: string): FatoRitmo[];
}

export const INDICADORES = [
  "pessoas_ativas",
  "saida_1",
  "saida_2",
  "saida_3",
  ...REGIOES.map((r) => `regiao_${r}` as const),
  "ritmo_constancia_pct",
] as const;
export type Indicador = (typeof INDICADORES)[number];

/** Célula publicada. É a ÚNICA forma que sai para a API do RH. */
export interface CelulaRh {
  setor: string; // nome do setor, ou "Toda a empresa"
  mes: string;
  indicador: Indicador;
  /** null = suprimida ("menos de 10") */
  valor: number | null;
  suprimido: boolean;
}
export const CAMPOS_PERMITIDOS = ["setor", "mes", "indicador", "valor", "suprimido"] as const;

interface CelulaInterna {
  setorId: string; // "*" = empresa
  mes: string;
  indicador: Indicador;
  n: number; // pessoas distintas que sustentam a célula
  valor: number;
  suprimido: boolean;
}

function contarDistintos<T extends FatoUso>(fatos: T[], filtro: (f: T) => boolean): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const f of fatos) {
    if (!filtro(f)) continue;
    const k = `${f.setorId}|${f.mes}`;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(f.pessoa);
  }
  return m;
}

/**
 * Supressão primária (n < k) e complementar: em cada mês e indicador, a soma das células
 * suprimidas não pode ficar entre 1 e k-1 se o total da empresa for publicado — senão
 * ela seria deduzida por subtração. Suprimimos mais células (as menores) até o resto
 * escondido ser 0 ou >= k; se não der, o total da empresa também é suprimido.
 */
function suprimir(celulas: CelulaInterna[]): void {
  for (const c of celulas) if (c.n < K_MINIMO) c.suprimido = true;
  const grupos = new Map<string, CelulaInterna[]>();
  for (const c of celulas) {
    const k = `${c.mes}|${c.indicador}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(c);
  }
  for (const g of grupos.values()) {
    const total = g.find((c) => c.setorId === "*");
    const partes = g.filter((c) => c.setorId !== "*");
    if (!total || total.suprimido) continue;
    const escondido = () => partes.filter((p) => p.suprimido).reduce((a, p) => a + p.n, 0);
    const ordenadas = [...partes].filter((p) => !p.suprimido).sort((a, b) => a.n - b.n);
    while (escondido() > 0 && escondido() < K_MINIMO && ordenadas.length) ordenadas.shift()!.suprimido = true;
    // Uma única parte suprimida é sempre deduzível pela subtração, mesmo com n >= k.
    if (partes.filter((p) => p.suprimido).length === 1 && ordenadas.length) ordenadas.shift()!.suprimido = true;
    if (escondido() > 0 && escondido() < K_MINIMO) total.suprimido = true;
  }
}

export function agregadosRh(fonte: FonteRh, empresaId: string): CelulaRh[] {
  const setores = fonte.setores(empresaId);
  const nomes = new Map(setores.map((s) => [s.id, s.nome]));
  const usos = fonte.usos(empresaId);
  const eps = fonte.episodios(empresaId);
  const rit = fonte.ritmo(empresaId);
  const meses = [...new Set(usos.map((u) => u.mes))].sort();
  const celulas: CelulaInterna[] = [];

  const adicionar = (indicador: Indicador, mapa: Map<string, Set<string>>, valorDe?: (setor: string, mes: string, n: number) => number) => {
    for (const mes of meses) {
      let nTotal = new Set<string>();
      for (const s of setores) {
        const ps = mapa.get(`${s.id}|${mes}`) ?? new Set<string>();
        nTotal = new Set([...nTotal, ...ps]);
        celulas.push({ setorId: s.id, mes, indicador, n: ps.size, valor: valorDe ? valorDe(s.id, mes, ps.size) : ps.size, suprimido: false });
      }
      celulas.push({ setorId: "*", mes, indicador, n: nTotal.size, valor: valorDe ? valorDe("*", mes, nTotal.size) : nTotal.size, suprimido: false });
    }
  };

  adicionar("pessoas_ativas", contarDistintos(usos, () => true));
  for (const s of [1, 2, 3] as const) adicionar(`saida_${s}`, contarDistintos(eps, (e) => e.saida === s));
  for (const r of REGIOES) adicionar(`regiao_${r}`, contarDistintos(eps, (e) => e.regioes.includes(r)));
  const ritMapa = contarDistintos(rit, () => true);
  adicionar("ritmo_constancia_pct", ritMapa, (setor, mes) => {
    const fs = rit.filter((f) => f.mes === mes && (setor === "*" || f.setorId === setor));
    if (!fs.length) return 0;
    // arredondado a múltiplos de 5% para não expor variações de uma pessoa
    return Math.round((fs.reduce((a, f) => a + f.constancia, 0) / fs.length) * 20) * 5;
  });

  suprimir(celulas);
  return celulas.map((c) => ({
    setor: c.setorId === "*" ? "Toda a empresa" : (nomes.get(c.setorId) ?? "Setor"),
    mes: c.mes,
    indicador: c.indicador,
    valor: c.suprimido ? null : c.valor,
    suprimido: c.suprimido,
  }));
}

function rotulo(i: Indicador): string {
  if (i === "pessoas_ativas") return "Pessoas ativas";
  if (i.startsWith("saida_")) return `Resultado ${i.slice(6)}`;
  if (i === "ritmo_constancia_pct") return "Constância média do Ritmo (%)";
  return `Região: ${i.slice(7).replace(/_/g, " ")}`;
}

export const RODAPE_NR1 = "Insumo para o inventário de riscos do PGR. Não substitui a avaliação ergonômica.";

/** CSV do relatório NR-1 (D14): só agregados, já com supressão. */
export function csvNr1(celulas: CelulaRh[]): string {
  const linhas = ["setor;mes;indicador;valor"];
  for (const c of celulas) linhas.push([c.setor, c.mes, rotulo(c.indicador), c.suprimido ? "menos de 10" : String(c.valor)].map((x) => `"${x.replace(/"/g, '""')}"`).join(";"));
  linhas.push(`"${RODAPE_NR1}"`);
  return linhas.join("\n") + "\n";
}

export { rotulo as rotuloIndicador };
