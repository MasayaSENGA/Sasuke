import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getHistory, HISTORY_RANGES, type HistoryRange } from "@/lib/history";

/** 温湿度の履歴。?deviceId=...&range=24h|7d|30d */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const deviceId = request.nextUrl.searchParams.get("deviceId");
  const range = request.nextUrl.searchParams.get("range") ?? "24h";
  if (!deviceId || !(range in HISTORY_RANGES)) {
    return NextResponse.json({ error: "パラメータが不正です" }, { status: 400 });
  }

  // 記録はユーザー ID で絞り込むので、他人のデバイスの履歴は取得できない
  const points = await getHistory(session.user.id, deviceId, range as HistoryRange);
  return NextResponse.json({ points });
}
