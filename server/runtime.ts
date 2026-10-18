import { resolve } from "node:path";

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const candidate = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL;
  let origin: string | undefined;
  if (candidate) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(
        "APP_ORIGIN precisa ser um endereço completo, com http:// ou https://.",
      );
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    ) {
      throw new Error(
        "APP_ORIGIN deve conter somente a origem pública, sem caminho ou credenciais.",
      );
    }
    if (production && url.protocol !== "https:")
      throw new Error("Em produção, APP_ORIGIN precisa usar HTTPS.");
    origin = url.origin;
  }
  if (production && !origin)
    throw new Error(
      "Defina APP_ORIGIN com a origem HTTPS pública. No Render, RENDER_EXTERNAL_URL é usado automaticamente.",
    );
  const setupToken = env.PIPSFIT_SETUP_TOKEN;
  if (
    (production || setupToken) &&
    (!setupToken || setupToken.length < 32 || setupToken.length > 256)
  ) {
    throw new Error(
      "Defina PIPSFIT_SETUP_TOKEN com um código privado de 32 a 256 caracteres para proteger a ativação inicial.",
    );
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT deve ser um número inteiro entre 1 e 65535.");
  const storage =
    env.PIPSFIT_STORAGE ?? (env.RENDER === "true" ? "postgres" : "sqlite");
  if (env.RENDER === "true" && storage !== "postgres")
    throw new Error(
      "Na hospedagem Render use PostgreSQL persistente. SQLite no disco temporário não é permitido.",
    );
  if (!["sqlite", "postgres"].includes(storage))
    throw new Error("PIPSFIT_STORAGE precisa ser sqlite ou postgres.");
  const databaseUrl = env.DATABASE_URL;
  const encryptionKey = env.PIPSFIT_ENCRYPTION_KEY;
  if (storage === "postgres") {
    if (!databaseUrl)
      throw new Error(
        "Defina DATABASE_URL com a conexão privada do banco Neon.",
      );
    if (
      !encryptionKey ||
      encryptionKey.length < 32 ||
      encryptionKey.length > 512
    )
      throw new Error(
        "Defina PIPSFIT_ENCRYPTION_KEY com uma chave privada estável de 32 a 512 caracteres.",
      );
  }
  return {
    storage: storage as "sqlite" | "postgres",
    databaseUrl,
    encryptionKey,
    production,
    origin,
    setupToken,
    port,
    host: env.HOST ?? "127.0.0.1",
    directory: resolve(env.APP_DATA_DIR ?? ".local"),
  };
}
