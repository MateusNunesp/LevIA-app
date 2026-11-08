import { describe, expect, it } from "vitest";
import { constanciaPessoa, placar, validarRegistro, type DiaPessoa } from "../src/index.ts";

const plano = { status: "ativo" as const, exercicios: [{ id: "EX-A", maximoPorDia: 2 }] };
const HOJE = "2026-11-08";

describe("registro (M9)", () => {
  it("aceita dentro da dose", () => expect(validarRegistro(plano, [], { exercicioId: "EX-A", dia: HOJE, quantidade: 1 }, HOJE)).toEqual({ ok: true }));
  it("recusa acima da dose máxima por dia", () => {
    const ex = [{ exercicioId: "EX-A", dia: HOJE, quantidade: 2 }];
    expect(validarRegistro(plano, ex, { exercicioId: "EX-A", dia: HOJE, quantidade: 1 }, HOJE)).toEqual({ ok: false, motivo: "acima_da_dose" });
  });
  it("recusa exercício fora do plano", () => expect(validarRegistro(plano, [], { exercicioId: "EX-X", dia: HOJE, quantidade: 1 }, HOJE)).toMatchObject({ motivo: "fora_do_plano" }));
  it("recusa com plano pausado (D4)", () => expect(validarRegistro({ ...plano, status: "pausado" }, [], { exercicioId: "EX-A", dia: HOJE, quantidade: 1 }, HOJE)).toMatchObject({ motivo: "sem_plano_ativo" }));
  it("aceita ontem, recusa anteontem e amanhã", () => {
    expect(validarRegistro(plano, [], { exercicioId: "EX-A", dia: "2026-11-07", quantidade: 1 }, HOJE).ok).toBe(true);
    expect(validarRegistro(plano, [], { exercicioId: "EX-A", dia: "2026-11-06", quantidade: 1 }, HOJE)).toMatchObject({ motivo: "retroativo" });
    expect(validarRegistro(plano, [], { exercicioId: "EX-A", dia: "2026-11-09", quantidade: 1 }, HOJE)).toMatchObject({ motivo: "futuro" });
  });
  it("trapaceiro: muitos registros no dia", () => {
    const p = { status: "ativo" as const, exercicios: [{ id: "EX-A", maximoPorDia: 999 }] };
    const ex = Array.from({ length: 20 }, () => ({ exercicioId: "EX-A", dia: HOJE, quantidade: 1 }));
    expect(validarRegistro(p, ex, { exercicioId: "EX-A", dia: HOJE, quantidade: 1 }, HOJE)).toMatchObject({ motivo: "limite_diario" });
  });
});

describe("constância", () => {
  it("registro duplicado no mesmo dia vale 1 ponto", () => {
    expect(constanciaPessoa([{ dia: "d1", planoAtivo: true, cumpriu: true }, { dia: "d1", planoAtivo: true, cumpriu: true }])).toEqual({ cumpridos: 1, contam: 1 });
  });
  it("dia em pausa é neutro", () => {
    expect(constanciaPessoa([{ dia: "d1", planoAtivo: true, cumpriu: true }, { dia: "d2", planoAtivo: false, cumpriu: false }])).toEqual({ cumpridos: 1, contam: 1 });
  });
});

describe("placar por equipe", () => {
  const pessoa = (cumpre: boolean[]): DiaPessoa[] => cumpre.map((c, i) => ({ dia: `d${i}`, planoAtivo: true, cumpriu: c }));
  it("equipe com menos de 5 não aparece", () => {
    const r = placar([{ setorId: "s1", nome: "A", membros: [pessoa([true]), pessoa([true]), pessoa([true]), pessoa([true])] }]);
    expect(r).toEqual([]);
  });
  it("média entre participantes ativos; quem está em pausa não puxa a média", () => {
    const pausa = [{ dia: "d0", planoAtivo: false, cumpriu: false }];
    const r = placar([{ setorId: "s1", nome: "A", membros: [pessoa([true, true]), pessoa([true, false]), pessoa([true, true]), pessoa([false, false]), pausa] }]);
    expect(r[0]).toMatchObject({ constancia: 63, participantes: 5 });
    // a saída não tem campo individual
    expect(Object.keys(r[0]!).sort()).toEqual(["constancia", "nome", "participantes", "setorId"]);
  });
});
