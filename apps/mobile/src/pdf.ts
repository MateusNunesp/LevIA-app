// Resumo em PDF gerado NO APARELHO. A pessoa escolhe salvar ou compartilhar. Nunca é enviado sozinho.
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api } from "./api.ts";

export async function compartilharResumo(episodioId: string): Promise<void> {
  const { html } = await api.resumo(episodioId);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Resumo da LevIA" });
  }
}
