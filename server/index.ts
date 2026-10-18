import type { AppStore } from "./store-contract";
import { createApp } from "./app";
import { runtimeConfig } from "./runtime";
const config = runtimeConfig();
let store: AppStore;
try {
  if (config.storage === "postgres") {
    const { connectPostgres } = await import("./postgres");
    store = await connectPostgres(config.databaseUrl!, config.encryptionKey!);
  } else {
    const { Store } = await import("./database");
    store = new Store(config.directory);
  }
} catch {
  console.error(
    "Não foi possível abrir o banco. Confira a conexão, a chave de criptografia e os logs de configuração, sem compartilhar credenciais.",
  );
  process.exit(1);
}
const server = createApp(store, {
  origin: config.origin,
  secureCookie: config.production,
  setupToken: config.setupToken,
}).listen(config.port, config.host, () =>
  console.log(`Pipsfit: servidor iniciado na porta ${config.port}.`),
);
function stop() {
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
