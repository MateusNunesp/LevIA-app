// Tokens da LevIA. Paleta pela teoria das cores, a partir do petróleo #1f6f5c (matiz ~166°):
// - análogas (verdes-azulados vizinhos) para a identidade: fundo, balões, topo, mapa;
// - complementar (vermelho, lado oposto do círculo) reservada para urgência: saída 3, "vá hoje", emergência;
// - âmbar como meio-termo para a saída 2.
// Contraste AA medido (ver docs/design.md): texto sobre fundo e sobre balões >= 4.5:1.
export interface Tema {
  fundo: string;
  fundoTextura: string;
  superficie: string;
  primaria: string;
  primariaProfunda: string;
  primariaSuave: string; // seixos neutros do mapa, faixas
  balaoPessoa: string;
  texto: string;
  textoSuave: string;
  borda: string;
  saida2: string;
  saida2Fundo: string;
  urgente: string;
  urgenteFundo: string;
  sobrePrimaria: string;
  escuro: boolean;
}

export const claro: Tema = {
  fundo: "#fbfaf7",
  fundoTextura: "#e3ece7",
  superficie: "#ffffff",
  primaria: "#1f6f5c",
  primariaProfunda: "#12443a",
  primariaSuave: "#d5e7e0",
  balaoPessoa: "#dcefe8",
  texto: "#12443a",
  textoSuave: "#46655d",
  borda: "#cfe0d9",
  saida2: "#8a5a00",
  saida2Fundo: "#fbf1dc",
  urgente: "#b3261e",
  urgenteFundo: "#fcebea",
  sobrePrimaria: "#ffffff",
  escuro: false,
};

export const escuro: Tema = {
  fundo: "#0f1a17",
  fundoTextura: "#16241f",
  superficie: "#17261f",
  primaria: "#5fbfa4",
  primariaProfunda: "#d6ebe4",
  primariaSuave: "#24443a",
  balaoPessoa: "#1e4a3f",
  texto: "#e4f1ec",
  textoSuave: "#a9c6bc",
  borda: "#2a4038",
  saida2: "#e0b45c",
  saida2Fundo: "#2d2412",
  urgente: "#ff8a80",
  urgenteFundo: "#3a1a18",
  sobrePrimaria: "#0f1a17",
  escuro: true,
};

export const fonte = {
  regular: "AtkinsonHyperlegible_400Regular",
  negrito: "AtkinsonHyperlegible_700Bold",
};

/** Escala de tipo (pt). A fonte dinâmica do sistema multiplica estes valores (allowFontScaling). */
export const tipo = {
  pequeno: 13,
  corpo: 17,
  destaque: 20,
  titulo: 24,
};

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };
export const ALVO_MINIMO = 44;

export function corDaSaida(t: Tema, saida: 1 | 2 | 3): { cor: string; fundo: string } {
  if (saida === 3) return { cor: t.urgente, fundo: t.urgenteFundo };
  if (saida === 2) return { cor: t.saida2, fundo: t.saida2Fundo };
  return { cor: t.primaria, fundo: t.primariaSuave };
}
