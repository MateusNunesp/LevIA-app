import React, { createContext, useContext } from "react";
import { Text, type TextProps, useColorScheme } from "react-native";
import { claro, escuro, fonte, tipo, type Tema } from "./tokens.ts";

const Ctx = createContext<Tema>(claro);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const esquema = useColorScheme();
  return <Ctx.Provider value={esquema === "dark" ? escuro : claro}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);

export interface TextoProps extends TextProps {
  variante?: "corpo" | "pequeno" | "destaque" | "titulo";
  negrito?: boolean;
  cor?: string;
}

/** Texto com a família única da LevIA. Respeita a fonte dinâmica do sistema. */
export function Texto({ variante = "corpo", negrito, cor, style, ...rest }: TextoProps) {
  const t = useTema();
  const tamanho = tipo[variante];
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2.2}
      style={[
        { fontFamily: negrito || variante === "titulo" ? fonte.negrito : fonte.regular, fontSize: tamanho, lineHeight: Math.round(tamanho * 1.4), color: cor ?? t.texto },
        style,
      ]}
      {...rest}
    />
  );
}
