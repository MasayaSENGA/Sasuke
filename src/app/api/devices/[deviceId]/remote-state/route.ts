import { NextResponse, type NextRequest } from "next/server";
import { acSettingsSchema } from "@/lib/switchbot/remote-state";
import { requireSwitchBot, switchBotErrorResponse } from "@/lib/switchbot/route-helpers";
import { findDevice, updateRemoteState } from "@/lib/switchbot/service";

/**
 * エアコン (赤外線) の設定を、コマンドを送らずに保存する。
 * 電源 OFF 中に変えた温度などを保存しておき、次に運転するときにまとめて送るために使う。
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/devices/[deviceId]/remote-state">,
) {
  const sb = await requireSwitchBot();
  if (sb instanceof NextResponse) return sb;

  const parsed = acSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "設定の形式が不正です" }, { status: 400 });
  }

  const { deviceId } = await ctx.params;
  try {
    const device = await findDevice(sb.userId, sb.client, deviceId);
    if (!device || device.kind !== "ir-ac") {
      return NextResponse.json({ error: "デバイスが見つかりません" }, { status: 404 });
    }
    const remoteState = await updateRemoteState(sb.userId, device, parsed.data);
    return NextResponse.json({ remoteState });
  } catch (error) {
    return switchBotErrorResponse(error);
  }
}
