import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/database";
import { createApp } from "../server/app";
const directory = mkdtempSync(join(tmpdir(), "pipsfit-browser-"));
const store = new Store(directory);
const server = createApp(store, {
  secureCookie: false,
  setupToken: "codigo-de-ativacao-exclusivo-de-teste-123",
}).listen(4173, "127.0.0.1");
function close() {
  server.close(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
