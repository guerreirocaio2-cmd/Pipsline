import { Store } from "./database";
import { createApp } from "./app";
import { runtimeConfig } from "./runtime";
const config = runtimeConfig();
const store = new Store(config.directory);
const server = createApp(store, {
  origin: config.origin,
  secureCookie: config.production,
  setupToken: config.setupToken,
}).listen(config.port, config.host, () =>
  console.log(`Pipsfit: servidor iniciado na porta ${config.port}.`),
);
function stop() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
