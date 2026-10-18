// Acesso privado pelo Tailscale Serve. Não usa Funnel nem altera outros serviços.
import { spawn, execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function findProject() {
  for (const candidate of [
    process.cwd(),
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  ]) {
    try {
      if (
        JSON.parse(readFileSync(join(candidate, "package.json"), "utf8"))
          .name === "pipsfit" &&
        existsSync(join(candidate, "server/index.ts"))
      )
        return candidate;
    } catch {}
  }
  throw new Error(
    "Abra o Terminal na pasta Pipsline-main, onde está o arquivo package.json, e execute novamente.",
  );
}
function cliPath(provided) {
  if (provided) return provided;
  const app = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
  return existsSync(app) ? app : "tailscale";
}
async function readJSON(binary, args) {
  let result;
  try {
    result = await execute(binary, args, {
      timeout: 10000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    throw new Error(
      "Não foi possível consultar o Tailscale. Instale o aplicativo, abra-o no Mac e entre na mesma conta pessoal que usará no iPhone.",
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(
      "O Tailscale não retornou um estado válido. Atualize o aplicativo e tente novamente.",
    );
  }
}
function existingServe(config) {
  return (
    config &&
    Object.values(config).some(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== false &&
        JSON.stringify(value) !== "{}" &&
        JSON.stringify(value) !== "[]" &&
        value !== "",
    )
  );
}
async function availablePort(port) {
  await new Promise((done, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `A porta ${port} já está em uso. Na janela do Pipsfit que está aberta, pressione Ctrl+C e tente novamente. Nenhum processo existente foi encerrado.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(done));
  });
}
async function endChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  await new Promise((done) => {
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(force);
      done();
    });
    child.kill("SIGINT");
  });
}

export async function startIphoneAccess(options = {}) {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("O Pipsfit requer Node.js 24 ou superior.");
  const project = resolve(options.projectDir ?? findProject());
  if (
    !existsSync(join(project, "node_modules/tsx/package.json")) ||
    !existsSync(join(project, "dist/index.html"))
  ) {
    throw new Error(
      "Primeiro abra o Pipsfit com iniciar-mac-linux.command para concluir a instalação e criar sua senha.",
    );
  }
  const port = Number(options.port ?? process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("A porta precisa ser um número inteiro entre 1 e 65535.");
  const binary = cliPath(
    options.tailscaleBin ?? process.env.PIPSFIT_TAILSCALE_BIN,
  );
  const state = await readJSON(binary, ["status", "--json"]);
  if (state?.BackendState !== "Running")
    throw new Error(
      "Abra o Tailscale no Mac, entre na sua conta e deixe a conexão ativada.",
    );
  const dns = String(state?.Self?.DNSName ?? "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.ts\.net$/.test(dns) ||
    dns.includes("..")
  ) {
    throw new Error(
      "O Tailscale ainda não forneceu um nome HTTPS válido. Ative MagicDNS na página DNS do painel do Tailscale.",
    );
  }
  const previous = await readJSON(binary, ["serve", "status", "--json"]);
  if (existingServe(previous))
    throw new Error(
      "Já existe outro acesso configurado no Tailscale Serve. Ele foi preservado. Não execute reset; precisamos revisar essa configuração antes de continuar.",
    );
  options.signal?.throwIfAborted();
  await availablePort(port);
  const url = `https://${dns}`;
  const local = `http://127.0.0.1:${port}`;
  const request = options.fetchImpl ?? fetch;
  const say = options.onMessage ?? console.log;
  let server,
    serve,
    awake,
    stopping = false,
    running = false;
  let closeResolve;
  const closed = new Promise((done) => {
    closeResolve = done;
  });
  async function stop() {
    if (stopping) return closed;
    stopping = true;
    options.signal?.removeEventListener("abort", cancelStartup);
    // O modo foreground é removido pelo próprio Tailscale ao encerrar sua sessão.
    // Nenhum comando reset/off é enviado a configurações de outros aplicativos.
    await endChild(serve);
    await endChild(server);
    await endChild(awake);
    closeResolve();
    return closed;
  }
  const cancelStartup = () => {
    void stop();
  };
  options.signal?.addEventListener("abort", cancelStartup, { once: true });
  const watch = (child) => {
    child.once("error", () => {
      if (running && !stopping) void stop();
    });
    child.once("exit", () => {
      if (running && !stopping) void stop();
    });
  };
  try {
    options.signal?.throwIfAborted();
    server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      cwd: project,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PIPSFIT_STORAGE: "sqlite",
        HOST: "127.0.0.1",
        PORT: String(port),
        APP_ORIGIN: url,
        APP_DATA_DIR: resolve(
          options.dataDirectory ??
            process.env.APP_DATA_DIR ??
            join(project, ".local"),
        ),
        PIPSFIT_SETUP_TOKEN: randomBytes(32).toString("hex"),
      },
      stdio: ["ignore", "inherit", "inherit"],
    });
    server.on("error", () => {});
    let started = false;
    for (let i = 0; i < 100; i++) {
      options.signal?.throwIfAborted();
      if (server.exitCode !== null || server.signalCode !== null)
        throw new Error(
          "O servidor não iniciou. Confira a mensagem acima; a pasta de dados foi preservada.",
        );
      try {
        const response = await request(`${local}/api/health`, {
          signal: AbortSignal.timeout(1500),
        });
        const health = await response.json();
        if (response.ok && health.status === "ok" && health.phase === 1) {
          started = true;
          break;
        }
      } catch {}
      await sleep(100);
    }
    if (!started)
      throw new Error(
        "O servidor local não ficou pronto. Feche esta janela e confira a instalação local.",
      );
    const accountResponse = await request(`${local}/api/auth/status`, {
      signal: AbortSignal.timeout(3000),
    });
    const account = await accountResponse.json();
    if (!accountResponse.ok || !account.configured)
      throw new Error(
        "Crie sua senha primeiro: abra iniciar-mac-linux.command, entre no app no Mac e configure a senha. Depois encerre aquele servidor com Ctrl+C e execute este acesso para iPhone novamente.",
      );
    say(
      "Preparando o HTTPS privado. Se o Tailscale pedir autorização, abra o link que ele apresentar e habilite HTTPS/Serve.",
    );
    serve = spawn(binary, ["serve", "--https=443", local], {
      stdio: "inherit",
    });
    serve.on("error", () => {});
    if (
      (options.platform ?? process.platform) === "darwin" &&
      options.preventSleep !== false &&
      existsSync("/usr/bin/caffeinate")
    ) {
      awake = spawn("/usr/bin/caffeinate", ["-i", "-w", String(server.pid)], {
        stdio: "ignore",
      });
      awake.on("error", () => {});
    }
    const deadline = Date.now() + (options.readinessTimeoutMs ?? 5 * 60000);
    let connected = false;
    while (Date.now() < deadline) {
      options.signal?.throwIfAborted();
      if (serve.exitCode !== null || serve.signalCode !== null)
        throw new Error(
          "O Tailscale Serve encerrou antes de habilitar o acesso. Confira a mensagem acima e a conexão do Tailscale.",
        );
      if (server.exitCode !== null || server.signalCode !== null)
        throw new Error(
          "O servidor local encerrou antes de concluir o acesso.",
        );
      try {
        // TLS é verificado normalmente. Não há exceção para certificados inválidos.
        const response = await request(`${url}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const health = await response.json();
        if (response.ok && health.status === "ok" && health.phase === 1) {
          connected = true;
          break;
        }
      } catch {}
      await sleep(500);
    }
    if (!connected)
      throw new Error(
        "O HTTPS ainda não respondeu. Confira a autorização do Serve, MagicDNS e a conexão do Tailscale. Nenhuma verificação de certificado foi desativada.",
      );
    running = true;
    watch(server);
    watch(serve);
    say(`Endereço privado do Pipsfit: ${url}`);
    say(
      "No iPhone, ative o Tailscale na mesma conta e abra esse endereço no Safari. Use a senha que já criou no Mac.",
    );
    say(
      "Mantenha o Mac ligado, com a tampa aberta e esta janela aberta. Para encerrar, pressione Ctrl+C.",
    );
    if (
      options.openBrowser !== false &&
      process.env.PIPSFIT_NO_OPEN !== "1" &&
      (options.platform ?? process.platform) === "darwin"
    ) {
      const browser = spawn("open", [url], { stdio: "ignore" });
      browser.on("error", () => {});
      browser.unref();
    }
    return { url, stop, closed };
  } catch (error) {
    await stop();
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  process.once("SIGHUP", cancel);
  try {
    const handle = await startIphoneAccess({ signal: cancellation.signal });
    await handle.closed;
  } catch (error) {
    if (!cancellation.signal.aborted) {
      console.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o acesso ao iPhone.",
      );
      process.exitCode = 1;
    }
  }
}
