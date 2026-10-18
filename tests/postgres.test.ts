import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import {
  PostgresStore,
  postgresPoolConfig,
  type SQLPool,
} from "../server/postgres";
import { createApp } from "../server/app";
import { enginePool } from "./support/postgres-engine";
import { makeSession, type Operation } from "../shared/domain";
let folder: string,
  engine: PGlite,
  store: PostgresStore,
  pool: SQLPool,
  server: Server | undefined;
const key = "chave-privada-apenas-do-banco-de-teste-123456";
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), "pipsfit-pg-"));
  engine = new PGlite(join(folder, "dados"));
  pool = enginePool(engine);
  store = new PostgresStore(pool, key);
  await store.initialize();
});
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  server = undefined;
  await store.close();
  await engine.close();
  rmSync(folder, { recursive: true, force: true });
});
async function configure() {
  expect(
    await store.createUser("salt-exclusivo-teste", "hash-exclusivo-teste"),
  ).toBe(true);
  return store.state();
}
describe("PostgreSQL persistente", () => {
  it("instala o esquema relacional e criptografa os dados pessoais", async () => {
    const state = await configure();
    expect(state.exercises.length).toBeGreaterThanOrEqual(150);
    expect(state.plans).toHaveLength(3);
    const record = makeSession(state.plans[0], state);
    record.name = "Treino privado de teste";
    await store.synchronize([
      {
        id: crypto.randomUUID(),
        entity: "session",
        expectedRevision: 0,
        payload: record,
      },
    ]);
    const rows = await engine.query<{ payload: string }>(
      "SELECT payload FROM workout_sessions",
    );
    expect(rows.rows[0].payload).not.toContain(record.name);
    expect(
      (await engine.query("SELECT id FROM set_logs")).rows.length,
    ).toBeGreaterThan(0);
    const tables = await engine.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );
    expect(
      tables.rows.some((x) => x.table_name === "body_composition_entries"),
    ).toBe(true);
  });
  it("conserva conta, registros e recibos depois de fechar e reabrir o motor", async () => {
    const state = await configure();
    const record = makeSession(state.plans[0], state);
    const op: Operation = {
      id: crypto.randomUUID(),
      entity: "session",
      expectedRevision: 0,
      payload: record,
    };
    await store.synchronize([op]);
    await store.close();
    await engine.close();
    engine = new PGlite(join(folder, "dados"));
    pool = enginePool(engine);
    store = new PostgresStore(pool, key);
    await store.initialize();
    expect((await store.getUser())?.salt).toBe("salt-exclusivo-teste");
    expect((await store.synchronize([op])).state.sessions).toEqual([record]);
  });
  it("rejeita uma chave trocada sem substituir os dados existentes", async () => {
    const state = await configure();
    const other = new PostgresStore(
      pool,
      "outra-chave-privada-que-nao-e-a-original-123",
    );
    await expect(other.initialize()).rejects.toThrow("não corresponde");
    expect((await store.state()).plans).toEqual(state.plans);
  });
  it("confirma revisões offline em lote e reenvia sem duplicar", async () => {
    const state = await configure();
    const first = makeSession(state.plans[0], state);
    const next = { ...first, revision: 2, currentExercise: 1 };
    const ops: Operation[] = [
      {
        id: crypto.randomUUID(),
        entity: "session",
        expectedRevision: 0,
        payload: first,
      },
      {
        id: crypto.randomUUID(),
        entity: "session",
        expectedRevision: 1,
        payload: next,
      },
    ];
    expect((await store.synchronize(ops)).acknowledged).toHaveLength(2);
    expect((await store.synchronize(ops)).state.sessions).toEqual([next]);
    expect(
      (await engine.query("SELECT id FROM sync_operations")).rows,
    ).toHaveLength(2);
    const changed = {
      ...ops[0],
      payload: { ...first, name: "Conteúdo diferente" },
    };
    await expect(store.synchronize([changed])).rejects.toThrow("reutilizado");
  });
  it("faz rollback do lote inteiro em conflito e preserva a versão remota", async () => {
    const state = await configure();
    const plan = state.plans[0];
    await store.synchronize([
      {
        id: crypto.randomUUID(),
        entity: "plan",
        expectedRevision: 1,
        payload: { ...plan, revision: 2, name: "Versão remota" },
      },
    ]);
    const own = {
      id: crypto.randomUUID(),
      revision: 1,
      name: "Exercício local",
      equipment: "Halteres",
      group: "Peito" as const,
      custom: true,
    };
    await expect(
      store.synchronize([
        {
          id: crypto.randomUUID(),
          entity: "exercise",
          expectedRevision: 0,
          payload: own,
        },
        {
          id: crypto.randomUUID(),
          entity: "plan",
          expectedRevision: 1,
          payload: { ...plan, revision: 2, name: "Cópia offline" },
        },
      ]),
    ).rejects.toThrow("outro dispositivo");
    const current = await store.state();
    expect(current.exercises.some((x) => x.id === own.id)).toBe(false);
    expect(current.plans.find((x) => x.id === plan.id)?.name).toBe(
      "Versão remota",
    );
  });
  it("usa transação para criar somente uma conta mesmo com duas solicitações", async () => {
    const results = await Promise.all([
      store.createUser("a", "hash-a"),
      store.createUser("b", "hash-b"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await store.state()).plans).toHaveLength(3);
  });
  it("exercita autenticação, cookie, exportação e logout pela API assíncrona", async () => {
    const activation = "codigo-de-ativacao-exclusivo-de-teste-123";
    server = createApp(store, {
      secureCookie: false,
      setupToken: activation,
    }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    let cookie = "";
    const request = (path: string, body?: unknown) =>
      fetch(origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: origin,
          Cookie: cookie,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    expect((await request("/api/state")).status).toBe(401);
    expect(
      (
        await request("/api/auth/setup", {
          password: "senha-do-postgres-de-teste",
        })
      ).status,
    ).toBe(401);
    const setup = await request("/api/auth/setup", {
      password: "senha-do-postgres-de-teste",
      setupToken: activation,
    });
    expect(setup.status).toBe(200);
    expect((await setup.json()).state.plans).toHaveLength(3);
    cookie = setup.headers.get("set-cookie")!.split(";")[0];
    const exported = await request("/api/export");
    expect(exported.status).toBe(200);
    expect((await exported.json()).exercises.length).toBeGreaterThanOrEqual(
      150,
    );
    expect((await request("/api/auth/logout", {})).status).toBe(200);
    expect((await request("/api/state")).status).toBe(401);
  });
  it("mantém validação TLS explícita mesmo quando a URL traz sslmode", () => {
    const config = postgresPoolConfig(
      "postgresql://usuario:senha-de-teste@banco.example/neondb?sslmode=require&channel_binding=require",
    );
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.enableChannelBinding).toBe(true);
    expect(() => postgresPoolConfig("url-invalida-com-credencial")).toThrow(
      "DATABASE_URL inválida",
    );
  });
});
