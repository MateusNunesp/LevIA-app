import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BodyMap, Composer, CartaoResultado, TemaProvider } from "@levia/ui";

jest.useFakeTimers();
afterEach(() => {
  jest.runOnlyPendingTimers();
});

const comTema = (ui: React.ReactElement) => render(<TemaProvider>{ui}</TemaProvider>);

describe("mapa do corpo", () => {
  it("cada região tem rótulo próprio para leitor de tela e alterna ao toque", () => {
    const alternar = jest.fn();
    comTema(<BodyMap lado="costas" selecionadas={["lombar"]} onAlternar={alternar} altura={420} reduzirMovimento />);
    const lombar = screen.getByLabelText("lombar, de costas");
    expect(lombar.props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByLabelText("meio das costas, de costas")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("pescoço, de costas"));
    expect(alternar).toHaveBeenCalledWith("pescoco");
  });
  it("de frente não tem lombar (é região de costas)", () => {
    comTema(<BodyMap lado="frente" selecionadas={[]} onAlternar={() => {}} altura={420} reduzirMovimento />);
    expect(screen.queryByLabelText("lombar, de frente")).toBeNull();
  });
});

describe("barra de digitação", () => {
  const base = { onMudar: () => {}, onEnviar: jest.fn(), onMicrofone: jest.fn(), gravando: false, segundos: 0, onCancelarGravacao: () => {}, vozDisponivel: true };
  it("sem texto mostra o microfone; com texto vira enviar", () => {
    const { rerender } = comTema(<Composer {...base} valor="" />);
    expect(screen.getByLabelText("Gravar mensagem de voz")).toBeTruthy();
    rerender(<TemaProvider><Composer {...base} valor="3 dias" /></TemaProvider>);
    fireEvent.press(screen.getByLabelText("Enviar"));
    expect(base.onEnviar).toHaveBeenCalled();
  });
  it("gravando mostra tempo e cancelar", () => {
    comTema(<Composer {...base} valor="" gravando segundos={7} />);
    expect(screen.getByLabelText("Cancelar gravação")).toBeTruthy();
    expect(screen.getByLabelText("Parar gravação")).toBeTruthy();
  });
});

describe("cartão de resultado", () => {
  it("saída 3 com vá hoje em destaque e ação Por quê?", () => {
    comTema(<CartaoResultado saida={3} urgenteHoje titulo="Procure atendimento presencial" texto="Vá hoje a um pronto atendimento. Procure atendimento presencial." porque="Motivo." frasesUrgentes={["Vá hoje a um pronto atendimento."]} />);
    expect(screen.getByText("Vá hoje a um pronto atendimento.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Por quê?"));
    expect(screen.getByText("Motivo.")).toBeTruthy();
  });
});
