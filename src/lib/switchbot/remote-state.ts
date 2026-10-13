import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AC_MAX_TEMP, AC_MIN_TEMP, type RemoteState } from "./devices";
import type { DeviceCommand } from "./types";

// 赤外線リモコンでこのアプリから最後に送った設定の保存・読み出し。
// 赤外線リモコンは SwitchBot から状態を取得できないので、送ったコマンドから状態を推定して保存する。

/** エアコンの設定 (電源 OFF 中に変えた温度などを、送信せずに保存するときにも使う) */
export const acSettingsSchema = z
  .object({
    power: z.enum(["on", "off"]),
    temperature: z.number().int().min(AC_MIN_TEMP).max(AC_MAX_TEMP),
    mode: z.number().int().min(1).max(5),
    fanSpeed: z.number().int().min(1).max(4),
  })
  .partial();

export type RemoteStatePatch = z.infer<typeof acSettingsSchema>;

type Row = {
  power: string | null;
  temperature: number | null;
  mode: number | null;
  fanSpeed: number | null;
  updatedAt: Date;
};

function toRemoteState(row: Row): RemoteState {
  return {
    ...(row.power === "on" || row.power === "off" ? { power: row.power } : {}),
    ...(row.temperature !== null ? { temperature: row.temperature } : {}),
    ...(row.mode !== null ? { mode: row.mode } : {}),
    ...(row.fanSpeed !== null ? { fanSpeed: row.fanSpeed } : {}),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** ユーザーの全リモコンの保存済み設定 (deviceId → 設定) */
export async function getRemoteStates(userId: string): Promise<Map<string, RemoteState>> {
  const rows = await prisma.remoteState.findMany({ where: { userId } });
  return new Map(rows.map((row) => [row.deviceId, toRemoteState(row)]));
}

export async function getRemoteState(userId: string, deviceId: string): Promise<RemoteState | null> {
  const row = await prisma.remoteState.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
  return row ? toRemoteState(row) : null;
}

/** 設定を部分的に更新し、更新後の設定を返す */
export async function saveRemoteState(
  userId: string,
  deviceId: string,
  patch: RemoteStatePatch,
): Promise<RemoteState> {
  const row = await prisma.remoteState.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    create: { userId, deviceId, ...patch },
    update: patch,
  });
  return toRemoteState(row);
}

/**
 * 送ったコマンドから、保存すべき設定を求める。状態が変わらないコマンド (音量など) は null。
 * エアコンの setAll のパラメータは "{温度},{モード},{風量},{電源}" (例: "26,2,1,on")
 */
export function remoteStateFromCommand({ command, parameter }: DeviceCommand): RemoteStatePatch | null {
  switch (command) {
    case "turnOn":
      return { power: "on" };
    case "turnOff":
      return { power: "off" };
    case "setAll": {
      if (typeof parameter !== "string") return null;
      const [temperature, mode, fanSpeed, power] = parameter.split(",");
      const parsed = acSettingsSchema.safeParse({
        temperature: Number(temperature),
        mode: Number(mode),
        fanSpeed: Number(fanSpeed),
        power,
      });
      return parsed.success ? parsed.data : null;
    }
    default:
      return null;
  }
}
