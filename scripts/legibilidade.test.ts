import { describe, expect, it } from "vitest";
import { flesch, silabas } from "./legibilidade.ts";

describe("legibilidade", () => {
  it("conta sílabas em português", () => {
    expect(silabas("dor")).toBe(1);
    expect(silabas("lombar")).toBe(2);
    expect(silabas("fisioterapeuta")).toBeGreaterThanOrEqual(6);
  });
  it("frase simples é mais fácil que frase técnica", () => {
    expect(flesch("Faz quanto tempo que dói?")).toBeGreaterThan(flesch("Apresenta comprometimento neurológico progressivo bilateral?"));
  });
});
