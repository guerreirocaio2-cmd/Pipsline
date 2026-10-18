import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, PIPSFIT_E2E_POSTGRES: "1" } },
);
child.once("error", () => {
  console.error("Não foi possível iniciar os testes. Execute npm ci primeiro.");
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
