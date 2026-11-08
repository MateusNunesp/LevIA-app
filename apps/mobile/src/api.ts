// Cliente da API da LevIA. O app nunca roda a árvore nem fala com a IA: o servidor é a autoridade.
import Constants from "expo-constants";
import type { MensagemLevia, Regiao } from "@levia/shared";

function urlBase(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  const extra = (Constants.expoConfig?.extra as { apiUrl?: string | null } | undefined)?.apiUrl;
  if (extra) return extra;
  // Em desenvolvimento, usa o mesmo IP do Metro (o celular na mesma rede).
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3333` : "http://10.0.2.2:3333";
}

export const API = urlBase();

export class ErroApi extends Error {
  constructor(public readonly status: number, public readonly codigo: string) {
    super(codigo);
  }
}

let dispositivo: string | null = null;
export function definirDispositivo(id: string | null) {
  dispositivo = id;
}

async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API}${caminho}`, {
      method: metodo,
      // content-type só quando há corpo: DELETE e POST sem corpo não podem dizer que mandam JSON.
      headers: { ...(corpo === undefined ? {} : { "content-type": "application/json" }), ...(dispositivo ? { "x-levia-dispositivo": dispositivo } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, "sem_conexao");
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new ErroApi(r.status, j.erro ?? "erro");
  }
  return (await r.json()) as T;
}

export type EntradaMensagem = { tipo: "texto" | "voz"; texto: string } | { tipo: "mapa"; regioes: Regiao[] };

export interface Plano {
  status: "ativo" | "pausado" | "encerrado" | "nenhum";
  exercicios: { id: string; nome: string; objetivo: string; passos: string[]; dose: { series: number; repeticoes: number; vezes_por_semana: number; maximo_por_dia: number }; quandoParar: string }[];
  checagens: { semana: number; data: string }[];
  checagemPendente: { semana: number; data: string } | null;
  registrosHoje: { exercicioId: string; quantidade: number }[];
}

export interface Placar {
  participando: boolean;
  apelido: string | null;
  equipes: { nome: string; constancia: number; participantes: number; minha: boolean }[];
  meuProgresso: { diasCumpridos: number; diasQueContam: number } | null;
  minhaEquipe: string[];
}

export interface CelulaRh {
  setor: string;
  mes: string;
  indicador: string;
  valor: number | null;
  suprimido: boolean;
}

export const api = {
  textos: () => req<{ textos: Record<string, string>; revisaoPendente: boolean }>("GET", "/v1/textos"),
  registrar: (id: string) => req<{ papel: "funcionario" | "rh"; novo: boolean; triagemAceita: boolean; ritmoAceito: boolean }>("POST", "/v1/dispositivos", { id }),
  consentir: (tipo: "triagem" | "ritmo") => req<{ ok: true }>("POST", "/v1/consentimentos", { tipo, versao: 1 }),
  revogar: (tipo: "triagem" | "ritmo") => req<{ ok: true }>("DELETE", `/v1/consentimentos/${tipo}`),
  novaSessao: (modo: "autoanamnese" | "checagem" = "autoanamnese") => req<{ id: string; mensagens: MensagemLevia[] }>("POST", "/v1/sessoes", { modo }),
  enviar: (sessao: string, e: EntradaMensagem) => req<{ mensagens: MensagemLevia[]; terminada: boolean; novaSessaoId?: string }>("POST", `/v1/sessoes/${sessao}/mensagens`, e),
  plano: () => req<Plano>("GET", "/v1/eu/plano"),
  registrarExercicio: (exercicioId: string, dia: string) => req<{ aceito: boolean; motivo?: string }>("POST", "/v1/eu/registros", { exercicioId, dia, quantidade: 1 }),
  resumo: (episodioId: string) => req<{ html: string }>("GET", `/v1/eu/resumos/${episodioId}`),
  meusDados: () => req<unknown>("GET", "/v1/eu/dados"),
  apagarTudo: () => req<{ ok: true }>("DELETE", "/v1/eu"),
  entrarRitmo: (apelido: string) => req<{ ok: true }>("POST", "/v1/ritmo/entrar", { apelido }),
  sairRitmo: () => req<{ ok: true }>("POST", "/v1/ritmo/sair"),
  placar: () => req<Placar>("GET", "/v1/ritmo/placar"),
  agregados: (q: { setor?: string; mes?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => !!v) as [string, string][]).toString();
    return req<{ celulas: CelulaRh[]; aviso: string }>("GET", `/v1/rh/agregados${p ? `?${p}` : ""}`);
  },
  cabecalhos: () => (dispositivo ? { "x-levia-dispositivo": dispositivo } : {}),
};
