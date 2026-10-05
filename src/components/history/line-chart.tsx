"use client";

import { useEffect, useRef, useState } from "react";

// 1 系列だけの折れ線グラフ (SVG)。
// 温度と湿度は単位が違うので 1 つのグラフに重ねず (二重軸にしない)、
// 同じ時間軸のグラフを縦に並べて、ホバー位置 (hoverT) を共有する。

export type SeriesPoint = { t: number; v: number };

type Props = {
  title: string;
  unit: string;
  /** CSS 変数などの色 */
  color: string;
  points: SeriesPoint[];
  /** 表示する時間範囲 [開始, 終了] (UNIX ミリ秒) */
  domain: [number, number];
  /** この間隔より離れた点は線をつながない (記録の欠け) */
  gapMs: number;
  digits: number;
  hoverT: number | null;
  onHover: (t: number | null) => void;
  formatTick: (t: number) => string;
  formatTime: (t: number) => string;
};

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

export function LineChart(props: Props) {
  const { title, unit, color, points, domain, gapMs, digits, hoverT, onHover, formatTick, formatTime } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const [t0, t1] = domain;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW;

  const yTicks = niceTicks(
    points.map((p) => p.v),
    digits === 0,
  );
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  // 記録が途切れた所で線を分ける
  const segments: SeriesPoint[][] = [];
  for (const p of points) {
    const current = segments[segments.length - 1];
    const prev = current?.[current.length - 1];
    if (!current || !prev || p.t - prev.t > gapMs) segments.push([p]);
    else current.push(p);
  }

  const hovered = hoverT === null ? null : nearest(points, hoverT);
  const latest = points[points.length - 1];
  const readout = hovered ?? latest;
  const xTicks = timeTicks(t0, t1);

  const handlePointer = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = t0 + ((clientX - rect.left - PAD.left) / innerW) * (t1 - t0);
    onHover(Math.min(t1, Math.max(t0, t)));
  };

  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
        {readout ? (
          <span className="text-sm text-zinc-500">
            <strong className="mr-1 text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {readout.v.toFixed(digits)}
              {unit}
            </strong>
            {hovered ? formatTime(hovered.t) : "最新"}
          </span>
        ) : (
          <span className="text-sm text-zinc-500">記録なし</span>
        )}
      </figcaption>

      <div
        ref={containerRef}
        className="relative touch-pan-y"
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerLeave={() => onHover(null)}
      >
        <svg width={width} height={HEIGHT} role="img" aria-label={`${title}の推移`} className="block overflow-visible">
          {/* 目盛り線は控えめに */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-500 text-[11px] tabular-nums"
              >
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={HEIGHT - 6}
              textAnchor="middle"
              className="fill-zinc-500 text-[11px] tabular-nums"
            >
              {formatTick(tick)}
            </text>
          ))}

          {segments.map((segment) =>
            segment.length === 1 ? (
              <circle key={segment[0].t} cx={x(segment[0].t)} cy={y(segment[0].v)} r={2} fill={color} />
            ) : (
              <path
                key={segment[0].t}
                d={segment.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("")}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ),
          )}

          {hovered && (
            <g>
              <line
                x1={x(hovered.t)}
                x2={x(hovered.t)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="stroke-zinc-400 dark:stroke-zinc-500"
                strokeWidth={1}
              />
              <circle
                cx={x(hovered.t)}
                cy={y(hovered.v)}
                r={4}
                fill={color}
                className="stroke-white dark:stroke-zinc-900"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      </div>
    </figure>
  );
}

/** ホバー位置に最も近い点 */
function nearest(points: SeriesPoint[], t: number): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const p of points) {
    if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
  }
  return best;
}

/** 区切りのよい縦軸の目盛り (4〜6 本)。integer なら整数の目盛りだけにする */
function niceTicks(values: number[], integer: boolean): number[] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rough = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(
    integer ? 1 : 0,
    [1, 2, 2.5, 5, 10]
      .map((m) => m * magnitude)
      .filter((s) => !integer || Number.isInteger(s))
      .find((s) => s >= rough) ?? 10 * magnitude,
  );
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 1000) / 1000);
  return ticks;
}

/** 横軸 (時刻) の目盛り。期間に応じて 6 時間 / 1 日 / 1 週間ごと (日本時間の区切り) */
function timeTicks(t0: number, t1: number): number[] {
  const hour = 60 * 60 * 1000;
  const span = t1 - t0;
  const step = span <= 2 * 24 * hour ? 6 * hour : span <= 10 * 24 * hour ? 24 * hour : 7 * 24 * hour;
  const offset = 9 * hour; // JST
  const ticks: number[] = [];
  for (let t = Math.ceil((t0 + offset) / step) * step - offset; t <= t1; t += step) ticks.push(t);
  return ticks;
}
