import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { scryptSync } from "node:crypto";
import { Store } from "../server/database";
import { startIphoneAccess } from "../scripts/iphone-mac.mjs";
let folder: string, data: string, binary: string, port: number;
let running: Awaited<ReturnType<typeof startIphoneAccess>> | undefined;
const password = "senha-exclusiva-de-teste-iphone";
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), "pipsfit-iphone-"));
  data = join(folder, "dados");
  binary = join(folder, "tailscale");
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
  port = (probe.address() as { port: number }).port;
  await new Promise<void>((done) => probe.close(() => done()));
  const store = new Store(data);
  store.transaction(() => {
    store.db
      .prepare("INSERT INTO app_user VALUES (1,?,?)")
      .run(
        "salt-de-teste",
        scryptSync(password, "salt-de-teste", 64).toString("hex"),
      );
    store.seedPlans();
  });
  store.close();
  writeFileSync(
    join(folder, "estado.json"),
    JSON.stringify({
      BackendState: "Running",
      Self: { DNSName: "mac-pipsfit.exemplo.ts.net." },
    }),
  );
  writeFileSync(join(folder, "serve-config.json"), "null");
  writeFileSync(
    binary,
    `#!/usr/bin/env node
const fs=require('node:fs');const path=require('node:path');const folder=__dirname;const args=process.argv.slice(2);fs.appendFileSync(path.join(folder,'chamadas.txt'),JSON.stringify(args)+'\\n');
if(args[0]==='status'){console.log(fs.readFileSync(path.join(folder,'estado.json'),'utf8'));}
else if(args[0]==='serve'&&args[1]==='status'){console.log(fs.readFileSync(path.join(folder,'serve-config.json'),'utf8'));}
else if(args[0]==='serve'&&args[1]==='--https=443'){fs.writeFileSync(path.join(folder,'ativo'),'sim');const finish=()=>{try{fs.unlinkSync(path.join(folder,'ativo'));}catch{}process.exit(0);};process.on('SIGINT',finish);process.on('SIGTERM',finish);setInterval(()=>{},1000);}
else process.exit(2);
`,
    { mode: 0o755 },
  );
});
afterEach(async () => {
  await running?.stop();
  running = undefined;
  rmSync(folder, { recursive: true, force: true });
});
const options = () => ({
  projectDir: resolve("."),
  dataDirectory: data,
  tailscaleBin: binary,
  port,
  platform: "linux",
  openBrowser: false,
  preventSleep: false,
  readinessTimeoutMs: 5000,
  onMessage: () => {},
});
describe("acesso privado para iPhone", () => {
  it("inicia com origem HTTPS e senha existente, preserva os dados e encerra os próprios processos", async () => {
    const requests: string[] = [];
    const routedFetch: typeof fetch = async (input, init) => {
      const address = String(input);
      requests.push(address);
      if (address.startsWith("https://")) {
        if (!existsSync(join(folder, "ativo")))
          throw new Error("Proxy ainda não foi ativado");
        return fetch(
          address.replace(
            "https://mac-pipsfit.exemplo.ts.net",
            `http://127.0.0.1:${port}`,
          ),
          init,
        );
      }
      return fetch(input, init);
    };
    const keyBefore = readFileSync(join(data, "master.key"));
    running = await startIphoneAccess({ ...options(), fetchImpl: routedFetch });
    expect(running.url).toBe("https://mac-pipsfit.exemplo.ts.net");
    expect(requests.some((x) => x.startsWith("https://"))).toBe(true);
    const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: running.url },
      body: JSON.stringify({ password }),
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("Secure");
    expect((await login.json()).state.plans).toHaveLength(3);
    const calls = readFileSync(join(folder, "chamadas.txt"), "utf8");
    expect(calls).not.toMatch(/funnel|reset|"off"|--bg/);
    await running.stop();
    expect(existsSync(join(folder, "ativo"))).toBe(false);
    expect(readFileSync(join(data, "master.key")).equals(keyBefore)).toBe(true);
    await expect(
      fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow();
  });
  it("encerra o proxy e o servidor se a ativação for cancelada", async () => {
    const cancellation = new AbortController();
    const unavailableFetch: typeof fetch = async (input, init) => {
      if (String(input).startsWith("https://"))
        throw new Error("Certificado ainda em preparação");
      return fetch(input, init);
    };
    const starting = startIphoneAccess({
      ...options(),
      signal: cancellation.signal,
      fetchImpl: unavailableFetch,
    });
    const outcome = starting.then(
      () => "iniciado",
      (error) => error,
    );
    for (let i = 0; i < 60 && !existsSync(join(folder, "ativo")); i++)
      await new Promise((done) => setTimeout(done, 50));
    expect(existsSync(join(folder, "ativo"))).toBe(true);
    cancellation.abort();
    expect((await outcome).name).toBe("AbortError");
    expect(existsSync(join(folder, "ativo"))).toBe(false);
    await expect(
      fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow();
  });
  it("recusa sobrescrever outra configuração de Serve", async () => {
    const previous = {
      TCP: { 443: { HTTPS: true } },
      Web: {
        "outro.exemplo.ts.net:443": {
          Handlers: { "/": { Proxy: "http://127.0.0.1:9999" } },
        },
      },
    };
    writeFileSync(join(folder, "serve-config.json"), JSON.stringify(previous));
    await expect(startIphoneAccess(options())).rejects.toThrow("preservado");
    expect(existsSync(join(folder, "ativo"))).toBe(false);
    expect(
      JSON.parse(readFileSync(join(folder, "serve-config.json"), "utf8")),
    ).toEqual(previous);
  });
  it("exige conexão autenticada do Tailscale antes de iniciar o servidor", async () => {
    writeFileSync(
      join(folder, "estado.json"),
      JSON.stringify({ BackendState: "NeedsLogin" }),
    );
    await expect(startIphoneAccess(options())).rejects.toThrow(
      "entre na sua conta",
    );
    expect(existsSync(join(folder, "ativo"))).toBe(false);
  });
  it("não publica uma instalação que ainda não tenha senha e limpa o servidor após a falha", async () => {
    const store = new Store(data);
    store.db.prepare("DELETE FROM app_user").run();
    store.close();
    await expect(startIphoneAccess(options())).rejects.toThrow(
      "Crie sua senha primeiro",
    );
    expect(existsSync(join(folder, "ativo"))).toBe(false);
    await expect(
      fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow();
  });
});
