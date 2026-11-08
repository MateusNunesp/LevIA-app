// Monorepo: o Expo detecta workspaces sozinho; esta config só acrescenta a regra de fronteira (a NLU nunca entra no app).
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
const proibidos = ["@levia/nlu", "@anthropic-ai/sdk", "@levia/triage", "@levia/privacy"];
const resolverOriginal = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, nome, plataforma) => {
  if (proibidos.some((p) => nome === p || nome.startsWith(p + "/"))) throw new Error(`O app não pode importar ${nome}`);
  return (resolverOriginal ?? ctx.resolveRequest)(ctx, nome, plataforma);
};
module.exports = config;
