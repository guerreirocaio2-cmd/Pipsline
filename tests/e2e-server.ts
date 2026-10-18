import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/database";
import { createApp } from "../server/app";
import type { AppStore } from "../server/store-contract";
const directory = mkdtempSync(join(tmpdir(), "pipsfit-browser-"));
let store: AppStore;
let closeEngine: () => Promise<void> = async () => {};
if (process.env.PIPSFIT_E2E_POSTGRES === "1") {
  const { PGlite } = await import("@electric-sql/pglite");
  const { PostgresStore } = await import("../server/postgres");
  const { enginePool } = await import("./support/postgres-engine");
  const engine = new PGlite(join(directory, "pg"));
  const postgres = new PostgresStore(
    enginePool(engine),
    "chave-privada-exclusiva-do-teste-browser-123",
  );
  await postgres.initialize();
  store = postgres;
  closeEngine = () => engine.close();
} else store = new Store(directory);
const server = createApp(store, {
  secureCookie: false,
  setupToken: "codigo-de-ativacao-exclusivo-de-teste-123",
}).listen(4173, "127.0.0.1");
function close() {
  server.close(async () => {
    await store.close();
    await closeEngine();
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
