-- LevIA: esquema inicial. Identidade separada de saúde.
-- Colunas *_cifrado guardam JSON cifrado com AES-256-GCM (dados de saúde em repouso).
CREATE TABLE empresa (id TEXT PRIMARY KEY, nome TEXT NOT NULL);
CREATE TABLE setor (id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES empresa(id), nome TEXT NOT NULL);
CREATE TABLE pessoa (
  id_pseudonimo TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresa(id),
  setor_id TEXT NOT NULL REFERENCES setor(id),
  papel TEXT NOT NULL CHECK (papel IN ('funcionario','rh')),
  criado_em TEXT NOT NULL
);
CREATE TABLE consentimento (
  id_pseudonimo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('triagem','ritmo')),
  versao_texto INTEGER NOT NULL,
  dado_em TEXT NOT NULL,
  revogado_em TEXT,
  PRIMARY KEY (id_pseudonimo, tipo, dado_em)
);
CREATE TABLE ultimo_uso (id_pseudonimo TEXT PRIMARY KEY, em TEXT NOT NULL);

-- ---- saúde ----
CREATE TABLE sessao (
  id TEXT PRIMARY KEY,
  id_pseudonimo TEXT NOT NULL,
  modo TEXT NOT NULL,
  estado_cifrado TEXT NOT NULL,
  episodio_id TEXT,
  terminada INTEGER NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL
);
CREATE TABLE episodio (
  id TEXT PRIMARY KEY,
  id_pseudonimo TEXT NOT NULL,
  inicio TEXT NOT NULL,
  versao_regras TEXT NOT NULL,
  -- regiao, saida, urgente_hoje, regras_disparadas, start_back_risco, respostas confirmadas
  dados_cifrado TEXT NOT NULL
);
CREATE INDEX episodio_pessoa ON episodio(id_pseudonimo);
CREATE TABLE checagem (
  id TEXT PRIMARY KEY,
  episodio_id TEXT NOT NULL REFERENCES episodio(id) ON DELETE CASCADE,
  semana INTEGER NOT NULL,
  feita_em TEXT NOT NULL,
  dados_cifrado TEXT NOT NULL -- nota, limita_trabalho, alerta
);
CREATE TABLE plano (
  id TEXT PRIMARY KEY,
  episodio_id TEXT NOT NULL REFERENCES episodio(id) ON DELETE CASCADE,
  id_pseudonimo TEXT NOT NULL,
  exercicios TEXT NOT NULL, -- ids do catálogo
  status TEXT NOT NULL CHECK (status IN ('ativo','pausado','encerrado')),
  criado_em TEXT NOT NULL,
  pausado_em TEXT,
  encerrado_em TEXT,
  checagens TEXT NOT NULL -- JSON [{semana, data}]
);
CREATE TABLE registro_exercicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plano_id TEXT NOT NULL REFERENCES plano(id) ON DELETE CASCADE,
  exercicio_id TEXT NOT NULL,
  dia TEXT NOT NULL,
  quantidade INTEGER NOT NULL
);
CREATE TABLE ritmo_membro (
  setor_id TEXT NOT NULL,
  id_pseudonimo TEXT NOT NULL,
  apelido TEXT NOT NULL,
  entrou_em TEXT NOT NULL,
  saiu_em TEXT,
  PRIMARY KEY (setor_id, id_pseudonimo, entrou_em)
);

-- ---- agregados e métricas sem conteúdo ----
CREATE TABLE agregado_rh (
  empresa_id TEXT NOT NULL, setor TEXT NOT NULL, mes TEXT NOT NULL, indicador TEXT NOT NULL,
  valor REAL, suprimido INTEGER NOT NULL,
  PRIMARY KEY (empresa_id, setor, mes, indicador)
);
CREATE TABLE uso_ia (
  dia TEXT PRIMARY KEY, chamadas INTEGER NOT NULL DEFAULT 0, tokens_entrada INTEGER NOT NULL DEFAULT 0,
  tokens_saida INTEGER NOT NULL DEFAULT 0, cache_hits INTEGER NOT NULL DEFAULT 0
);
-- TODO(login): tabelas de convite, e-mail e sessão de login ficam fora do MVP.
