import "server-only";
import { prisma } from "@/lib/db";

export type DevicePreferenceInput = { deviceId: string; sortOrder: number; hidden: boolean };

export async function getDevicePreferences(userId: string) {
  const rows = await prisma.devicePreference.findMany({ where: { userId } });
  return new Map(rows.map((row) => [row.deviceId, row]));
}

/** 並び順・表示設定を丸ごと置き換える */
export async function saveDevicePreferences(userId: string, items: DevicePreferenceInput[]) {
  await prisma.$transaction([
    prisma.devicePreference.deleteMany({ where: { userId } }),
    prisma.devicePreference.createMany({ data: items.map((item) => ({ userId, ...item })) }),
  ]);
}
