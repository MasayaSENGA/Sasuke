import Link from "next/link";
import { DeviceDashboard } from "@/components/dashboard/device-dashboard";
import { getSession } from "@/lib/auth";
import { SwitchBotApiError } from "@/lib/switchbot/client";
import { getSwitchBotClient } from "@/lib/switchbot/credentials";
import type { DashboardDevice } from "@/lib/switchbot/devices";
import { getScenes, loadDashboard } from "@/lib/switchbot/service";
import type { Scene } from "@/lib/switchbot/types";
import { isWebhookEnabled } from "@/lib/switchbot/webhook";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null; // layout でリダイレクト済み

  const client = await getSwitchBotClient(session.user.id);
  if (!client) {
    return (
      <div className="mx-auto mt-16 max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">SwitchBot と連携しましょう</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          デバイスを表示するには、SwitchBot アプリで発行したトークンとシークレットを登録してください。
        </p>
        <Link
          href="/settings"
          className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          設定へ進む
        </Link>
      </div>
    );
  }

  // 初回表示はサーバーで取得して、読み込み中の空白をなくす
  const [devicesResult, scenesResult, realtime] = await Promise.all([
    loadDashboard(session.user.id, client).then(
      (devices) => ({ devices, error: null }),
      (e: unknown) => ({
        devices: [] as DashboardDevice[],
        error: e instanceof SwitchBotApiError ? e.message : "デバイスを取得できませんでした",
      }),
    ),
    // シーンが取れなくてもデバイスは表示する
    getScenes(session.user.id, client).catch((): Scene[] => []),
    isWebhookEnabled(session.user.id),
  ]);

  return (
    <DeviceDashboard
      initialDevices={devicesResult.devices}
      initialError={devicesResult.error}
      scenes={scenesResult}
      realtime={realtime}
    />
  );
}
