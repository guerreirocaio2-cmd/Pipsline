import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { catalog, starterPlans } from "../shared/catalog";
import {
  entityKey,
  exerciseSchema,
  planSchema,
  sessionSchema,
  type Entity,
  type Exercise,
  type Plan,
  type Session,
  type State,
  type Operation,
} from "../shared/domain";
const tables = {
  exercise: "exercises",
  plan: "workout_plans",
  session: "workout_sessions",
} as const;
export { Conflict } from "./store-contract";
import {
  Conflict,
  type AppStore,
  type UserCredentials,
} from "./store-contract";
import { sealPayload, openPayload } from "./encryption";
export class Store implements AppStore {
  db: DatabaseSync;
  key: Buffer;
  constructor(public directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const keyPath = join(directory, "master.key");
    if (!existsSync(keyPath)) {
      if (existsSync(join(directory, "pipsfit.sqlite")))
        throw new Error(
          "Chave de criptografia ausente. Restaure master.key do backup; não crie outra chave.",
        );
      writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: "wx" });
    }
    this.key = readFileSync(keyPath);
    if (this.key.length !== 32)
      throw new Error("Chave de criptografia inválida.");
    chmodSync(keyPath, 0o600);
    this.db = new DatabaseSync(join(directory, "pipsfit.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;",
    );
    this.db.exec(
      readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    chmodSync(join(directory, "pipsfit.sqlite"), 0o600);
    if (!this.db.prepare("SELECT id FROM exercises LIMIT 1").get()) {
      this.transaction(() => {
        for (const exercise of catalog) this.put("exercise", exercise);
      });
    }
  }
  seal(value: unknown) {
    return sealPayload(this.key, value);
  }
  open<T>(payload: string): T {
    return openPayload<T>(this.key, payload);
  }
  getUser(): UserCredentials | undefined {
    return this.db
      .prepare("SELECT salt,password_hash FROM app_user WHERE id=1")
      .get() as UserCredentials | undefined;
  }
  createUser(salt: string, passwordHash: string): boolean {
    return this.transaction(() => {
      if (this.getUser()) return false;
      this.db
        .prepare("INSERT INTO app_user VALUES (1,?,?)")
        .run(salt, passwordHash);
      this.seedPlans();
      return true;
    });
  }
  hasAuthSession(digest: string, now: number): boolean {
    return !!this.db
      .prepare(
        "SELECT digest FROM auth_sessions WHERE digest=? AND expires_at>?",
      )
      .get(digest, now);
  }
  createAuthSession(
    digest: string,
    previousDigest: string,
    now: number,
    expires: number,
  ): void {
    this.transaction(() => {
      this.db
        .prepare("DELETE FROM auth_sessions WHERE expires_at<=? OR digest=?")
        .run(now, previousDigest);
      this.db
        .prepare("INSERT INTO auth_sessions VALUES (?,?)")
        .run(digest, expires);
    });
  }
  deleteAuthSession(digest: string): void {
    this.db.prepare("DELETE FROM auth_sessions WHERE digest=?").run(digest);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  state(): State {
    const state = { exercises: [], plans: [], sessions: [] } as State;
    for (const entity of ["exercise", "plan", "session"] as const) {
      const rows = this.db
        .prepare(`SELECT payload FROM ${tables[entity]} ORDER BY rowid`)
        .all() as { payload: string }[];
      (state[entityKey(entity)] as unknown[]) = rows.map((r) =>
        this.open(r.payload),
      );
    }
    return state;
  }
  put(entity: Entity, record: Exercise | Plan | Session) {
    this.db
      .prepare(
        `INSERT INTO ${tables[entity]} (id,revision,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload`,
      )
      .run(record.id, record.revision, this.seal(record));
    if (entity === "plan") {
      const plan = record as Plan;
      this.db
        .prepare("DELETE FROM plan_exercises WHERE plan_id=?")
        .run(plan.id);
      this.db.prepare("DELETE FROM workout_days WHERE plan_id=?").run(plan.id);
      for (const [position, item] of plan.items.entries())
        this.db
          .prepare("INSERT INTO plan_exercises VALUES (?,?,?,?)")
          .run(
            `${plan.id}:${item.id}`,
            plan.id,
            item.exerciseId,
            this.seal({ ...item, position }),
          );
      for (const day of new Set(plan.weekdays))
        this.db
          .prepare("INSERT INTO workout_days VALUES (?,?,?)")
          .run(`${plan.id}:${day}`, plan.id, this.seal({ weekday: day }));
    }
    if (entity === "session") {
      const session = record as Session;
      this.db
        .prepare("DELETE FROM set_logs WHERE session_id=?")
        .run(session.id);
      if (session.kind === "strength")
        for (const exercise of session.exercises)
          for (const set of exercise.sets)
            this.db
              .prepare("INSERT INTO set_logs VALUES (?,?,?,?)")
              .run(
                `${session.id}:${exercise.id}:${set.id}`,
                session.id,
                exercise.exerciseId,
                this.seal(set),
              );
    }
  }
  seedPlans() {
    for (const plan of starterPlans()) this.put("plan", plan);
  }
  synchronize(operations: Operation[]) {
    return this.transaction(() => {
      const acknowledged: string[] = [];
      for (const op of operations) {
        const digest = createHash("sha256")
          .update(JSON.stringify(op))
          .digest("hex");
        const done = this.db
          .prepare("SELECT digest FROM sync_operations WHERE id=?")
          .get(op.id) as { digest: string } | undefined;
        if (done) {
          if (done.digest !== digest)
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
        if (record.revision !== op.expectedRevision + 1)
          throw new Error("Versão de registro inválida.");
        const existing = this.db
          .prepare(`SELECT revision FROM ${tables[op.entity]} WHERE id=?`)
          .get(record.id) as { revision: number } | undefined;
        if ((existing?.revision ?? 0) !== op.expectedRevision)
          throw new Conflict(op.entity, record.id);
        if (
          op.entity === "exercise" &&
          (!(record as Exercise).custom ||
            catalog.some((x) => x.id === record.id))
        )
          throw new Error("O catálogo base é somente leitura.");
        if (
          op.entity === "plan" &&
          (record as Plan).items.some(
            (item) =>
              !this.db
                .prepare("SELECT id FROM exercises WHERE id=?")
                .get(item.exerciseId),
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
              !session.exercises.some((e) => e.sets.some((s) => s.completedAt))
            )
              throw new Error("Conclua ao menos uma série.");
            if (
              !this.db
                .prepare("SELECT id FROM workout_plans WHERE id=?")
                .get(session.planId)
            )
              throw new Error("Ficha não encontrada.");
            if (
              session.exercises.some(
                (e) =>
                  !this.db
                    .prepare("SELECT id FROM exercises WHERE id=?")
                    .get(e.exerciseId),
              )
            )
              throw new Error("Exercício não encontrado.");
          }
        }
        this.put(op.entity, record);
        this.db
          .prepare("INSERT INTO sync_operations VALUES (?,?)")
          .run(op.id, digest);
        acknowledged.push(op.id);
      }
      return { acknowledged, state: this.state() };
    });
  }
  close() {
    this.db.close();
    this.key.fill(0);
  }
}
