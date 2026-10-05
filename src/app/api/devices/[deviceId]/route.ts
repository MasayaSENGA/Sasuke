import { NextResponse, type NextRequest } from "next/server";
import { requireSwitchBot, switchBotErrorResponse } from "@/lib/switchbot/route-helpers";
import { loadDevice } from "@/lib/switchbot/service";

/** 単一デバイス (ステータス付き)。操作後の状態確認に使う */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/devices/[deviceId]">) {
  const sb = await requireSwitchBot();
  if (sb instanceof NextResponse) return sb;

  const { deviceId } = await ctx.params;
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  try {
    const device = await loadDevice(sb.userId, sb.client, deviceId, { force });
    if (!device) {
      return NextResponse.json({ error: "デバイスが見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ device });
  } catch (error) {
    return switchBotErrorResponse(error);
  }
}
