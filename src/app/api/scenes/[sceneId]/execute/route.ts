import { NextResponse, type NextRequest } from "next/server";
import { requireSwitchBot, switchBotErrorResponse } from "@/lib/switchbot/route-helpers";
import { executeScene } from "@/lib/switchbot/service";

/** シーンを実行する */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/scenes/[sceneId]/execute">,
) {
  const sb = await requireSwitchBot();
  if (sb instanceof NextResponse) return sb;

  const { sceneId } = await ctx.params;
  try {
    const executed = await executeScene(sb.userId, sb.client, sceneId);
    if (!executed) {
      return NextResponse.json({ error: "シーンが見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return switchBotErrorResponse(error);
  }
}
