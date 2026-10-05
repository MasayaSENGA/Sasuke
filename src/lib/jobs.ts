import { prisma } from "@/lib/db";
import { pruneOldReadings } from "@/lib/history";
import { getSwitchBotClient, isMockMode } from "@/lib/switchbot/credentials";
import { collectClimateReadings } from "@/lib/switchbot/service";

// サーバー起動時に始めるバックグラウンド処理 (instrumentation.ts から呼ぶ)
// - 温湿度計の値を定期的に記録 (履歴グラフ用)
// - 古い記録の削除

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** 記録間隔 (分)。0 で無効。Webhook やダッシュボード表示で記録済みのデバイスは API を呼ばない */
const COLLECT_INTERVAL_MS = Number(process.env.HISTORY_COLLECT_INTERVAL_MINUTES ?? 10) * MINUTE;

const globalForJobs = globalThis as unknown as { jobsStarted?: boolean };

async function collectAll() {
  // モックモードでは認証情報の行が無いので、全ユーザーを対象にする
  const userIds = isMockMode
    ? (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id)
    : (await prisma.switchBotCredential.findMany({ select: { userId: true } })).map((c) => c.userId);

  for (const userId of userIds) {
    try {
      const client = await getSwitchBotClient(userId);
      if (client) await collectClimateReadings(userId, client, COLLECT_INTERVAL_MS);
    } catch (error) {
      console.error("温湿度の定期記録に失敗しました", error);
    }
  }
}

async function prune() {
  try {
    const count = await pruneOldReadings();
    if (count > 0) console.log(`古い温湿度の記録を ${count} 件削除しました`);
  } catch (error) {
    console.error("古い記録の削除に失敗しました", error);
  }
}

export function startBackgroundJobs() {
  // 開発時のホットリロードで二重に起動しないようにする
  if (globalForJobs.jobsStarted) return;
  globalForJobs.jobsStarted = true;

  if (COLLECT_INTERVAL_MS > 0) {
    // 起動直後は DB マイグレーション等と重ならないよう少し待つ
    setTimeout(() => void collectAll(), MINUTE);
    setInterval(() => void collectAll(), COLLECT_INTERVAL_MS);
  }
  setTimeout(() => void prune(), 5 * MINUTE);
  setInterval(() => void prune(), DAY);
}
