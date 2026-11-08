// pnpm dev: sobe a API e o Expo juntos. pnpm demo: o mesmo, com dados de demonstração e seletor de perfil.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const demo = process.env.LEVIA_DEMO === "1";
const env = { ...process.env };
if (demo) {
  env.LEVIA_DB = env.LEVIA_DB ?? "levia-demo.db";
  env.EXPO_PUBLIC_LEVIA_DEMO = "1";
}
const rodar = (cmd, args, extra = {}) => spawn(cmd, args, { stdio: "inherit", env: { ...env, ...extra }, shell: process.platform === "win32" });

if (demo && !existsSync(env.LEVIA_DB)) {
  await new Promise((ok, erro) => rodar("pnpm", ["seed"]).on("exit", (c) => (c === 0 ? ok() : erro(new Error("seed falhou")))));
}
const filhos = [rodar("pnpm", ["--filter", "@levia/api", "start"]), rodar("pnpm", ["--filter", "@levia/mobile", "start"])];
const parar = () => filhos.forEach((f) => f.kill("SIGINT"));
process.on("SIGINT", parar);
process.on("SIGTERM", parar);
