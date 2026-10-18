import { openDB } from "idb";
import type { Operation, State } from "../shared/domain";
export type Vault = { state: State; outbox: Operation[]; offlineUntil: number };
type Packed = { salt: Uint8Array; iv: Uint8Array; data: ArrayBuffer };
const database = () =>
  openDB("pipsfit-private", 1, {
    upgrade(db) {
      db.createObjectStore("vault");
    },
  });
export async function packedVault(): Promise<Packed | undefined> {
  return (await database()).get("vault", "account");
}
export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: 310000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function readVault(
  key: CryptoKey,
  packed: Packed,
): Promise<Vault> {
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: packed.iv as Uint8Array<ArrayBuffer> },
        key,
        packed.data,
      ),
    ),
  );
}
export async function writeVault(
  key: CryptoKey,
  salt: Uint8Array,
  vault: Vault,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(vault)),
  );
  try {
    await (await database()).put("vault", { salt, iv, data }, "account");
  } catch {
    throw new Error(
      "Não foi possível gravar no armazenamento deste aparelho. O novo registro ainda não foi confirmado. Libere espaço e tente novamente; exporte os dados já salvos antes de limpar o navegador.",
    );
  }
}
export async function persistentStorage() {
  if (navigator.storage?.persist)
    await navigator.storage.persist().catch(() => false);
}
