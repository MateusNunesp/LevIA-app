// Cifra dos dados de saúde em repouso (AES-256-GCM).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export class Cifra {
  private readonly chave: Buffer;
  constructor(segredo: string) {
    if (!segredo || segredo.length < 16) throw new Error("LEVIA_CHAVE_DADOS ausente ou curta");
    this.chave = createHash("sha256").update(segredo).digest();
  }
  cifrar(valor: unknown): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.chave, iv);
    const dados = Buffer.concat([c.update(JSON.stringify(valor), "utf8"), c.final()]);
    return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(".");
  }
  decifrar<T>(texto: string): T {
    const [v, iv, tag, dados] = texto.split(".");
    if (v !== "v1" || !iv || !tag || !dados) throw new Error("formato de cifra inválido");
    const d = createDecipheriv("aes-256-gcm", this.chave, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8")) as T;
  }
}
