import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Server } from "node:http";
import { Store } from "../server/database";
import { createApp } from "../server/app";
import { makeSession, type Operation } from "../shared/domain";
let directory: string,
  store: Store,
  server: Server,
  base: string,
  cookie = "";
const password = "senha-exclusiva-de-teste-123";
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "pipsfit-test-"));
  store = new Store(directory);
  server = createApp(store, { secureCookie: false }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  cookie = "";
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  store.close();
  rmSync(directory, { recursive: true, force: true });
});
async function request(path: string, body?: unknown, origin = base) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  return { response, value };
}
async function setup() {
  const result = await request("/api/auth/setup", { password });
  cookie = result.response.headers.get("set-cookie")!.split(";")[0];
  return result;
}
describe("autenticação e armazenamento", () => {
  it("bloqueia dados privados e recusa requisição de outra origem", async () => {
    expect((await request("/api/state")).response.status).toBe(401);
    expect(
      (await request("/api/auth/setup", { password }, "https://outro.example"))
        .response.status,
    ).toBe(403);
    expect(
      (await request("/api/auth/setup", { password: "curta" })).response.status,
    ).toBe(400);
  });
  it("cria um único usuário, autentica senha e revoga a sessão ao bloquear", async () => {
    const result = await setup();
    expect(result.response.status).toBe(200);
    expect(result.response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(result.response.headers.get("set-cookie")).toContain(
      "SameSite=Strict",
    );
    expect(
      (await request("/api/auth/setup", { password })).response.status,
    ).toBe(409);
    expect(
      (await request("/api/auth/login", { password: "senha-incorreta-longa" }))
        .response.status,
    ).toBe(401);
    expect((await request("/api/state")).response.status).toBe(200);
    await request("/api/auth/logout", {});
    expect((await request("/api/state")).response.status).toBe(401);
    const login = await request("/api/auth/login", { password });
    expect(login.response.status).toBe(200);
  });
  it("armazena treinos criptografados e detecta adulteração do payload", async () => {
    await setup();
    const before = store.state();
    const session = makeSession(before.plans[0], before);
    session.name = "Registro privado exclusivo";
    const operation: Operation = {
      id: crypto.randomUUID(),
      entity: "session",
      expectedRevision: 0,
      payload: session,
    };
    expect(
      (await request("/api/sync", { operations: [operation] })).response.status,
    ).toBe(200);
    const row = store.db
      .prepare("SELECT payload FROM workout_sessions WHERE id=?")
      .get(session.id) as { payload: string };
    expect(row.payload).not.toContain(session.name);
    const bytes = Buffer.from(row.payload, "base64");
    bytes[30] ^= 1;
    expect(() => store.open(bytes.toString("base64"))).toThrow();
    expect(
      readFileSync(join(directory, "pipsfit.sqlite")).includes(
        Buffer.from(password),
      ),
    ).toBe(false);
  });
  it("aplica limitação de tentativas", async () => {
    await setup();
    for (let i = 0; i < 8; i++)
      expect(
        (await request("/api/auth/login", { password: "incorreta-mas-longa" }))
          .response.status,
      ).toBe(401);
    expect(
      (await request("/api/auth/login", { password })).response.status,
    ).toBe(429);
  });
});
describe("sincronização sem duplicidade", () => {
  it("reaplica operação já confirmada sem criar segunda sessão", async () => {
    await setup();
    const state = store.state();
    const session = makeSession(state.plans[0], state);
    const op: Operation = {
      id: crypto.randomUUID(),
      entity: "session",
      expectedRevision: 0,
      payload: session,
    };
    expect(
      (await request("/api/sync", { operations: [op] })).response.status,
    ).toBe(200);
    const again = await request("/api/sync", { operations: [op] });
    expect(again.response.status).toBe(200);
    expect(again.value.acknowledged).toEqual([op.id]);
    expect(again.value.state.sessions).toHaveLength(1);
  });
  it("conflito reverte todo o lote e conserva o registro remoto", async () => {
    await setup();
    const plan = store.state().plans[0];
    const first: Operation = {
      id: crypto.randomUUID(),
      entity: "plan",
      expectedRevision: 1,
      payload: { ...plan, revision: 2, name: "Outro aparelho" },
    };
    await request("/api/sync", { operations: [first] });
    const custom: Operation = {
      id: crypto.randomUUID(),
      entity: "exercise",
      expectedRevision: 0,
      payload: {
        id: crypto.randomUUID(),
        revision: 1,
        name: "Exercício local",
        group: "Peito",
        equipment: "Halteres",
        custom: true,
      },
    };
    const stale: Operation = {
      id: crypto.randomUUID(),
      entity: "plan",
      expectedRevision: 1,
      payload: { ...plan, revision: 2, name: "Cópia offline" },
    };
    const result = await request("/api/sync", { operations: [custom, stale] });
    expect(result.response.status).toBe(409);
    expect(result.value.recordId).toBe(plan.id);
    expect(store.state().plans.find((x) => x.id === plan.id)?.name).toBe(
      "Outro aparelho",
    );
    expect(
      store.state().exercises.find((x) => x.id === custom.payload.id),
    ).toBeUndefined();
    expect(
      store.db
        .prepare("SELECT id FROM sync_operations WHERE id=?")
        .get(custom.id),
    ).toBeUndefined();
  });
  it("rejeita reutilização de idempotência com outro conteúdo", async () => {
    await setup();
    const plan = store.state().plans[0];
    const op: Operation = {
      id: crypto.randomUUID(),
      entity: "plan",
      expectedRevision: 1,
      payload: { ...plan, revision: 2 },
    };
    await request("/api/sync", { operations: [op] });
    op.payload = { ...plan, revision: 2, name: "Conteúdo alterado" };
    expect(
      (await request("/api/sync", { operations: [op] })).response.status,
    ).toBe(400);
  });
  it("exporta os dados e mantém o esquema das próximas fases", async () => {
    await setup();
    const result = await request("/api/export");
    expect(result.value.exercises.length).toBeGreaterThanOrEqual(150);
    expect(result.value.plans).toHaveLength(3);
    for (const table of [
      "body_composition_entries",
      "private_files",
      "meals",
      "recipes",
      "progress_photos",
      "goals",
    ])
      expect(
        store.db
          .prepare("SELECT name FROM sqlite_master WHERE name=?")
          .get(table),
      ).toBeTruthy();
    expect(JSON.stringify(result.value)).not.toContain("password_hash");
  });
});
