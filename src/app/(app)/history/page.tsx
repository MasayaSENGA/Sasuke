import Link from "next/link";
import { HistoryView } from "@/components/history/history-view";
import { getSession } from "@/lib/auth";
import { getSwitchBotClient } from "@/lib/switchbot/credentials";
import { loadDashboard } from "@/lib/switchbot/service";

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const session = await getSession();
  if (!session) return null; // layout でリダイレクト済み

  const client = await getSwitchBotClient(session.user.id);
  // 並び順を反映するため loadDashboard を使う (ステータスはキャッシュ済みならそれを使う)
  const devices = client ? await loadDashboard(session.user.id, client).catch(() => []) : [];
  const climateDevices = devices
    .filter((d) => d.kind === "climate")
    .map((d) => ({ id: d.id, name: d.name }));

  const { device } = await searchParams;
  const requested = typeof device === "string" ? device : undefined;
  const initialDeviceId = climateDevices.some((d) => d.id === requested)
    ? requested!
    : climateDevices[0]?.id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">温湿度の履歴</h1>
      {initialDeviceId ? (
        <HistoryView devices={climateDevices} initialDeviceId={initialDeviceId} />
      ) : (
        <p className="text-zinc-500">
          温湿度計が見つかりません。{" "}
          {!client && (
            <Link href="/settings" className="underline">
              SwitchBot のトークンを登録してください
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
