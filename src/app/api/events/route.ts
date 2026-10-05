import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { subscribe } from "@/lib/switchbot/events";

/** ハートビートの間隔 (プロキシにアイドル接続として切られないようにする) */
const HEARTBEAT_MS = 25 * 1000;

/**
 * ダッシュボード向けのリアルタイム配信 (Server-Sent Events)。
 * Webhook で届いた状態変化を、そのユーザーの開いている画面へ送る。
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      send("retry: 5000\n\n");
      const unsubscribe = subscribe(session.user.id, (event) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // 既に閉じている
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
