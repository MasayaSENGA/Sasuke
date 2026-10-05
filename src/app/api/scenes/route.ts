import { NextResponse } from "next/server";
import { requireSwitchBot, switchBotErrorResponse } from "@/lib/switchbot/route-helpers";
import { getScenes } from "@/lib/switchbot/service";

/** 手動実行シーンの一覧 */
export async function GET() {
  const sb = await requireSwitchBot();
  if (sb instanceof NextResponse) return sb;
  try {
    return NextResponse.json({ scenes: await getScenes(sb.userId, sb.client) });
  } catch (error) {
    return switchBotErrorResponse(error);
  }
}
