import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isMockMode } from "./credentials";
import type { DeviceStatus, SwitchBotApi } from "./types";

// SwitchBot の Webhook には署名の仕組みが無いため、
// 推測できない秘密文字列を URL に含め、その一致をもって正規の通知とみなす。
// DB には秘密文字列そのものではなくハッシュだけを保存する。

export const WEBHOOK_PATH = "/api/webhooks/switchbot";

function appBaseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
}

/** SwitchBot のサーバーから届く公開 HTTPS URL で動いているか (ローカル開発では使えない) */
export function canUseWebhook(): boolean {
  if (isMockMode) return true;
  try {
    const url = new URL(appBaseUrl());
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** このアプリが登録した Webhook URL か */
function isOwnWebhookUrl(url: string): boolean {
  return url.startsWith(`${appBaseUrl()}${WEBHOOK_PATH}/`);
}

export async function isWebhookEnabled(userId: string): Promise<boolean> {
  const credential = await prisma.switchBotCredential.findUnique({
    where: { userId },
    select: { webhookSecretHash: true },
  });
  return Boolean(credential?.webhookSecretHash);
}

/** 秘密文字列から、Webhook を登録したユーザーを特定する */
export async function findUserIdByWebhookSecret(secret: string): Promise<string | null> {
  const credential = await prisma.switchBotCredential.findUnique({
    where: { webhookSecretHash: hashWebhookSecret(secret) },
    select: { userId: true },
  });
  return credential?.userId ?? null;
}

export type EnableWebhookResult =
  | { ok: true }
  | { ok: false; error: string; foreignUrls?: string[] };

/**
 * Webhook を登録する。SwitchBot アカウントに他サービスの Webhook がある場合は、
 * replaceForeign が true のときだけ置き換える (1 アカウントにつき 1 つしか登録できないため)。
 */
export async function enableWebhook(
  userId: string,
  client: SwitchBotApi,
  { replaceForeign = false } = {},
): Promise<EnableWebhookResult> {
  if (!canUseWebhook()) {
    return { ok: false, error: "Webhook は公開 HTTPS の URL で動いている環境でのみ使えます" };
  }

  const existing = await client.getWebhookUrls();
  const foreignUrls = existing.filter((url) => !isOwnWebhookUrl(url));
  if (foreignUrls.length > 0 && !replaceForeign) {
    return {
      ok: false,
      error: "SwitchBot アカウントに別の Webhook が登録されています",
      foreignUrls,
    };
  }
  for (const url of existing) {
    await client.deleteWebhook(url);
  }

  const secret = randomBytes(24).toString("base64url");
  await client.setupWebhook(`${appBaseUrl()}${WEBHOOK_PATH}/${secret}`);
  const webhookData = { webhookSecretHash: hashWebhookSecret(secret), webhookEnabledAt: new Date() };
  if (isMockMode) {
    // モックモードでは認証情報の行が無いことがあるので、ダミーで作る
    await prisma.switchBotCredential.upsert({
      where: { userId },
      create: { userId, encryptedToken: encrypt("mock"), encryptedSecret: encrypt("mock"), ...webhookData },
      update: webhookData,
    });
  } else {
    await prisma.switchBotCredential.update({ where: { userId }, data: webhookData });
  }
  return { ok: true };
}

/** このアプリが登録した Webhook を解除する */
export async function disableWebhook(userId: string, client: SwitchBotApi | null) {
  if (client) {
    const urls = await client.getWebhookUrls();
    for (const url of urls.filter(isOwnWebhookUrl)) {
      await client.deleteWebhook(url);
    }
  }
  await prisma.switchBotCredential.updateMany({
    where: { userId },
    data: { webhookSecretHash: null, webhookEnabledAt: null },
  });
}

const IGNORED_KEYS = new Set(["deviceType", "deviceMac", "timeOfSample", "scale"]);

/**
 * Webhook の context を、ステータス API と同じ形に寄せる。
 * 機種によって powerState: "ON" / lockState: "LOCKED" / detectionState など表現が異なるため。
 */
export function normalizeWebhookContext(context: Record<string, unknown>): Partial<DeviceStatus> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!IGNORED_KEYS.has(key)) out[key] = value;
  }

  if (typeof out.powerState === "string") {
    out.power = out.powerState;
    delete out.powerState;
  }
  if (typeof out.power === "string") out.power = out.power.toLowerCase();
  if (typeof out.lockState === "string") out.lockState = out.lockState.toLowerCase();

  if (typeof out.detectionState === "string") {
    out.moveDetected = out.detectionState === "DETECTED";
    delete out.detectionState;
  } else if (typeof out.detectionState === "number") {
    // 水漏れセンサー: 0 = なし, 1 = 検知
    out.status = out.detectionState;
    delete out.detectionState;
  }

  if (context.scale === "FAHRENHEIT" && typeof out.temperature === "number") {
    out.temperature = Math.round((((out.temperature - 32) * 5) / 9) * 10) / 10;
  }
  return out as Partial<DeviceStatus>;
}
