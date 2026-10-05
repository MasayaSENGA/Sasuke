"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardDevice, DeviceKind } from "@/lib/switchbot/devices";
import { DeviceTile } from "./device-tile";

/**
 * 自動更新の間隔。SwitchBot API は 1 日 10,000 回までで、1 回の更新でステータス対応デバイスの数だけ API を呼ぶ。
 * 例: 10 台 × 2 分間隔 × 24 時間 = 7,200 回 / 日 (タブが表示されている間だけ更新する)
 */
const POLL_INTERVAL_MS = 2 * 60 * 1000;

const SECTIONS: { title: string; kinds: DeviceKind[] }[] = [
  { title: "室内環境", kinds: ["climate"] },
  { title: "家電", kinds: ["switch", "bot", "light", "curtain", "lock", "ir-ac", "ir"] },
  { title: "センサー", kinds: ["sensor"] },
  { title: "その他", kinds: ["other"] },
];

export function DeviceDashboard({
  initialDevices,
  initialError,
}: {
  initialDevices: DashboardDevice[];
  initialError: string | null;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());

  const refresh = useCallback(async (force: boolean) => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/devices${force ? "?refresh=1" : ""}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "デバイスを取得できませんでした");
        return;
      }
      setDevices(body.devices);
      setError(null);
      setUpdatedAt(new Date());
    } catch {
      setError("通信に失敗しました");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // タブが表示されている間だけ定期更新。非表示から戻ったときにも更新する
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const updateDevice = useCallback((updated: DashboardDevice) => {
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        devices: devices.filter((d) => section.kinds.includes(d.kind)),
      })).filter((section) => section.devices.length > 0),
    [devices],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>
            最終更新 {updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {refreshing ? "更新中…" : "更新"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {!error && devices.length === 0 && (
        <p className="text-zinc-500">SwitchBot アカウントにデバイスが登録されていません。</p>
      )}

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">{section.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.devices.map((device) => (
              <DeviceTile key={device.id} device={device} onUpdate={updateDevice} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
