import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { clearUserCache } from "./cache";
import { SwitchBotClient } from "./client";
import { MockSwitchBotClient } from "./mock";
import type { SwitchBotApi } from "./types";

/** 開発用モック。本番では強制的に無効 */
export const isMockMode =
  process.env.SWITCHBOT_MOCK === "true" && process.env.NODE_ENV !== "production";

export async function hasCredentials(userId: string): Promise<boolean> {
  if (isMockMode) return true;
  const count = await prisma.switchBotCredential.count({ where: { userId } });
  return count > 0;
}

export async function saveCredentials(userId: string, token: string, secret: string) {
  const data = { encryptedToken: encrypt(token), encryptedSecret: encrypt(secret) };
  await prisma.switchBotCredential.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  clearUserCache(userId);
}

export async function deleteCredentials(userId: string) {
  await prisma.switchBotCredential.deleteMany({ where: { userId } });
  clearUserCache(userId);
}

/** ユーザーの SwitchBot クライアントを返す。未登録なら null */
export async function getSwitchBotClient(userId: string): Promise<SwitchBotApi | null> {
  if (isMockMode) return new MockSwitchBotClient();

  const credential = await prisma.switchBotCredential.findUnique({ where: { userId } });
  if (!credential) return null;
  return new SwitchBotClient(decrypt(credential.encryptedToken), decrypt(credential.encryptedSecret));
}
