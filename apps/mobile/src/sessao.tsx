// Estado do aparelho: identificador provisório, papel, consentimentos e textos aprovados.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { api, definirDispositivo, ErroApi } from "./api.ts";
import { idDoAparelho } from "./identidade.ts";

interface Sessao {
  pronto: boolean;
  erro: string | null;
  id: string | null;
  papel: "funcionario" | "rh" | null;
  triagemAceita: boolean;
  ritmoAceito: boolean;
  textos: Record<string, string>;
  revisaoPendente: boolean;
  soVoz: boolean;
  definirSoVoz: (v: boolean) => void;
  recarregar: () => Promise<void>;
  aceitarTriagem: () => Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Omit<Sessao, "recarregar" | "aceitarTriagem" | "definirSoVoz">>({
    pronto: false,
    erro: null,
    id: null,
    papel: null,
    triagemAceita: false,
    ritmoAceito: false,
    textos: {},
    revisaoPendente: false,
    soVoz: false,
  });

  const recarregar = useCallback(async () => {
    try {
      const id = await idDoAparelho();
      definirDispositivo(id);
      const [reg, tx, voz] = await Promise.all([
        api.registrar(id),
        api.textos(),
        SecureStore.getItemAsync("levia.so_voz"),
      ]);
      setS({
        pronto: true,
        erro: null,
        id,
        papel: reg.papel,
        triagemAceita: reg.triagemAceita,
        ritmoAceito: reg.ritmoAceito,
        textos: tx.textos,
        revisaoPendente: tx.revisaoPendente,
        soVoz: voz === "1",
      });
    } catch (e) {
      setS((x) => ({ ...x, pronto: true, erro: e instanceof ErroApi ? e.codigo : "erro" }));
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const aceitarTriagem = useCallback(async () => {
    await api.consentir("triagem");
    setS((x) => ({ ...x, triagemAceita: true }));
  }, []);

  const definirSoVoz = useCallback((v: boolean) => {
    void SecureStore.setItemAsync("levia.so_voz", v ? "1" : "0");
    setS((x) => ({ ...x, soVoz: v }));
  }, []);

  return <Ctx.Provider value={{ ...s, recarregar, aceitarTriagem, definirSoVoz }}>{children}</Ctx.Provider>;
}

export function useSessao(): Sessao {
  const c = useContext(Ctx);
  if (!c) throw new Error("SessaoProvider ausente");
  return c;
}

/**
 * Texto aprovado vindo do servidor; nunca inventado no app.
 * A função é memorizada: ela entra em dependências de efeitos (carregar ao focar a aba). Se mudasse a cada
 * render, o efeito rodaria de novo a cada render, num laço de pedidos ao servidor.
 */
export function useTexto() {
  const { textos } = useSessao();
  return useCallback((id: string) => textos[id] ?? "", [textos]);
}
