// Relatório NR-1 (D14): PDF e CSV agregados, gerados no servidor com supressão, compartilhados pelo sistema.
import React, { useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Botao, Texto, useTema } from "@levia/ui";
import { API, api } from "../../../src/api.ts";
import { Bloco, Tela } from "../../../src/Tela.tsx";
import { AbasRh } from "../../../src/AbasRh.tsx";

export default function Nr1() {
  const t = useTema();
  const [msg, setMsg] = useState<string | null>(null);
  const baixar = async (tipo: "pdf" | "csv") => {
    try {
      const destino = new File(Paths.cache, `levia-nr1.${tipo}`);
      if (destino.exists) destino.delete();
      const f = await File.downloadFileAsync(`${API}/v1/rh/nr1.${tipo}`, destino, {
        headers: api.cabecalhos() as Record<string, string>,
      });
      await Sharing.shareAsync(f.uri, {
        mimeType: tipo === "pdf" ? "application/pdf" : "text/csv",
        dialogTitle: "Relatório NR-1",
      });
      setMsg(null);
    } catch {
      setMsg("Não foi possível gerar o relatório agora.");
    }
  };
  return (
    <Tela titulo="Relatório NR-1">
      <AbasRh />
      <Bloco>
        <Texto>
          Números agregados por setor e mês. Grupos com menos de 10 pessoas aparecem como "menos de 10".
        </Texto>
        <Botao titulo="Gerar PDF" onPress={() => void baixar("pdf")} />
        <Botao variante="secundario" titulo="Gerar CSV" onPress={() => void baixar("csv")} />
        {msg && <Texto>{msg}</Texto>}
      </Bloco>
      <Texto variante="pequeno" cor={t.textoSuave}>
        Insumo para o inventário de riscos do PGR. Não substitui a avaliação ergonômica.
      </Texto>
    </Tela>
  );
}
