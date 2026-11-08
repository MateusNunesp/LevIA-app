// Fronteiras entre módulos (6.3), impostas no `pnpm check`.
const pkg = (n) => `^packages/${n}/`;
module.exports = {
  forbidden: [
    { name: "triage-puro", comment: "triage depende só de shared: sem IO, sem IA, sem banco", severity: "error",
      from: { path: "^packages/triage/src" }, to: { path: "^(packages/(?!shared/|triage/)|apps/)|node_modules|^(fs|node:fs|http|https|net|node:.*)$", dependencyTypesNot: ["type-only"] } },
    { name: "conversation-sem-ia", severity: "error", from: { path: pkg("conversation") + "src" },
      to: { path: "^packages/(nlu|privacy|ritmo|summary|ui)/|^apps/|@anthropic-ai" } },
    { name: "nlu-nao-conhece-saidas", comment: "nlu nunca importa triage nem conversation", severity: "error",
      from: { path: pkg("nlu") }, to: { path: "^packages/(triage|conversation|content|redflags|privacy|ritmo|summary)/" } },
    { name: "app-sem-nlu", comment: "a NLU (e a chave) nunca entram no app", severity: "error",
      from: { path: "^(apps/mobile|packages/ui)/" }, to: { path: "^packages/(nlu|triage|conversation|privacy|content)/|@anthropic-ai|node_modules/@anthropic-ai" } },
    { name: "rh-so-via-privacy", comment: "rotas do RH só usam agregados do privacy", severity: "error",
      from: { path: "^apps/mobile/app/rh/" }, to: { path: "^packages/(triage|conversation|nlu|redflags)/" } },
    { name: "redflags-puro", severity: "error", from: { path: pkg("redflags") }, to: { path: "^packages/(?!shared/|redflags/)|^apps/" } },
    { name: "privacy-puro", severity: "error", from: { path: pkg("privacy") }, to: { path: "^packages/(?!shared/|privacy/)|^apps/" } },
    { name: "ritmo-puro", severity: "error", from: { path: pkg("ritmo") }, to: { path: "^packages/(?!shared/|ritmo/)|^apps/" } },
    { name: "sem-ciclos", severity: "error", from: { path: "^packages/" }, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(test|bin)/|\\.test\\.ts$" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    combinedDependencies: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "default"], extensions: [".ts", ".tsx", ".js"] },
  },
};
