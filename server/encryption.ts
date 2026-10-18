import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function sealPayload(key: Buffer, value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function openPayload<T>(key: Buffer, payload: string): T {
  const packed = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(packed.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
