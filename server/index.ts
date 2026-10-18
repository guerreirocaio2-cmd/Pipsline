import { resolve } from "node:path";
import { Store } from "./database";
import { createApp } from "./app";
const port = Number(process.env.PORT ?? 3001);
const store = new Store(resolve(process.env.APP_DATA_DIR ?? ".local"));
const server = createApp(store).listen(
  port,
  process.env.HOST ?? "127.0.0.1",
  () => console.log(`Pipsfit: servidor iniciado na porta ${port}.`),
);
function stop() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
