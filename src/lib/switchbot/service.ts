import "server-only";
import { cached, invalidate } from "./cache";
import { SwitchBotApiError } from "./client";
import {
  needsStatus,
  toDashboardDevice,
  toDashboardRemote,
  type DashboardDevice,
} from "./devices";
import type { DeviceCommand, DeviceStatus, SwitchBotApi } from "./types";

/** デバイス一覧はほぼ変わらないので長めにキャッシュ */
const DEVICE_LIST_TTL_MS = 10 * 60 * 1000;
/** ステータスのキャッシュ時間 */
const STATUS_TTL_MS = 60 * 1000;
/** 手動更新時でも、これより新しいステータスは再取得しない (連打対策) */
const FORCE_REFRESH_MIN_MS = 10 * 1000;

const listKey = (userId: string) => `${userId}:devices`;
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

async function withStatus(
  userId: string,
  client: SwitchBotApi,
  device: DashboardDevice,
  force: boolean,
): Promise<DashboardDevice> {
  if (!needsStatus(device)) return device;
  try {
    return { ...device, status: await getStatus(userId, client, device.id, force) };
  } catch (error) {
    return { ...device, statusError: errorMessage(error) };
  }
}

/** ダッシュボード用に全デバイスとステータスを取得する */
export async function loadDashboard(
  userId: string,
  client: SwitchBotApi,
  { force = false } = {},
): Promise<DashboardDevice[]> {
  const devices = await getDeviceList(userId, client);
  return Promise.all(devices.map((device) => withStatus(userId, client, device, force)));
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
