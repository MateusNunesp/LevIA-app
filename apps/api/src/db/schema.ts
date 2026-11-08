// Esquema Drizzle (espelha migrations/*.sql, que são a fonte das migrações versionadas).
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const empresa = sqliteTable("empresa", { id: text("id").primaryKey(), nome: text("nome").notNull() });
export const setor = sqliteTable("setor", { id: text("id").primaryKey(), empresaId: text("empresa_id").notNull(), nome: text("nome").notNull() });
export const pessoa = sqliteTable("pessoa", {
  idPseudonimo: text("id_pseudonimo").primaryKey(),
  empresaId: text("empresa_id").notNull(),
  setorId: text("setor_id").notNull(),
  papel: text("papel", { enum: ["funcionario", "rh"] }).notNull(),
  criadoEm: text("criado_em").notNull(),
});
export const consentimento = sqliteTable("consentimento", {
  idPseudonimo: text("id_pseudonimo").notNull(),
  tipo: text("tipo", { enum: ["triagem", "ritmo"] }).notNull(),
  versaoTexto: integer("versao_texto").notNull(),
  dadoEm: text("dado_em").notNull(),
  revogadoEm: text("revogado_em"),
});
export const ultimoUso = sqliteTable("ultimo_uso", { idPseudonimo: text("id_pseudonimo").primaryKey(), em: text("em").notNull() });
export const sessao = sqliteTable("sessao", {
  id: text("id").primaryKey(),
  idPseudonimo: text("id_pseudonimo").notNull(),
  modo: text("modo").notNull(),
  estadoCifrado: text("estado_cifrado").notNull(),
  episodioId: text("episodio_id"),
  terminada: integer("terminada").notNull().default(0),
  atualizadoEm: text("atualizado_em").notNull(),
});
export const episodio = sqliteTable("episodio", {
  id: text("id").primaryKey(),
  idPseudonimo: text("id_pseudonimo").notNull(),
  inicio: text("inicio").notNull(),
  versaoRegras: text("versao_regras").notNull(),
  dadosCifrado: text("dados_cifrado").notNull(),
});
export const checagem = sqliteTable("checagem", {
  id: text("id").primaryKey(),
  episodioId: text("episodio_id").notNull(),
  semana: integer("semana").notNull(),
  feitaEm: text("feita_em").notNull(),
  dadosCifrado: text("dados_cifrado").notNull(),
});
export const plano = sqliteTable("plano", {
  id: text("id").primaryKey(),
  episodioId: text("episodio_id").notNull(),
  idPseudonimo: text("id_pseudonimo").notNull(),
  exercicios: text("exercicios").notNull(),
  status: text("status", { enum: ["ativo", "pausado", "encerrado"] }).notNull(),
  criadoEm: text("criado_em").notNull(),
  pausadoEm: text("pausado_em"),
  encerradoEm: text("encerrado_em"),
  checagens: text("checagens").notNull(),
});
export const registroExercicio = sqliteTable("registro_exercicio", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planoId: text("plano_id").notNull(),
  exercicioId: text("exercicio_id").notNull(),
  dia: text("dia").notNull(),
  quantidade: integer("quantidade").notNull(),
});
export const ritmoMembro = sqliteTable("ritmo_membro", {
  setorId: text("setor_id").notNull(),
  idPseudonimo: text("id_pseudonimo").notNull(),
  apelido: text("apelido").notNull(),
  entrouEm: text("entrou_em").notNull(),
  saiuEm: text("saiu_em"),
});
export const agregadoRh = sqliteTable("agregado_rh", {
  empresaId: text("empresa_id").notNull(),
  setor: text("setor").notNull(),
  mes: text("mes").notNull(),
  indicador: text("indicador").notNull(),
  valor: real("valor"),
  suprimido: integer("suprimido").notNull(),
});
export const usoIa = sqliteTable("uso_ia", {
  dia: text("dia").primaryKey(),
  chamadas: integer("chamadas").notNull().default(0),
  tokensEntrada: integer("tokens_entrada").notNull().default(0),
  tokensSaida: integer("tokens_saida").notNull().default(0),
  cacheHits: integer("cache_hits").notNull().default(0),
});
