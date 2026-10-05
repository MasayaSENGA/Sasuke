"use client";

import { useEffect, useState } from "react";
import type { HistoryPoint, HistoryRange } from "@/lib/history";
import { LineChart, type SeriesPoint } from "./line-chart";

type ClimateDevice = { id: string; name: string };

const RANGES: { value: HistoryRange; label: string; durationMs: number; gapMs: number }[] = [
  { value: "24h", label: "24時間", durationMs: 24 * 3600_000, gapMs: 30 * 60_000 },
  { value: "7d", label: "7日間", durationMs: 7 * 24 * 3600_000, gapMs: 3 * 3600_000 },
  { value: "30d", label: "30日間", durationMs: 30 * 24 * 3600_000, gapMs: 12 * 3600_000 },
];

const METRICS = [
  { key: "temperature", title: "温度", unit: "℃", color: "var(--series-temperature)", digits: 1 },
  { key: "humidity", title: "湿度", unit: "%", color: "var(--series-humidity)", digits: 0 },
  { key: "co2", title: "CO₂", unit: " ppm", color: "var(--series-co2)", digits: 0 },
] as const;

const timeFormat = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});
const hourFormat = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
const dayFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });

export function HistoryView({ devices, initialDeviceId }: { devices: ClimateDevice[]; initialDeviceId: string }) {
  const [deviceId, setDeviceId] = useState(initialDeviceId);
  const [range, setRange] = useState<HistoryRange>("24h");
  const [data, setData] = useState<{ points: HistoryPoint[]; fetchedAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history?deviceId=${encodeURIComponent(deviceId)}&range=${range}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? "履歴を取得できませんでした");
        setData({ points: body.points, fetchedAt: Date.now() });
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, range]);

  const rangeInfo = RANGES.find((r) => r.value === range)!;
  const end = data?.fetchedAt ?? 0;
  const domain: [number, number] = [end - rangeInfo.durationMs, end];
  const formatTick = (t: number) => (range === "24h" ? hourFormat.format(t) : dayFormat.format(t));
  const points = data?.points ?? [];

  const series = METRICS.map((metric) => ({
    ...metric,
    points: points
      .filter((p) => p[metric.key] !== null)
      .map((p): SeriesPoint => ({ t: p.t, v: p[metric.key] as number })),
  })).filter((s) => s.points.length > 0 || s.key !== "co2"); // CO₂ は対応機種のみ表示

  return (
    <div className="space-y-6">
      {/* 絞り込みはグラフの上に 1 行で */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={deviceId}
          onChange={(e) => {
            setDeviceId(e.target.value);
            setData(null);
          }}
          aria-label="デバイス"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div role="group" aria-label="期間" className="flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => {
                setRange(r.value);
                setData(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                range === r.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="ml-auto text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          {showTable ? "グラフで見る" : "表で見る"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">読み込み中…</p>}

      {data && points.length === 0 && (
        <p className="rounded-lg bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          この期間の記録はまだありません。温湿度は 10 分ごと (リアルタイム更新が有効なら変化のたび、最短 5 分間隔) に記録されます。
        </p>
      )}

      {data && points.length > 0 && !showTable && (
        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {series.map((s) => (
            <LineChart
              key={s.key}
              title={s.title}
              unit={s.unit}
              color={s.color}
              digits={s.digits}
              points={s.points}
              domain={domain}
              gapMs={rangeInfo.gapMs}
              hoverT={hoverT}
              onHover={setHoverT}
              formatTick={formatTick}
              formatTime={(t) => timeFormat.format(t)}
            />
          ))}
        </div>
      )}

      {data && points.length > 0 && showTable && (
        <div className="max-h-[32rem] overflow-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">日時</th>
                {series.map((s) => (
                  <th key={s.key} className="px-4 py-2 text-right font-medium">
                    {s.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.t} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-1.5 text-zinc-600 dark:text-zinc-400">{timeFormat.format(p.t)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-4 py-1.5 text-right">
                      {p[s.key] === null ? "—" : `${(p[s.key] as number).toFixed(s.digits)}${s.unit}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
