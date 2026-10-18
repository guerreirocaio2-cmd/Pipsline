import type { Operation, State } from "../shared/domain";
export type Awaitable<T> = T | Promise<T>;
export type UserCredentials = { salt: string; password_hash: string };
export interface AppStore {
  getUser(): Awaitable<UserCredentials | undefined>;
  createUser(salt: string, passwordHash: string): Awaitable<boolean>;
  hasAuthSession(digest: string, now: number): Awaitable<boolean>;
  createAuthSession(
    digest: string,
    previousDigest: string,
    now: number,
    expires: number,
  ): Awaitable<void>;
  deleteAuthSession(digest: string): Awaitable<void>;
  state(): Awaitable<State>;
  synchronize(
    operations: Operation[],
  ): Awaitable<{ acknowledged: string[]; state: State }>;
  close(): Awaitable<void>;
}
export class Conflict extends Error {
  constructor(
    public entity: import("../shared/domain").Entity,
    public recordId: string,
  ) {
    super(
      "Este registro mudou em outro dispositivo. A cópia local foi preservada.",
    );
  }
}
