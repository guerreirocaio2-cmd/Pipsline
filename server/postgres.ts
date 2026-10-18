import { Pool, type PoolConfig } from "pg";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { catalog, starterPlans } from "../shared/catalog";
import {
  emptyState,
  entityKey,
  exerciseSchema,
  planSchema,
  sessionSchema,
  type State,
  type Operation,
  type Entity,
  type Exercise,
  type Plan,
  type Session,
} from "../shared/domain";
import {
  Conflict,
  type AppStore,
  type UserCredentials,
} from "./store-contract";
import { sealPayload, openPayload } from "./encryption";
export interface SQLConnection {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}
export interface SQLPool {
  connect(): Promise<SQLConnection>;
  end(): Promise<void>;
}
const tables = {
  exercise: "exercises",
  plan: "workout_plans",
  session: "workout_sessions",
} as const;
const lockId = 1346981971;
const keyCheck = "pipsfit-encryption-key-check-v1";
export function postgresPoolConfig(connectionString: string): PoolConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "DATABASE_URL inválida. Copie a conexão PostgreSQL no painel do Neon.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2
  )
    throw new Error(
      "DATABASE_URL inválida. Use a conexão PostgreSQL completa.",
    );
  for (const key of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.href,
    ssl: { rejectUnauthorized: true },
    enableChannelBinding: true,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    application_name: "pipsfit",
  };
}
export async function connectPostgres(
  connectionString: string,
  secret: string,
): Promise<PostgresStore> {
  const pool = new Pool(postgresPoolConfig(connectionString));
  pool.on("error", () =>
    console.error(
      "Uma conexão ociosa do banco foi encerrada. O próximo acesso tentará reconectar.",
    ),
  );
  const store = new PostgresStore(pool as unknown as SQLPool, secret);
  try {
    await store.initialize();
    return store;
  } catch (error) {
    await store.close();
    throw error;
  }
}
export class PostgresStore implements AppStore {
  private key: Buffer;
  constructor(
    private pool: SQLPool,
    secret: string,
  ) {
    if (secret.length < 32 || secret.length > 512)
      throw new Error(
        "PIPSFIT_ENCRYPTION_KEY precisa ter de 32 a 512 caracteres privados e permanecer igual entre reinicializações.",
      );
    this.key = createHash("sha256")
      .update("pipsfit-records-v1:")
      .update(secret)
      .digest();
  }
  private seal(value: unknown) {
    return sealPayload(this.key, value);
  }
  private open<T>(payload: unknown): T {
    return openPayload<T>(this.key, String(payload));
  }
  private async transaction<T>(
    work: (client: SQLConnection) => Promise<T>,
    readOnly = false,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(
        readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN",
      );
      if (!readOnly)
        await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);
      try {
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      client.release();
    }
  }
  async initialize(): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        readFileSync(new URL("./schema-postgres.sql", import.meta.url), "utf8"),
      );
      const meta = await client.query(
        "SELECT payload FROM app_metadata WHERE id=1",
      );
      if (meta.rows.length) {
        let verified = false;
        try {
          verified =
            this.open<{ check: string }>(meta.rows[0].payload).check ===
            keyCheck;
        } catch {}
        if (!verified)
          throw new Error(
            "PIPSFIT_ENCRYPTION_KEY não corresponde à chave deste banco. Restaure a chave original; os registros não foram substituídos.",
          );
      } else {
        const existing = await client.query(
          "SELECT EXISTS(SELECT 1 FROM exercises) OR EXISTS(SELECT 1 FROM app_user) OR EXISTS(SELECT 1 FROM workout_sessions) AS present",
        );
        if (existing.rows[0]?.present)
          throw new Error(
            "Banco existente sem verificação de chave. Preserve os dados e confira a configuração antes de continuar.",
          );
        await client.query(
          "INSERT INTO app_metadata(id,payload) VALUES (1,$1)",
          [this.seal({ check: keyCheck })],
        );
        const records = catalog.map((record) => ({
          id: record.id,
          revision: record.revision,
          payload: this.seal(record),
        }));
        await client.query(
          "INSERT INTO exercises(id,revision,payload) SELECT id,revision,payload FROM jsonb_to_recordset($1::jsonb) AS x(id text,revision integer,payload text)",
          [JSON.stringify(records)],
        );
      }
    });
  }
  async getUser(): Promise<UserCredentials | undefined> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT salt,password_hash FROM app_user WHERE id=1",
      );
      return result.rows[0] as UserCredentials | undefined;
    } finally {
      client.release();
    }
  }
  async createUser(salt: string, passwordHash: string): Promise<boolean> {
    return this.transaction(async (client) => {
      if (
        (await client.query("SELECT id FROM app_user WHERE id=1")).rows.length
      )
        return false;
      await client.query(
        "INSERT INTO app_user(id,salt,password_hash) VALUES (1,$1,$2)",
        [salt, passwordHash],
      );
      for (const plan of starterPlans()) await this.put(client, "plan", plan);
      return true;
    });
  }
  async hasAuthSession(digest: string, now: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      return (
        (
          await client.query(
            "SELECT digest FROM auth_sessions WHERE digest=$1 AND expires_at>$2",
            [digest, now],
          )
        ).rows.length > 0
      );
    } finally {
      client.release();
    }
  }
  async createAuthSession(
    digest: string,
    previousDigest: string,
    now: number,
    expires: number,
  ): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        "DELETE FROM auth_sessions WHERE expires_at<=$1 OR digest=$2",
        [now, previousDigest],
      );
      await client.query(
        "INSERT INTO auth_sessions(digest,expires_at) VALUES ($1,$2)",
        [digest, expires],
      );
    });
  }
  async deleteAuthSession(digest: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("DELETE FROM auth_sessions WHERE digest=$1", [digest]);
    } finally {
      client.release();
    }
  }
  private async stateIn(client: SQLConnection): Promise<State> {
    const state = emptyState();
    for (const entity of ["exercise", "plan", "session"] as const) {
      const result = await client.query(
        `SELECT payload FROM ${tables[entity]} ORDER BY position`,
      );
      (state[entityKey(entity)] as unknown[]) = result.rows.map((row) =>
        this.open(row.payload),
      );
    }
    return state;
  }
  async state(): Promise<State> {
    return this.transaction((client) => this.stateIn(client), true);
  }
  private async put(
    client: SQLConnection,
    entity: Entity,
    record: Exercise | Plan | Session,
  ): Promise<void> {
    await client.query(
      `INSERT INTO ${tables[entity]}(id,revision,payload) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload`,
      [record.id, record.revision, this.seal(record)],
    );
    if (entity === "plan") {
      const plan = record as Plan;
      await client.query("DELETE FROM plan_exercises WHERE plan_id=$1", [
        plan.id,
      ]);
      await client.query("DELETE FROM workout_days WHERE plan_id=$1", [
        plan.id,
      ]);
      const items = plan.items.map((item, position) => ({
        id: `${plan.id}:${item.id}`,
        plan_id: plan.id,
        exercise_id: item.exerciseId,
        payload: this.seal({ ...item, position }),
      }));
      await client.query(
        "INSERT INTO plan_exercises(id,plan_id,exercise_id,payload) SELECT id,plan_id,exercise_id,payload FROM jsonb_to_recordset($1::jsonb) AS x(id text,plan_id text,exercise_id text,payload text)",
        [JSON.stringify(items)],
      );
      const days = [...new Set(plan.weekdays)].map((weekday) => ({
        id: `${plan.id}:${weekday}`,
        plan_id: plan.id,
        payload: this.seal({ weekday }),
      }));
      if (days.length)
        await client.query(
          "INSERT INTO workout_days(id,plan_id,payload) SELECT id,plan_id,payload FROM jsonb_to_recordset($1::jsonb) AS x(id text,plan_id text,payload text)",
          [JSON.stringify(days)],
        );
    }
    if (entity === "session") {
      const session = record as Session;
      await client.query("DELETE FROM set_logs WHERE session_id=$1", [
        session.id,
      ]);
      const sets =
        session.kind === "strength"
          ? session.exercises.flatMap((exercise) =>
              exercise.sets.map((set) => ({
                id: `${session.id}:${exercise.id}:${set.id}`,
                session_id: session.id,
                exercise_id: exercise.exerciseId,
                payload: this.seal(set),
              })),
            )
          : [];
      if (sets.length)
        await client.query(
          "INSERT INTO set_logs(id,session_id,exercise_id,payload) SELECT id,session_id,exercise_id,payload FROM jsonb_to_recordset($1::jsonb) AS x(id text,session_id text,exercise_id text,payload text)",
          [JSON.stringify(sets)],
        );
    }
  }
  async synchronize(
    operations: Operation[],
  ): Promise<{ acknowledged: string[]; state: State }> {
    return this.transaction(async (client) => {
      const state = await this.stateIn(client);
      const found = operations.length
        ? (
            await client.query(
              "SELECT id,digest FROM sync_operations WHERE id=ANY($1::text[])",
              [operations.map((op) => op.id)],
            )
          ).rows
        : [];
      const done = new Map(
        found.map((row) => [String(row.id), String(row.digest)]),
      );
      const changes = new Map<
        string,
        { entity: Entity; record: Exercise | Plan | Session }
      >();
      const receipts: { id: string; digest: string }[] = [];
      const acknowledged: string[] = [];
      for (const op of operations) {
        const digest = createHash("sha256")
          .update(JSON.stringify(op))
          .digest("hex");
        if (done.has(op.id)) {
          if (done.get(op.id) !== digest)
            throw new Error(
              "Identificador de operação reutilizado com conteúdo diferente.",
            );
          acknowledged.push(op.id);
          continue;
        }
        const record = (
          op.entity === "exercise"
            ? exerciseSchema
            : op.entity === "plan"
              ? planSchema
              : sessionSchema
        ).parse(op.payload);
        const key = entityKey(op.entity);
        const previous = state[key].find((value) => value.id === record.id);
        if (record.revision !== op.expectedRevision + 1)
          throw new Error("Versão de registro inválida.");
        if ((previous?.revision ?? 0) !== op.expectedRevision)
          throw new Conflict(op.entity, record.id);
        if (
          op.entity === "exercise" &&
          (!(record as Exercise).custom ||
            catalog.some((value) => value.id === record.id))
        )
          throw new Error("O catálogo base é somente leitura.");
        if (
          op.entity === "plan" &&
          (record as Plan).items.some(
            (item) =>
              !state.exercises.some(
                (exercise) => exercise.id === item.exerciseId,
              ),
          )
        )
          throw new Error("Exercício não encontrado.");
        if (op.entity === "session") {
          const session = record as Session;
          if (session.kind === "strength") {
            if (session.currentExercise >= session.exercises.length)
              throw new Error("Posição do exercício inválida.");
            if (
              session.finishedAt &&
              !session.exercises.some((exercise) =>
                exercise.sets.some((set) => set.completedAt),
              )
            )
              throw new Error("Conclua ao menos uma série.");
            if (!state.plans.some((plan) => plan.id === session.planId))
              throw new Error("Ficha não encontrada.");
            if (
              session.exercises.some(
                (item) =>
                  !state.exercises.some(
                    (exercise) => exercise.id === item.exerciseId,
                  ),
              )
            )
              throw new Error("Exercício não encontrado.");
          }
        }
        const collection = state[key] as (Exercise | Plan | Session)[];
        const index = collection.findIndex((value) => value.id === record.id);
        if (index < 0) collection.push(record);
        else collection[index] = record;
        changes.set(`${op.entity}:${record.id}`, { entity: op.entity, record });
        done.set(op.id, digest);
        receipts.push({ id: op.id, digest });
        acknowledged.push(op.id);
      }
      // Um registro pode ter dezenas de revisões na fila offline. Persiste somente
      // a versão final e todos os recibos na mesma transação, sem round-trip por série.
      for (const entity of ["exercise", "plan", "session"] as const)
        for (const change of changes.values())
          if (change.entity === entity)
            await this.put(client, entity, change.record);
      if (receipts.length)
        await client.query(
          "INSERT INTO sync_operations(id,digest) SELECT id,digest FROM jsonb_to_recordset($1::jsonb) AS x(id text,digest text)",
          [JSON.stringify(receipts)],
        );
      return { acknowledged, state };
    });
  }
  async close(): Promise<void> {
    await this.pool.end();
    this.key.fill(0);
  }
}
