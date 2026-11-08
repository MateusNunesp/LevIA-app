import { describe, expect, it } from "vitest";
import { carregarConteudo } from "@levia/content";
import { triage } from "@levia/triage";
import type { MensagemLevia, Regiao } from "@levia/shared";
import { detectarGuardrail, iniciar, iniciarChecagem, iniciarPiora, montarResultado, passo, type Entrada, type Saida } from "../src/index.ts";

const conteudo = carregarConteudo();
const c = { arvore: conteudo.arvore, textos: conteudo.textos };
const HOJE = "2026-11-08";
type Passo = string | Regiao[];

function rodar(passos: Passo[], inicio: Saida = iniciar(c)) {
  let s = inicio;
  const vistas: MensagemLevia[] = [...s.mensagens];
  for (const p of passos) {
    const entrada: Entrada = Array.isArray(p) ? { tipo: "mapa", regioes: p } : { tipo: "texto", texto: p };
    s = passo(c, s.estado, entrada);
    vistas.push(...s.mensagens);
    if (s.confirmado || s.emergencia) break;
  }
  return { ...s, vistas, textos: vistas.map((m) => ("texto" in m ? m.texto : "")) };
}

const START_BAIXO = ["discordo", "discordo", "discordo", "discordo", "discordo", "discordo", "discordo", "discordo", "pouco"];

describe("conversa completa por texto", () => {
  it("começa pelo mapa do corpo", () => {
    expect(iniciar(c).mensagens[0]!.tipo).toBe("cartao_mapa");
  });
  it("lombar leve -> confirma -> saída 1, com ≤ 15 perguntas", () => {
    const r = rodar([["lombar"], "uns 3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    expect(r.confirmado?.tipo).toBe("autoanamnese");
    if (r.confirmado?.tipo !== "autoanamnese") return;
    expect(r.confirmado.respostas).toMatchObject({ regioes: ["lombar"], duracaoDias: 3, dorNota: 4 });
    expect(triage(r.confirmado.respostas, undefined, c.arvore, HOJE).saida).toBe(1);
    // perguntas do roteiro (sem a confirmação final)
    expect(r.estado.perguntasFeitas - 1).toBeLessThanOrEqual(15);
    expect(r.textos.some((t) => t.startsWith("Entendi: dor na lombar há 3 dias, nota 4."))).toBe(true);
  });
  it("região escrita, sem tocar no mapa", () => {
    const r = rodar(["dói a lombar", "faz uma semana", "três", "não", "nenhuma", "nada disso", ...START_BAIXO, "isso"]);
    expect(r.confirmado?.tipo).toBe("autoanamnese");
  });
  it("pescoço também tem perguntas de alerta próprias", () => {
    const r = rodar([["pescoco"], "2 dias", "3", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    expect(r.confirmado?.tipo).toBe("autoanamnese");
    expect(r.textos.join(" ")).toContain("dois braços");
  });
});

describe("alerta escondido", () => {
  it("menção no meio de outra resposta vira pergunta fechada e leva à saída 3 com vá hoje", () => {
    const r = rodar([["lombar"], "faz 3 dias e não consigo segurar o xixi", "sim", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"]);
    expect(r.textos).toContain(c.textos.textos["alerta.unica.urina"]);
    if (r.confirmado?.tipo !== "autoanamnese") throw new Error("não confirmou");
    expect(r.confirmado.respostas.achados.urina).toBe(true);
    const res = triage(r.confirmado.respostas, undefined, c.arvore, HOJE);
    expect([res.saida, res.urgenteHoje]).toEqual([3, true]);
    const { mensagens } = montarResultado(res, conteudo, { episodioId: "e1", regioes: ["lombar"] });
    const card = mensagens.find((m) => m.tipo === "resultado");
    expect(card && "texto" in card && card.texto).toContain("Vá hoje a um pronto atendimento.");
    expect(mensagens.some((m) => m.tipo === "exercicio")).toBe(false);
  });
  it("menção depois de passar pela pergunta: pergunta de novo", () => {
    const r = rodar([["lombar"], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", "concordo, e agora perdi força na perna", "sim"]);
    expect(r.estado.achados.forca_pernas).toBe(true);
  });
});

describe("resposta ambígua em sinal de alerta", () => {
  it("'sim' sem dizer qual -> um sinal por vez", () => {
    const r = rodar([["lombar"], "3 dias", "4", "sim"]);
    expect(r.mensagens.at(-1)).toMatchObject({ textoId: "alerta.unica.urina" });
  });
  it("ambígua duas vezes conta como presente (D1)", () => {
    const r = rodar([["lombar"], "3 dias", "4", "acho que não", "não sei", "talvez"]);
    expect(r.estado.achados.urina).toBe(true);
  });
  it("a IA não pode remover alerta: 'nenhuma' da NLU vira repergunta", () => {
    const s = rodar([["lombar"], "3 dias", "4"]);
    const out = passo(c, s.estado, { tipo: "texto", texto: "bom, olha, nada demais eu acho" }, {
      nlu: { valor: [], confianca: "alta", precisa_confirmar: false, mencoes_alerta: [] },
    });
    expect(out.estado.fila.length).toBe(3);
    expect(out.estado.achados.urina).toBeUndefined();
  });
  it("a IA pode acrescentar alerta", () => {
    const s = rodar([["lombar"], "3 dias", "4"]);
    const out = passo(c, s.estado, { tipo: "texto", texto: "bom, lá embaixo tá esquisito" }, {
      nlu: { valor: ["sela"], confianca: "alta", precisa_confirmar: false, mencoes_alerta: ["sela"] },
    });
    expect(out.estado.achados.sela).toBe(true);
  });
});

describe("emergência fora do escopo", () => {
  it.each([
    ["dor no peito e falta de ar", "cardiaca", ["192"]],
    ["minha boca ficou torta", "avc", ["192"]],
    ["tenho vontade de me machucar", "autolesao", ["188", "192"]],
  ])("%s -> %s", (t, motivo, tel) => {
    const r = rodar([["lombar"], t]);
    expect(r.emergencia).toBe(motivo);
    expect(r.mensagens[0]).toMatchObject({ tipo: "emergencia", telefones: tel });
  });
});

describe("confirmação e correção", () => {
  const ate = [["lombar"] as Regiao[], "3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO];
  it("corrige com as próprias palavras", () => {
    const r = rodar([...ate, "não, são 5 dias", "sim"]);
    if (r.confirmado?.tipo !== "autoanamnese") throw new Error("não confirmou");
    expect(r.confirmado.respostas.duracaoDias).toBe(5);
  });
  it("'não' sozinho pergunta o que mudar", () => {
    const r = rodar([...ate, "não", "a nota é 6", "sim"]);
    if (r.confirmado?.tipo !== "autoanamnese") throw new Error("não confirmou");
    expect(r.confirmado.respostas.dorNota).toBe(6);
  });
  it("região nova na correção pergunta os alertas dela", () => {
    const r = rodar([...ate, "também dói o pescoço"]);
    expect(r.mensagens.at(-1)).toMatchObject({ textoId: "alerta.unica.bracos_ambos" });
  });
});

describe("guardrails", () => {
  const pedidos = [
    "é hérnia?", "posso tomar dipirona?", "qual remédio?", "me passa um exercício pra ciática", "me indica um fisio",
    "é grave?", "faço ressonância?", "uso cinta?", "é bico de papagaio?", "posso tomar ibuprofeno?", "qual a dose de paracetamol?",
    "tomo dorflex?", "me indica uma clínica", "pode marcar uma consulta?", "qual ortopedista é bom?", "preciso de raio x?",
    "devo ficar de repouso?", "fico deitado?", "que exercício faço pra hérnia?", "posso fazer pilates?", "é tendinite?",
    "o que eu tenho?", "é artrose?", "relaxante muscular ajuda?", "passo pomada?", "preciso de tomografia?", "uso colete?",
    "sera que é ciático?", "me recomenda um médico", "é sério?", "anti-inflamatório resolve?", "onde procuro um fisio?",
  ];
  it(`${pedidos.length} pedidos -> resposta padrão aprovada`, () => {
    expect(pedidos.length).toBeGreaterThanOrEqual(30);
    const aprovados = new Set(Object.entries(c.textos.textos).filter(([k]) => k.startsWith("guardrail.")).map(([, v]) => v));
    for (const p of pedidos) {
      expect(detectarGuardrail(p), p).not.toBeNull();
      const r = rodar([["lombar"], p]);
      expect(aprovados.has(r.mensagens[0] && "texto" in r.mensagens[0] ? r.mensagens[0].texto : ""), p).toBe(true);
      // repete a pergunta do roteiro e não oferece exercício
      expect(r.mensagens.some((m) => m.tipo === "exercicio")).toBe(false);
      expect(r.mensagens.at(-1)).toMatchObject({ textoId: "pergunta.duracao" });
    }
  });
  it("respostas comuns não disparam guardrail", () => {
    for (const t of ["3 dias", "nenhuma", "concordo", "acho que não", "sim", "4", "lombar"]) expect(detectarGuardrail(t), t).toBeNull();
  });
});

describe("checagem semanal (D3)", () => {
  it("semana 2 sem melhora -> saída 2 e plano pausado", () => {
    const r = rodar(["3", "não", "nenhuma", "nenhuma", "nenhuma", "sim"], iniciarChecagem(c, ["lombar"], 2));
    if (r.confirmado?.tipo !== "checagem") throw new Error("não confirmou");
    expect(r.confirmado.checagem).toMatchObject({ semana: 2, nota: 3, limitaTrabalho: false });
    const base = { regioes: ["lombar"] as Regiao[], duracaoDias: 3, dorNota: 4, achados: {}, startBack: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const res = triage(base, { checagens: [r.confirmado.checagem], episodiosAnteriores: [] }, c.arvore, HOJE);
    expect(res.saida).toBe(2);
    expect(res.exerciciosPermitidos).toBe(false);
  });
  it("semana 6 pergunta se recuperou", () => {
    const r = rodar(["1", "não", "nenhuma", "nenhuma", "nenhuma", "não"], iniciarChecagem(c, ["lombar"], 6));
    expect(r.estado.recuperado).toBe(false);
  });
  it("checagens repetem os sinais de alerta", () => {
    const r = rodar(["2", "não"], iniciarChecagem(c, ["lombar"], 1));
    expect(r.mensagens.at(-1)).toMatchObject({ textoId: "alerta.neuro_lombar" });
  });
});

describe("minha dor piorou", () => {
  it("sem plano: acolhida e depois o mapa", () => {
    const s = iniciarPiora(c);
    expect(s.mensagens.map((m) => m.tipo)).toEqual(["texto", "cartao_mapa"]);
    expect(s.mensagens[0]).toMatchObject({ textoId: "piora.nova.intro" });
  });
  it("com plano: checagem extra com intro própria e sinais de alerta de novo", () => {
    const r = rodar(["5", "não"], iniciarChecagem(c, ["lombar"], 0));
    expect(iniciarChecagem(c, ["lombar"], 0).mensagens[0]).toMatchObject({ textoId: "piora.checagem.intro" });
    expect(r.mensagens.at(-1)).toMatchObject({ textoId: "alerta.neuro_lombar" });
  });
  it("checagem extra confirmada sai com semana 0 e sem pergunta de recuperação", () => {
    const r = rodar(["5", "não", "nenhuma", "nenhuma", "nenhuma", "sim"], iniciarChecagem(c, ["lombar"], 0));
    if (r.confirmado?.tipo !== "checagem") throw new Error("não confirmou");
    expect(r.confirmado.checagem).toMatchObject({ semana: 0, nota: 5, limitaTrabalho: false });
    expect(r.confirmado.checagem.recuperado).toBeUndefined();
  });
});

describe("determinismo da conversa (M11)", () => {
  it("mesmo roteiro, mesmas mensagens", () => {
    const roteiro: Passo[] = [["lombar"], "uns 3 dias", "4", "nenhuma", "nenhuma", "nenhuma", ...START_BAIXO, "sim"];
    expect(rodar(roteiro).textos).toEqual(rodar(roteiro).textos);
  });
});
