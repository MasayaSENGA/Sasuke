import { NextResponse, type NextRequest } from "next/server";
import { requireSwitchBot, switchBotErrorResponse } from "@/lib/switchbot/route-helpers";
import { loadDashboard } from "@/lib/switchbot/service";

/** デバイス一覧 (ステータス付き)。?refresh=1 でキャッシュを短くして再取得 */
export async function GET(request: NextRequest) {
  const ctx = await requireSwitchBot();
  if (ctx instanceof NextResponse) return ctx;

  const force = request.nextUrl.searchParams.get("refresh") === "1";
  try {
    const devices = await loadDashboard(ctx.userId, ctx.client, { force });
    return NextResponse.json({ devices });
  } catch (error) {
    return switchBotErrorResponse(error);
  }
}
