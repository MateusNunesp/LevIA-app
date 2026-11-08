// Regressão: useTexto precisa manter a mesma identidade entre renders. Quando mudava a cada render,
// as abas que recarregam ao ganhar foco entravam num laço de pedidos ao servidor (~28 por segundo no Ritmo).
import React from "react";
import { act, render } from "@testing-library/react-native";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => {}) }));
jest.mock("../src/identidade.ts", () => ({ idDoAparelho: jest.fn(async () => "lv-teste-0000000000000000") }));
jest.mock("../src/api.ts", () => ({
  definirDispositivo: jest.fn(),
  ErroApi: class extends Error {},
  api: {
    registrar: jest.fn(async () => ({ papel: "funcionario", novo: false, triagemAceita: true, ritmoAceito: false })),
    textos: jest.fn(async () => ({ textos: { "aviso.fixo": "Aviso" }, revisaoPendente: false })),
  },
}));

import { SessaoProvider, useTexto } from "../src/sessao.tsx";

test("useTexto mantém a mesma função entre renders", async () => {
  const vistas: ((id: string) => string)[] = [];
  let forcar: () => void = () => {};
  function Sonda() {
    const [, set] = React.useState(0);
    forcar = () => set((n) => n + 1);
    vistas.push(useTexto());
    return null;
  }
  render(
    <SessaoProvider>
      <Sonda />
    </SessaoProvider>,
  );
  await act(async () => {}); // carrega textos
  const depoisDeCarregar = vistas[vistas.length - 1]!;
  expect(depoisDeCarregar("aviso.fixo")).toBe("Aviso");
  await act(async () => forcar());
  await act(async () => forcar());
  expect(vistas[vistas.length - 1]).toBe(depoisDeCarregar);
});
