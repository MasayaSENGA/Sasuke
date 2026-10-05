import Link from "next/link";
import { DeviceDashboard } from "@/components/dashboard/device-dashboard";
import { getSession } from "@/lib/auth";
import { SwitchBotApiError } from "@/lib/switchbot/client";
import { getSwitchBotClient } from "@/lib/switchbot/credentials";
import type { DashboardDevice } from "@/lib/switchbot/devices";
import { loadDashboard } from "@/lib/switchbot/service";

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
  let devices: DashboardDevice[] = [];
  let error: string | null = null;
  try {
    devices = await loadDashboard(session.user.id, client);
  } catch (e) {
    error = e instanceof SwitchBotApiError ? e.message : "デバイスを取得できませんでした";
  }

  return <DeviceDashboard initialDevices={devices} initialError={error} />;
}
