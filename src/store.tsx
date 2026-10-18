import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import {
  deriveKey,
  packedVault,
  readVault,
  writeVault,
  persistentStorage,
  type Vault,
} from "./vault";
import {
  overlay,
  entityKey,
  type State,
  type Operation,
  type Entity,
  type Exercise,
  type Plan,
  type Session,
} from "../shared/domain";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error ?? "Não foi possível concluir.",
      response.status,
    );
  return result;
}
type Context = {
  vault: Vault | null;
  busy: boolean;
  error: string;
  syncError: string;
  online: boolean;
  syncing: boolean;
  lastSync: Date | null;
  login: (
    password: string,
    setup: boolean,
    setupToken?: string,
  ) => Promise<void>;
  lock: () => Promise<void>;
  mutate: (entity: Entity, record: Exercise | Plan | Session) => Promise<void>;
  sync: () => Promise<void>;
  recover: () => Promise<void>;
  clearError: () => void;
};
const StoreContext = createContext<Context>(null!);
export const useStore = () => useContext(StoreContext);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [vault, setVault] = useState<Vault | null>(null);
  const current = useRef<Vault | null>(null);
  const key = useRef<CryptoKey | null>(null);
  const salt = useRef<Uint8Array | null>(null);
  const version = useRef(0);
  const chain = useRef(Promise.resolve());
  const running = useRef(false);
  const releaseDevice = useRef<(() => void) | null>(null);
  async function claimDevice() {
    if (!navigator.locks)
      throw new Error(
        "Atualize o navegador para proteger os registros offline entre abas.",
      );
    await new Promise<void>((resolve, reject) => {
      void navigator.locks
        .request(
          "pipsfit-vault-session",
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              reject(
                new Error(
                  "O Pipsfit já está desbloqueado em outra aba deste aparelho. Bloqueie ou feche a outra aba antes de entrar aqui.",
                ),
              );
              return;
            }
            const held = new Promise<void>((release) => {
              releaseDevice.current = release;
            });
            resolve();
            await held;
          },
        )
        .catch(reject);
    });
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const task = chain.current.then(fn);
    chain.current = task.then(
      () => {},
      () => {},
    );
    return task;
  }
  async function persist(next: Vault) {
    if (!key.current || !salt.current)
      throw new Error("Desbloqueie o aplicativo.");
    await writeVault(key.current, salt.current, next);
    current.current = next;
    setVault(next);
  }
  async function login(password: string, setup: boolean, setupToken?: string) {
    setBusy(true);
    setError("");
    try {
      await claimDevice();
      const packed = await packedVault();
      const localSalt =
        packed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
      const localKey = await deriveKey(password, localSalt);
      let local: Vault | undefined;
      if (packed) {
        try {
          local = await readVault(localKey, packed);
        } catch {
          throw new Error(
            "Não foi possível abrir os dados deste aparelho com essa senha. Use a senha original; a cópia criptografada foi preservada.",
          );
        }
      }
      let remote: { state: State } | undefined;
      try {
        remote = await api(setup ? "/auth/setup" : "/auth/login", {
          password,
          ...(setup && setupToken ? { setupToken } : {}),
        });
      } catch (e) {
        if (e instanceof ApiError) throw e;
        if (!local)
          throw new Error(
            "Sem acesso ao servidor. Conecte-se para entrar pela primeira vez neste aparelho.",
          );
        if (local.offlineUntil < Date.now())
          throw new Error(
            "O acesso offline venceu. Conecte-se e entre novamente para renová-lo.",
          );
      }
      key.current = localKey;
      salt.current = localSalt;
      version.current++;
      const outbox = local?.outbox ?? [];
      await persist({
        state: remote ? overlay(remote.state, outbox) : local!.state,
        outbox,
        offlineUntil: remote ? Date.now() + 7 * 86400000 : local!.offlineUntil,
      });
      setSyncError(
        remote
          ? ""
          : "Modo offline. Os registros ficam neste aparelho até a conexão voltar.",
      );
      await persistentStorage();
    } catch (e) {
      releaseDevice.current?.();
      releaseDevice.current = null;
      key.current = null;
      salt.current = null;
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function mutate(entity: Entity, record: Exercise | Plan | Session) {
    setBusy(true);
    setError("");
    try {
      await serialize(async () => {
        const before = current.current;
        if (!before) throw new Error("Desbloqueie o aplicativo.");
        const existing = before.state[entityKey(entity)].find(
          (x) => x.id === record.id,
        );
        const expected = existing?.revision ?? 0;
        // Recusa alterações feitas sobre uma renderização antiga, em vez de sobrescrevê-las.
        if (existing && record.revision !== existing.revision)
          throw new Error(
            "O registro acabou de mudar. Tente novamente para usar os dados atualizados.",
          );
        const op: Operation = {
          id: crypto.randomUUID(),
          entity,
          expectedRevision: expected,
          payload: { ...record, revision: expected + 1 },
        };
        await persist({
          ...before,
          state: overlay(before.state, [op]),
          outbox: [...before.outbox, op],
        });
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar no aparelho.",
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    if (running.current || !current.current || !navigator.onLine) return;
    running.current = true;
    setSyncing(true);
    const generation = version.current;
    const pending: Operation[] = [];
    let bytes = 0;
    for (const operation of current.current.outbox) {
      const size = new TextEncoder().encode(JSON.stringify(operation)).length;
      if (pending.length && (pending.length >= 100 || bytes + size > 1000000))
        break;
      pending.push(operation);
      bytes += size;
    }
    try {
      const result = pending.length
        ? await api<{ state: State; acknowledged: string[] }>("/sync", {
            operations: pending,
          })
        : { ...(await api<{ state: State }>("/state")), acknowledged: [] };
      await serialize(async () => {
        if (generation !== version.current || !current.current) return;
        const left = current.current.outbox.filter(
          (x) => !result.acknowledged.includes(x.id),
        );
        await persist({
          ...current.current,
          state: overlay(result.state, left),
          outbox: left,
        });
        setLastSync(new Date());
        setSyncError("");
      });
    } catch (e) {
      if (generation === version.current)
        setSyncError(
          e instanceof ApiError
            ? e.message
            : "Sem conexão com o servidor. Os registros continuam salvos neste aparelho.",
        );
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }
  async function recover() {
    setBusy(true);
    try {
      await serialize(async () => {
        if (!current.current) return;
        const remote = await api<{ state: State }>("/state");
        // Preserva o estado final de cada registro pendente como uma nova entidade.
        const latest = new Map<string, Operation>();
        for (const op of current.current.outbox)
          latest.set(`${op.entity}:${op.payload.id}`, op);
        const ids = new Map(
          [...latest.values()].map((op) => [
            op.payload.id,
            crypto.randomUUID(),
          ]),
        );
        const operations = [...latest.values()]
          .sort(
            (a, b) =>
              ["exercise", "plan", "session"].indexOf(a.entity) -
              ["exercise", "plan", "session"].indexOf(b.entity),
          )
          .map((op) => {
            const record = structuredClone(op.payload);
            record.id = ids.get(record.id)!;
            record.revision = 1;
            if (op.entity === "exercise") {
              (record as Exercise).name =
                (record as Exercise).name.slice(0, 100) + " (cópia recuperada)";
            }
            if (op.entity === "plan") {
              const plan = record as Plan;
              plan.name = plan.name.slice(0, 80) + " (cópia recuperada)";
              plan.items = plan.items.map((item) => ({
                ...item,
                exerciseId: ids.get(item.exerciseId) ?? item.exerciseId,
              }));
            }
            if (
              op.entity === "session" &&
              (record as Session).kind === "strength"
            ) {
              const session = record as Extract<Session, { kind: "strength" }>;
              session.name = session.name.slice(0, 80) + " (cópia recuperada)";
              session.planId = ids.get(session.planId) ?? session.planId;
              session.exercises = session.exercises.map((e) => ({
                ...e,
                exerciseId: ids.get(e.exerciseId) ?? e.exerciseId,
              }));
            }
            return {
              id: crypto.randomUUID(),
              entity: op.entity,
              expectedRevision: 0,
              payload: record,
            };
          });
        await persist({
          ...current.current,
          state: overlay(remote.state, operations),
          outbox: operations,
        });
        setSyncError("");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível recuperar.");
    } finally {
      setBusy(false);
    }
    await sync();
  }
  async function lock() {
    await chain.current;
    version.current++;
    key.current = null;
    salt.current = null;
    current.current = null;
    releaseDevice.current?.();
    releaseDevice.current = null;
    setVault(null);
    setSyncError("");
    setError("");
    await api("/auth/logout", {}).catch(() => {});
  }
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!vault) return;
    const t = setTimeout(() => void sync(), 500);
    return () => clearTimeout(t);
  }, [vault?.outbox.length, !!vault, online]);
  useEffect(() => {
    const interval = setInterval(() => void sync(), 20000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let hiddenAt = 0;
    const change = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 15 * 60000) void lock();
    };
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return (
    <StoreContext.Provider
      value={{
        vault,
        busy,
        error,
        syncError,
        online,
        syncing,
        lastSync,
        login,
        lock,
        mutate,
        sync,
        recover,
        clearError: () => setError(""),
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
