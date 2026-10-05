"use client";

import { useCallback, useEffect, useState } from "react";
import { saveLayoutAction } from "@/app/(app)/dashboard/actions";
import type { DashboardDevice, DeviceKind } from "@/lib/switchbot/devices";
import type { DeviceStatus, Scene } from "@/lib/switchbot/types";
import { DeviceTile } from "./device-tile";
import { EditableTile } from "./editable-tile";
import { SceneBar } from "./scene-bar";

/**
 * 自動更新の間隔。SwitchBot API は 1 日 10,000 回までで、1 回の更新でステータス対応デバイスの数だけ API を呼ぶ。
 * 例: 10 台 × 2 分間隔 × 24 時間 = 7,200 回 / 日 (タブが表示されている間だけ更新する)
 */
const POLL_INTERVAL_MS = 2 * 60 * 1000;
/** Webhook 有効時は変化がリアルタイムに届くので、定期取得は取りこぼし対策として間隔を空ける */
const REALTIME_POLL_INTERVAL_MS = 10 * 60 * 1000;

const SECTIONS: { title: string; kinds: DeviceKind[] }[] = [
  { title: "室内環境", kinds: ["climate"] },
  { title: "家電", kinds: ["switch", "bot", "light", "curtain", "lock", "ir-ac", "ir"] },
  { title: "センサー", kinds: ["sensor"] },
  { title: "その他", kinds: ["other"] },
];

const sectionOf = (device: DashboardDevice) =>
  SECTIONS.findIndex((section) => section.kinds.includes(device.kind));

export function DeviceDashboard({
  initialDevices,
  initialError,
  scenes,
  realtime,
}: {
  initialDevices: DashboardDevice[];
  initialError: string | null;
  scenes: Scene[];
  /** Webhook によるリアルタイム更新が有効か */
  realtime: boolean;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  /** 並び替え・表示設定モード中の編集内容 (null なら通常表示) */
  const [draft, setDraft] = useState<DashboardDevice[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);

  const editing = draft !== null;

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

  // タブが表示されている間だけ定期更新。非表示から戻ったときにも更新する。編集中は止める
  useEffect(() => {
    if (editing) return;
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh(false);
      },
      realtime ? REALTIME_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, editing, realtime]);

  // Webhook で届いた状態変化をサーバーから受け取る (Server-Sent Events)
  useEffect(() => {
    if (!realtime) return;
    const source = new EventSource("/api/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false); // 自動で再接続される
    source.addEventListener("device", (e) => {
      const { deviceId, status } = JSON.parse((e as MessageEvent<string>).data) as {
        deviceId: string;
        status: Partial<DeviceStatus>;
      };
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId && d.status ? { ...d, status: { ...d.status, ...status } } : d,
        ),
      );
      setUpdatedAt(new Date());
    });
    return () => source.close();
  }, [realtime]);

  // 操作後の再取得結果を反映する (並び順・表示設定はこちらの状態を優先)
  const updateDevice = useCallback((updated: DashboardDevice) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === updated.id ? { ...updated, hidden: d.hidden } : d)),
    );
  }, []);

  // 同じセクション内の隣のデバイスと入れ替える
  const move = (id: string, direction: -1 | 1) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const index = prev.findIndex((d) => d.id === id);
      const section = sectionOf(prev[index]);
      let target = index + direction;
      while (target >= 0 && target < prev.length && sectionOf(prev[target]) !== section) {
        target += direction;
      }
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleHidden = (id: string) => {
    setDraft((prev) => prev?.map((d) => (d.id === id ? { ...d, hidden: !d.hidden } : d)) ?? prev);
  };

  const saveLayout = async () => {
    if (!draft) return;
    setSaving(true);
    const result = await saveLayoutAction(draft.map((d) => ({ deviceId: d.id, hidden: d.hidden })));
    setSaving(false);
    if ("error" in result) {
      setError(result.error ?? "保存に失敗しました");
      return;
    }
    const unhidden = draft.some((d) => !d.hidden && devices.find((x) => x.id === d.id)?.hidden);
    setDevices(draft);
    setDraft(null);
    // 表示に戻したデバイスはステータス未取得なので取り直す
    if (unhidden) void refresh(false);
  };

  const shown = draft ?? devices.filter((d) => !d.hidden);
  const hiddenCount = devices.filter((d) => d.hidden).length;

  const sections = SECTIONS.map((section) => ({
    ...section,
    devices: shown.filter((d) => section.kinds.includes(d.kind)),
  })).filter((section) => section.devices.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{editing ? "並び替え・表示設定" : "ダッシュボード"}</h1>
        {editing ? (
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={saveLayout}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "保存中…" : "完了"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm whitespace-nowrap text-zinc-500">
            {realtime && (
              <span
                className="flex items-center gap-1.5"
                title={connected ? "状態の変化がすぐ反映されます" : "再接続しています"}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`}
                />
                {connected ? "リアルタイム" : "再接続中"}
              </span>
            )}
            <span className="mr-1">
              <span className="hidden sm:inline">最終更新 </span>
              {updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              type="button"
              onClick={() => setDraft(devices)}
              disabled={devices.length === 0}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              並び替え
            </button>
            <button
              type="button"
              onClick={() => refresh(true)}
              disabled={refreshing}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {refreshing ? "更新中…" : "更新"}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <p className="text-sm text-zinc-500">
          矢印で同じグループ内の順番を入れ替えられます。非表示にしたデバイスはステータスを取得しないため、API 回数の節約にもなります。
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {!editing && <SceneBar scenes={scenes} />}

      {!error && devices.length === 0 && (
        <p className="text-zinc-500">SwitchBot アカウントにデバイスが登録されていません。</p>
      )}

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">{section.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.devices.map((device, i) =>
              editing ? (
                <EditableTile
                  key={device.id}
                  device={device}
                  isFirst={i === 0}
                  isLast={i === section.devices.length - 1}
                  onMove={(direction) => move(device.id, direction)}
                  onToggleHidden={() => toggleHidden(device.id)}
                />
              ) : (
                <DeviceTile key={device.id} device={device} onUpdate={updateDevice} />
              ),
            )}
          </div>
        </section>
      ))}

      {!editing && hiddenCount > 0 && (
        <p className="text-center text-xs text-zinc-500">
          {hiddenCount} 台のデバイスを非表示にしています (「並び替え」から再表示できます)
        </p>
      )}
    </div>
  );
}
