import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { Store, Conflict } from "./database";
import { operationSchema, type Operation } from "../shared/domain";
const scrypt = promisify(scryptCallback);
const passwordSchema = z.object({
  password: z
    .string()
    .min(12, "Use pelo menos 12 caracteres.")
    .max(128, "Use até 128 caracteres."),
});
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function createApp(
  store: Store,
  {
    secureCookie = process.env.NODE_ENV === "production",
    origin = process.env.APP_ORIGIN,
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      strictTransportSecurity: secureCookie ? undefined : false,
      contentSecurityPolicy: {
        directives: { "upgrade-insecure-requests": secureCookie ? [] : null },
      },
    }),
  );
  app.use(express.json({ limit: "4mb" }));
  const attempts = new Map<string, { count: number; until: number }>();
  const token = (req: Request) => {
    const entry = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("pipsfit_session="));
    return entry?.slice("pipsfit_session=".length) ?? "";
  };
  const authenticated = (req: Request) => {
    const row = store.db
      .prepare("SELECT expires_at FROM auth_sessions WHERE digest=?")
      .get(digest(token(req))) as { expires_at: number } | undefined;
    return !!row && row.expires_at > Date.now();
  };
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const expected = origin ?? `${req.protocol}://${req.get("host")}`;
      if (
        req.get("origin") !== expected ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return res
          .status(403)
          .json({ error: "Origem da requisição não autorizada." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Envie JSON." });
    }
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok", phase: 1 }));
  app.get("/api/auth/status", (req, res) =>
    res.json({
      configured: !!store.db.prepare("SELECT id FROM app_user").get(),
      authenticated: authenticated(req),
    }),
  );
  const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = req.ip ?? "local";
      const now = Date.now();
      const previous = attempts.get(address);
      if (previous && previous.until > now && previous.count >= 8)
        return res.status(429).json({
          error:
            "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
        });
      // Limita memória e tentativas, incluindo senhas malformadas.
      for (const [key, value] of attempts)
        if (value.until <= now) attempts.delete(key);
      if (attempts.size > 10000) attempts.clear();
      attempts.set(address, {
        count: previous && previous.until > now ? previous.count + 1 : 1,
        until: previous && previous.until > now ? previous.until : now + 900000,
      });
      const { password } = passwordSchema.parse(req.body);
      const user = store.db
        .prepare("SELECT salt,password_hash FROM app_user WHERE id=1")
        .get() as { salt: string; password_hash: string } | undefined;
      const setup = req.path === "/api/auth/setup";
      if (setup && user)
        return res.status(409).json({ error: "A senha já foi configurada." });
      if (!setup && !user)
        return res.status(409).json({ error: "Configure sua senha primeiro." });
      const salt = user?.salt ?? randomBytes(32).toString("hex");
      const hash = (await scrypt(password, salt, 64)) as Buffer;
      if (
        user &&
        !timingSafeEqual(hash, Buffer.from(user.password_hash, "hex"))
      )
        return res.status(401).json({ error: "Senha incorreta." });
      if (setup)
        store.transaction(() => {
          store.db
            .prepare("INSERT INTO app_user VALUES (1,?,?)")
            .run(salt, hash.toString("hex"));
          store.seedPlans();
        });
      attempts.delete(address);
      const session = randomBytes(32).toString("hex");
      store.db
        .prepare("DELETE FROM auth_sessions WHERE expires_at<=?")
        .run(now);
      // Renova a sessão deste navegador e conserva as de outros dispositivos.
      store.db
        .prepare("DELETE FROM auth_sessions WHERE digest=?")
        .run(digest(token(req)));
      store.db
        .prepare("INSERT INTO auth_sessions VALUES (?,?)")
        .run(digest(session), now + 8 * 3600000);
      res.cookie("pipsfit_session", session, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "strict",
        path: "/api",
        maxAge: 8 * 3600000,
      });
      res.json({ state: store.state() });
    } catch (error) {
      next(error);
    }
  };
  app.post("/api/auth/setup", login);
  app.post("/api/auth/login", login);
  app.post("/api/auth/logout", (req, res) => {
    store.db
      .prepare("DELETE FROM auth_sessions WHERE digest=?")
      .run(digest(token(req)));
    res.clearCookie("pipsfit_session", {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "strict",
      path: "/api",
    });
    res.json({ ok: true });
  });
  app.get("/api/openapi.json", (_req, res) =>
    res.sendFile(resolve("server/openapi.json")),
  );
  app.use("/api", (req, res, next) =>
    authenticated(req)
      ? next()
      : res.status(401).json({
          error:
            "Sua sessão expirou. Desbloqueie com a senha para sincronizar.",
        }),
  );
  app.get("/api/state", (_req, res) => res.json({ state: store.state() }));
  app.post("/api/sync", (req, res, next) => {
    try {
      const { operations } = z
        .object({ operations: z.array(operationSchema).max(2000) })
        .parse(req.body);
      res.json(store.synchronize(operations as Operation[]));
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/export", (_req, res) =>
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      ...store.state(),
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Rota não encontrada." }),
  );
  if (existsSync(resolve("dist/index.html"))) {
    app.use(
      express.static(resolve("dist"), {
        maxAge: "1h",
        setHeaders(res, path) {
          if (path.endsWith("sw.js") || path.endsWith("index.html"))
            res.setHeader("Cache-Control", "no-cache");
        },
      }),
    );
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  }
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof Conflict)
        return res.status(409).json({
          error: error.message,
          entity: error.entity,
          recordId: error.recordId,
        });
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: error.issues[0]?.message ?? "Dados inválidos." });
      if (
        error instanceof Error &&
        "type" in error &&
        (error as { type: string }).type === "entity.too.large"
      )
        return res.status(413).json({
          error: "Lote muito grande. Exporte os dados e procure suporte.",
        });
      if (error instanceof SyntaxError)
        return res.status(400).json({ error: "JSON inválido." });
      if (
        error instanceof Error &&
        /não encontrad|inválid|somente leitura|ao menos|reutilizado/.test(
          error.message,
        )
      )
        return res.status(400).json({ error: error.message });
      // Não inclui conteúdo de registros ou senhas nos logs.
      console.error(
        "Falha interna da API:",
        error instanceof Error ? error.name : "Erro",
      );
      res.status(500).json({
        error:
          "Não foi possível concluir a operação. Os registros locais foram preservados.",
      });
    },
  );
  return app;
}
