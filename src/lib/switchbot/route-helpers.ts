import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SwitchBotApiError } from "./client";
import { getSwitchBotClient } from "./credentials";
import type { SwitchBotApi } from "./types";

type Context = { userId: string; client: SwitchBotApi };

/** Route Handler 用: ログイン済みかつ SwitchBot 認証情報が登録済みであることを確認する */
export async function requireSwitchBot(): Promise<Context | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  const client = await getSwitchBotClient(session.user.id);
  if (!client) {
    return NextResponse.json(
      { error: "SwitchBot のトークンが登録されていません", code: "NO_CREDENTIALS" },
      { status: 409 },
    );
  }
  return { userId: session.user.id, client };
}

export function switchBotErrorResponse(error: unknown) {
  if (error instanceof SwitchBotApiError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  console.error(error);
  return NextResponse.json({ error: "予期しないエラーが発生しました" }, { status: 500 });
}
