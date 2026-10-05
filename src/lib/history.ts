import "server-only";
import { prisma } from "@/lib/db";
import type { DeviceStatus } from "@/lib/switchbot/types";

// 温湿度計の履歴の記録・取得

/** 同じデバイスの記録はこの間隔より細かくしない (Webhook は頻繁に届くため) */
const RECORD_MIN_INTERVAL_MS = 5 * 60 * 1000;
/** これより古い記録は削除する */
export const RETENTION_DAYS = 90;

export const HISTORY_RANGES = {
  "24h": { durationMs: 24 * 60 * 60 * 1000, bucketMs: 0 }, // 間引かない (5 分ごと)
  "7d": { durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
  "30d": { durationMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000 },
} as const;

export type HistoryRange = keyof typeof HISTORY_RANGES;

export type HistoryPoint = {
  /** UNIX ミリ秒 */
  t: number;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
};

const globalForHistory = globalThis as unknown as { lastRecordedAt?: Map<string, number> };
const lastRecordedAt: Map<string, number> = (globalForHistory.lastRecordedAt ??= new Map());

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** 最後の記録からの経過時間 (未記録なら Infinity) */
export function msSinceLastRecord(userId: string, deviceId: string): number {
  const last = lastRecordedAt.get(`${userId}:${deviceId}`);
  return last === undefined ? Infinity : Date.now() - last;
}

/** 温湿度を記録する。前回の記録から間もない場合は何もしない */
export async function recordReading(
  userId: string,
  deviceId: string,
  status: Partial<DeviceStatus>,
): Promise<void> {
  const temperature = num(status.temperature);
  const humidity = num(status.humidity);
  if (temperature === null && humidity === null) return;
  if (msSinceLastRecord(userId, deviceId) < RECORD_MIN_INTERVAL_MS) return;

  lastRecordedAt.set(`${userId}:${deviceId}`, Date.now());
  const co2 = num(status.CO2);
  await prisma.sensorReading.create({
    data: { userId, deviceId, temperature, humidity, co2: co2 === null ? null : Math.round(co2) },
  });
}

export async function pruneOldReadings(): Promise<number> {
  const before = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.sensorReading.deleteMany({ where: { recordedAt: { lt: before } } });
  return count;
}

/** 指定期間の履歴を取得する。期間が長い場合は一定間隔の平均に間引く */
export async function getHistory(
  userId: string,
  deviceId: string,
  range: HistoryRange,
): Promise<HistoryPoint[]> {
  const { durationMs, bucketMs } = HISTORY_RANGES[range];
  const rows = await prisma.sensorReading.findMany({
    where: { userId, deviceId, recordedAt: { gte: new Date(Date.now() - durationMs) } },
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true, temperature: true, humidity: true, co2: true },
  });

  const points = rows.map((r) => ({
    t: r.recordedAt.getTime(),
    temperature: r.temperature,
    humidity: r.humidity,
    co2: r.co2,
  }));
  if (bucketMs === 0) return points;

  const buckets = new Map<number, HistoryPoint[]>();
  for (const p of points) {
    const key = Math.floor(p.t / bucketMs) * bucketMs;
    const group = buckets.get(key);
    if (group) group.push(p);
    else buckets.set(key, [p]);
  }
  const avg = (values: (number | null)[], digits: number) => {
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    const factor = 10 ** digits;
    return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * factor) / factor;
  };
  return [...buckets.entries()].map(([t, group]) => ({
    t: t + bucketMs / 2,
    temperature: avg(group.map((p) => p.temperature), 1),
    humidity: avg(group.map((p) => p.humidity), 0),
    co2: avg(group.map((p) => p.co2), 0),
  }));
}
