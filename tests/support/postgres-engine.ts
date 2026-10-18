import type { PGlite } from "@electric-sql/pglite";
import type { SQLPool } from "../../server/postgres";
// O motor PostgreSQL em WASM tem uma conexão. Serializa os empréstimos para
// representar o contrato do Pool; a aplicação executa o mesmo SQL da produção.
export function enginePool(db: PGlite): SQLPool {
  let queue = Promise.resolve();
  return {
    async connect() {
      const previous = queue;
      let unlock!: () => void;
      const held = new Promise<void>((resolve) => (unlock = resolve));
      queue = previous.then(() => held);
      await previous;
      return {
        async query(text: string, values?: unknown[]) {
          if (!values && text.includes("CREATE TABLE")) {
            await db.exec(text);
            return { rows: [] };
          }
          return {
            rows: (await db.query<Record<string, unknown>>(text, values)).rows,
          };
        },
        release: unlock,
      };
    },
    async end() {},
  };
}
