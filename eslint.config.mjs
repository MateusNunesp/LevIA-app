// ESLint (flat). Regras de fronteira estão no dependency-cruiser; aqui ficam qualidade, a11y e privacidade.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import a11y from "eslint-plugin-react-native-a11y";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.expo/**", "**/dist/**", "apps/mobile/android/**", "apps/mobile/ios/**", "**/*.config.*", "**/*.cjs", "**/metro.config.js", "scripts/dev.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Privacidade (4.9): no servidor e nos pacotes, nada de console.* — só o log de eventos sem dado de saúde.
  {
    files: ["apps/api/src/**/*.ts", "packages/*/src/**/*.ts"],
    ignores: ["apps/api/src/montar.ts", "apps/api/src/bench-cli.ts"],
    rules: {
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.property.name=/^(info|warn|error|debug|trace)$/][callee.object.property.name='log'] > :matches(Identifier, ObjectExpression)", message: "Não registre objetos em log: só códigos de evento (4.9)." },
        { selector: "CallExpression[callee.object.name='sv'][callee.property.name='log'] > ObjectExpression > Property[key.name=/^(texto|respostas|estado|valor|regioes|nota|achados)$/]", message: "Log sem dado de saúde (4.9)." },
        { selector: "CallExpression[callee.object.type='ThisExpression'][callee.property.name='log'] > ObjectExpression > Property[key.name=/^(texto|respostas|estado|valor|regioes|nota|achados)$/]", message: "Log sem dado de saúde (4.9)." },
      ],
    },
  },
  // Acessibilidade do app (M6).
  {
    files: ["apps/mobile/**/*.tsx", "packages/ui/src/**/*.tsx"],
    plugins: { "react-native-a11y": a11y },
    rules: {
      "react-native-a11y/has-valid-accessibility-role": "error",
      "react-native-a11y/has-valid-accessibility-state": "error",
      "react-native-a11y/has-valid-accessibility-actions": "error",
      "react-native-a11y/has-valid-accessibility-live-region": "error",
      "react-native-a11y/has-valid-important-for-accessibility": "error",
      "react-native-a11y/has-accessibility-hint": "off",
      "react-native-a11y/no-nested-touchables": "off",
      "react-native-a11y/has-valid-accessibility-descriptors": "error",
    },
  },
);
