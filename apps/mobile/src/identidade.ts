// Identificador provisório do aparelho (não é login). TODO(login): trocar quando a D13 for definida.
import * as SecureStore from "expo-secure-store";

const CHAVE = "levia.dispositivo";
const CHAVE_DEMO = "levia.perfil_demo";

function aleatorio(): string {
  const b = new Uint8Array(16);
  // crypto.getRandomValues existe no Hermes moderno; senão, cai para Math.random (só em desenvolvimento).
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return "lv-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function idDoAparelho(): Promise<string> {
  const demo = await SecureStore.getItemAsync(CHAVE_DEMO);
  if (demo) return demo;
  let id = await SecureStore.getItemAsync(CHAVE);
  if (!id) {
    id = aleatorio();
    await SecureStore.setItemAsync(CHAVE, id);
  }
  return id;
}

export async function esquecerAparelho(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE);
  await SecureStore.deleteItemAsync(CHAVE_DEMO);
}

// ---------- modo demo (marco 14): troca rápida de perfil para o pitch ----------
// Os mesmos ids são criados por scripts/seed-demo.ts.
export const PERFIS_DEMO = [
  { id: "demo-funcionario-0000000000001", nome: "Funcionária (Ana)", papel: "funcionario" as const },
  { id: "demo-colega-000000000000000002", nome: "Colega da mesma equipe", papel: "funcionario" as const },
  { id: "demo-rh-0000000000000000000003", nome: "RH", papel: "rh" as const },
];

export const MODO_DEMO = process.env.EXPO_PUBLIC_LEVIA_DEMO === "1";

export async function usarPerfilDemo(id: string | null): Promise<void> {
  if (id) await SecureStore.setItemAsync(CHAVE_DEMO, id);
  else await SecureStore.deleteItemAsync(CHAVE_DEMO);
}
