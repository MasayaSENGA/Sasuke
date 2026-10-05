import "server-only";
import { msSinceLastRecord, recordReading } from "@/lib/history";
import { cached, invalidate, patch } from "./cache";
import { SwitchBotApiError } from "./client";
import {
  needsStatus,
  toDashboardDevice,
  toDashboardRemote,
  type DashboardDevice,
} from "./devices";
import { getDevicePreferences } from "./preferences";
import type { DeviceCommand, DeviceStatus, Scene, SwitchBotApi } from "./types";

/** デバイス一覧はほぼ変わらないので長めにキャッシュ */
const DEVICE_LIST_TTL_MS = 10 * 60 * 1000;
/** ステータスのキャッシュ時間 */
const STATUS_TTL_MS = 60 * 1000;
/** 手動更新時でも、これより新しいステータスは再取得しない (連打対策) */
const FORCE_REFRESH_MIN_MS = 10 * 1000;
/** シーン一覧のキャッシュ時間 */
const SCENE_LIST_TTL_MS = 10 * 60 * 1000;

const listKey = (userId: string) => `${userId}:devices`;
const scenesKey = (userId: string) => `${userId}:scenes`;
const statusKey = (userId: string, deviceId: string) => `${userId}:status:${deviceId}`;

function errorMessage(error: unknown): string {
  return error instanceof SwitchBotApiError ? error.message : "ステータスを取得できませんでした";
}

async function getDeviceList(userId: string, client: SwitchBotApi): Promise<DashboardDevice[]> {
  return cached(listKey(userId), DEVICE_LIST_TTL_MS, async () => {
    const { deviceList, infraredRemoteList } = await client.getDevices();
    return [...deviceList.map(toDashboardDevice), ...infraredRemoteList.map(toDashboardRemote)];
  });
}

function getStatus(userId: string, client: SwitchBotApi, deviceId: string, force: boolean) {
  const ttl = force ? FORCE_REFRESH_MIN_MS : STATUS_TTL_MS;
  return cached<DeviceStatus>(statusKey(userId, deviceId), ttl, () => client.getDeviceStatus(deviceId));
}

/** 温湿度計なら履歴に記録する (失敗してもダッシュボードの表示は止めない) */
function maybeRecord(userId: string, device: DashboardDevice, status: Partial<DeviceStatus>) {
  if (device.kind !== "climate") return;
  recordReading(userId, device.id, status).catch((error) => {
    console.error("温湿度の記録に失敗しました", error);
  });
}

async function withStatus(
  userId: string,
  client: SwitchBotApi,
  device: DashboardDevice,
  force: boolean,
): Promise<DashboardDevice> {
  if (!needsStatus(device)) return device;
  try {
    const status = await getStatus(userId, client, device.id, force);
    maybeRecord(userId, device, status);
    return { ...device, status };
  } catch (error) {
    return { ...device, statusError: errorMessage(error) };
  }
}

/**
 * ダッシュボード用に全デバイスとステータスを取得する。
 * ユーザーの並び順を反映し、非表示のデバイスはステータスを取得しない (API 回数の節約)。
 */
export async function loadDashboard(
  userId: string,
  client: SwitchBotApi,
  { force = false } = {},
): Promise<DashboardDevice[]> {
  const [devices, preferences] = await Promise.all([
    getDeviceList(userId, client),
    getDevicePreferences(userId),
  ]);

  // 並び順が未設定のデバイス (新しく追加したものなど) は末尾に API の順で並べる
  const sorted = devices
    .map((device, index) => {
      const preference = preferences.get(device.id);
      return {
        device: { ...device, hidden: preference?.hidden ?? false },
        order: preference?.sortOrder ?? preferences.size + index,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ device }) => device);

  return Promise.all(sorted.map((device) => withStatus(userId, client, device, force)));
}

/** ユーザーのデバイス一覧から探す (ステータスは取得しない)。見つからなければ null */
export async function findDevice(
  userId: string,
  client: SwitchBotApi,
  deviceId: string,
): Promise<DashboardDevice | null> {
  return (await getDeviceList(userId, client)).find((d) => d.id === deviceId) ?? null;
}

/** 単一デバイスを (必要ならステータス付きで) 取得する。ユーザーのデバイスでなければ null */
export async function loadDevice(
  userId: string,
  client: SwitchBotApi,
  deviceId: string,
  { force = false } = {},
): Promise<DashboardDevice | null> {
  const device = await findDevice(userId, client, deviceId);
  if (!device) return null;
  return withStatus(userId, client, device, force);
}

export async function sendDeviceCommand(
  userId: string,
  client: SwitchBotApi,
  deviceId: string,
  command: DeviceCommand,
) {
  await client.sendCommand(deviceId, command);
  invalidate(statusKey(userId, deviceId));
}

// ---- シーン ----

export function getScenes(userId: string, client: SwitchBotApi): Promise<Scene[]> {
  return cached(scenesKey(userId), SCENE_LIST_TTL_MS, () => client.getScenes());
}

/** シーンを実行する。ユーザーのシーンでなければ false */
export async function executeScene(userId: string, client: SwitchBotApi, sceneId: string) {
  const scenes = await getScenes(userId, client);
  if (!scenes.some((scene) => scene.sceneId === sceneId)) return false;
  await client.executeScene(sceneId);
  return true;
}

// ---- Webhook / 履歴の定期収集 ----

/** MAC アドレスの表記ゆれ (区切り文字・大文字小文字) を吸収して deviceId と照合する */
const normalizeId = (id: string) => id.replace(/[^0-9a-z]/gi, "").toUpperCase();

/**
 * Webhook で届いた状態変化を反映する。
 * キャッシュ済みのステータスを更新し (次の画面更新で API を呼ばずに済む)、温湿度計なら記録する。
 * 該当デバイスが無ければ null。
 */
export async function applyDeviceUpdate(
  userId: string,
  client: SwitchBotApi,
  deviceMac: string,
  update: Partial<DeviceStatus>,
): Promise<DashboardDevice | null> {
  const target = normalizeId(deviceMac);
  const device = (await getDeviceList(userId, client)).find(
    (d) => !d.isInfrared && normalizeId(d.id) === target,
  );
  if (!device) return null;

  patch<DeviceStatus>(statusKey(userId, device.id), update);
  maybeRecord(userId, device, update);
  return device;
}

/**
 * 温湿度計の値を定期的に記録する (バックグラウンドジョブから呼ぶ)。
 * Webhook やダッシュボード表示で最近記録済みのデバイスは API を呼ばない。
 */
export async function collectClimateReadings(
  userId: string,
  client: SwitchBotApi,
  minIntervalMs: number,
) {
  const [devices, preferences] = await Promise.all([
    getDeviceList(userId, client),
    getDevicePreferences(userId),
  ]);
  const targets = devices.filter(
    (d) =>
      d.kind === "climate" &&
      !preferences.get(d.id)?.hidden &&
      needsStatus(d) &&
      msSinceLastRecord(userId, d.id) >= minIntervalMs,
  );
  for (const device of targets) {
    try {
      const status = await getStatus(userId, client, device.id, false);
      await recordReading(userId, device.id, status);
    } catch (error) {
      console.error(`温湿度の取得に失敗しました (${device.name})`, error);
    }
  }
}
