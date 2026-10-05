import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// SwitchBot のトークン/シークレットを DB に保存する際の暗号化 (AES-256-GCM)
// 保存形式: base64(iv).base64(authTag).base64(ciphertext)

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY が設定されていません");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY は 32 バイトを base64 エンコードした値にしてください");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  if (!iv || !tag || !ciphertext) {
    throw new Error("暗号化データの形式が不正です");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
