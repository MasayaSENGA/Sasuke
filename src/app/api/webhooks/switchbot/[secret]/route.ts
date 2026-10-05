import { NextResponse, type NextRequest } from "next/server";
import { getSwitchBotClient } from "@/lib/switchbot/credentials";
import { publish } from "@/lib/switchbot/events";
import { applyDeviceUpdate } from "@/lib/switchbot/service";
import type { WebhookEvent } from "@/lib/switchbot/types";
import { findUserIdByWebhookSecret, normalizeWebhookContext } from "@/lib/switchbot/webhook";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * SwitchBot からの Webhook 受信口。URL の秘密文字列でユーザーを特定する。
 * ログインは不要 (SwitchBot のサーバーから呼ばれるため)。
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhooks/switchbot/[secret]">) {
  const { secret } = await ctx.params;
  const userId = /^[A-Za-z0-9_-]{32}$/.test(secret) ? await findUserIdByWebhookSecret(secret) : null;
  if (!userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const context = event?.context;
  if (event?.eventType !== "changeReport" || typeof context?.deviceMac !== "string") {
    // 対象外のイベントも受け取った扱いにする (再送させないため)
    return NextResponse.json({ ok: true });
  }

  try {
    const client = await getSwitchBotClient(userId);
    if (client) {
      const status = normalizeWebhookContext(context);
      const device = await applyDeviceUpdate(userId, client, context.deviceMac, status);
      if (device) publish(userId, { type: "device", deviceId: device.id, status });
    }
  } catch (error) {
    console.error("Webhook の処理に失敗しました", error);
  }
  return NextResponse.json({ ok: true });
}
