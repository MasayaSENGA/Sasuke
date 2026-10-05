"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { SwitchBotApiError, SwitchBotClient } from "@/lib/switchbot/client";
import {
  deleteCredentials,
  getSwitchBotClient,
  saveCredentials,
} from "@/lib/switchbot/credentials";
import { disableWebhook, enableWebhook, isWebhookEnabled } from "@/lib/switchbot/webhook";

export type CredentialFormState = { error?: string } | null;
export type WebhookFormState = { error?: string; foreignUrls?: string[] } | null;

// HTTP ヘッダーに載せるため、表示可能な ASCII 文字のみ許可する。
// (コピー時に全角文字やゼロ幅スペースが混ざると fetch が例外を投げるため、先に弾く)
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

const credentialSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "トークンを入力してください")
    .max(512)
    .regex(PRINTABLE_ASCII, "トークンに使えない文字 (全角文字や空白など) が含まれています。コピーし直してください"),
  secret: z
    .string()
    .trim()
    .min(1, "シークレットを入力してください")
    .max(512)
    .regex(PRINTABLE_ASCII, "シークレットに使えない文字 (全角文字や空白など) が含まれています。コピーし直してください"),
});

async function requireUserId() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user.id;
}

export async function saveCredentialsAction(
  _prev: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const userId = await requireUserId();

  const parsed = credentialSchema.safeParse({
    token: formData.get("token"),
    secret: formData.get("secret"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }
  const { token, secret } = parsed.data;

  // 保存前に実際に API を呼んで、トークン/シークレットが正しいか確かめる
  try {
    await new SwitchBotClient(token, secret).getDevices();
  } catch (error) {
    if (error instanceof SwitchBotApiError) {
      return { error: error.message };
    }
    console.error("SwitchBot API への接続に失敗しました", error);
    return { error: "SwitchBot API に接続できませんでした。ネットワーク接続を確認してください" };
  }

  await disableWebhookQuietly(userId);
  await saveCredentials(userId, token, secret);
  redirect("/dashboard");
}

export async function deleteCredentialsAction() {
  const userId = await requireUserId();
  await disableWebhookQuietly(userId);
  await deleteCredentials(userId);
  redirect("/settings");
}

/** 認証情報の変更・削除前に、登録済みの Webhook を解除する (失敗しても続行) */
async function disableWebhookQuietly(userId: string) {
  if (!(await isWebhookEnabled(userId))) return;
  try {
    await disableWebhook(userId, await getSwitchBotClient(userId));
  } catch (error) {
    console.error("Webhook の解除に失敗しました", error);
  }
}

export async function enableWebhookAction(
  _prev: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const userId = await requireUserId();
  const client = await getSwitchBotClient(userId);
  if (!client) return { error: "先に SwitchBot のトークンを登録してください" };

  try {
    const result = await enableWebhook(userId, client, {
      replaceForeign: formData.get("replaceForeign") === "on",
    });
    if (!result.ok) return { error: result.error, foreignUrls: result.foreignUrls };
  } catch (error) {
    if (error instanceof SwitchBotApiError) return { error: error.message };
    console.error("Webhook の登録に失敗しました", error);
    return { error: "Webhook を登録できませんでした" };
  }
  redirect("/settings");
}

export async function disableWebhookAction() {
  const userId = await requireUserId();
  try {
    await disableWebhook(userId, await getSwitchBotClient(userId));
  } catch (error) {
    console.error("Webhook の解除に失敗しました", error);
  }
  redirect("/settings");
}
