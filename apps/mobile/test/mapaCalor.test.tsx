import React from "react";
import { render, screen } from "@testing-library/react-native";
import { TemaProvider } from "@levia/ui";
import { MapaCalor, type DiaAtividade } from "../src/MapaCalor.tsx";
import { atividadesSimuladas } from "../src/atividadesMock.ts";

jest.useFakeTimers();

// 14 dias de 26/10/2026 (segunda) a 08/11/2026 (domingo)
const dias: DiaAtividade[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10);
  return {
    dia: d,
    quantidade: [0, 1, 2, 3, 5, 0, 0, 1, 0, 0, 0, 0, 2, 3][i]!,
    planoAtivo: i !== 5 && i !== 6,
  };
});

test("mostra 14 dias, o total e rótulos por dia para leitor de tela", () => {
  render(
    <TemaProvider>
      <MapaCalor dias={dias} hoje="2026-11-08" />
    </TemaProvider>,
  );
  expect(screen.getByLabelText("Suas últimas 2 semanas: 17 atividades em 7 dias")).toBeTruthy();
  expect(screen.getByLabelText("hoje, domingo, 8 de novembro: 3 atividades")).toBeTruthy();
  expect(screen.getByLabelText("terça, 27 de outubro: 1 atividade")).toBeTruthy();
  expect(screen.getByLabelText("segunda, 26 de outubro: nenhuma atividade")).toBeTruthy();
  expect(screen.getByLabelText("sábado, 31 de outubro: nenhuma atividade")).toBeTruthy();
  expect(screen.getAllByLabelText(/^(hoje, )?[a-zçáéêíóú]+, \d+ de [a-zç]+: /)).toHaveLength(14);
});

test("dados simulados: 14 dias terminando hoje, sempre iguais", () => {
  const a = atividadesSimuladas("2026-11-08");
  expect(a).toHaveLength(14);
  expect(a[0].dia).toBe("2026-10-26");
  expect(a[13].dia).toBe("2026-11-08");
  expect(atividadesSimuladas("2026-11-08")).toEqual(a);
});
