// デバイス種別の分類と、ダッシュボード表示用のデータ型。
// サーバー/クライアントの両方から参照するため server-only にはしない。

import type { DeviceStatus, InfraredRemote, SwitchBotDevice } from "./types";

/** タイルの表示・操作パターン */
export type DeviceKind =
  | "climate" // 温湿度計・ハブ2/3 など (温度/湿度を表示)
  | "switch" // プラグ・リレースイッチ・加湿器・空気清浄機・扇風機など (電源 ON/OFF)
  | "bot" // ボット (押す / ON / OFF)
  | "light" // 照明 (電源 + 明るさ)
  | "curtain" // カーテン・ロールスクリーン・ブラインド
  | "lock" // スマートロック
  | "sensor" // 開閉センサー・人感センサー・水漏れセンサーなど (表示のみ)
  | "ir-ac" // 赤外線リモコン: エアコン
  | "ir" // 赤外線リモコン: その他家電 (ON/OFF)
  | "other"; // 表示のみ

export type DashboardDevice = {
  id: string;
  name: string;
  /** deviceType (物理デバイス) または remoteType (赤外線リモコン) */
  type: string;
  kind: DeviceKind;
  isInfrared: boolean;
  /** SwitchBot アプリでクラウドサービスが有効か (無効だとステータス取得・操作ができない) */
  cloudEnabled: boolean;
  status: DeviceStatus | null;
  statusError?: string;
  /** ダッシュボードで非表示にしているか (非表示のデバイスはステータスを取得しない) */
  hidden: boolean;
  /** 赤外線リモコンのみ: このアプリから最後に送った設定 (未操作なら null) */
  remoteState?: RemoteState | null;
};

/**
 * 赤外線リモコンでこのアプリから最後に送った設定。
 * 赤外線リモコンは状態を取得できないため、サーバーに保存してどの端末からでも同じ表示にする。
 */
export type RemoteState = {
  power?: "on" | "off";
  /** エアコンのみ: 設定温度 (℃) */
  temperature?: number;
  /** エアコンのみ: 1 自動 / 2 冷房 / 3 除湿 / 4 送風 / 5 暖房 */
  mode?: number;
  /** エアコンのみ: 1 自動 / 2 弱 / 3 中 / 4 強 */
  fanSpeed?: number;
  /** 最後に操作した日時 (ISO 8601) */
  updatedAt: string;
};

/** エアコンの設定温度の範囲 (SwitchBot の setAll が受け付ける範囲) */
export const AC_MIN_TEMP = 16;
export const AC_MAX_TEMP = 30;

const KIND_PATTERNS: [RegExp, DeviceKind][] = [
  [/meter|woiosensor|weather ?station|hub [23]|climate panel|thermostat/i, "climate"],
  [/lock/i, "lock"],
  [/curtain|roller shade|blind tilt/i, "curtain"],
  [/^bot$/i, "bot"],
  [/light|bulb|lamp/i, "light"],
  [/plug|relay switch|humidifier|purifier|fan/i, "switch"],
  [/contact|motion|presence|water detector/i, "sensor"],
];

/** ステータス API を持たないデバイス (呼んでも無駄に API 回数を消費するだけ) */
const NO_STATUS_PATTERN = /^(hub|hub plus|hub mini|remote)$|keypad|cam\b|cam$/i;

export function classifyPhysicalDevice(deviceType: string): DeviceKind {
  return KIND_PATTERNS.find(([pattern]) => pattern.test(deviceType))?.[1] ?? "other";
}

export function classifyInfraredRemote(remoteType: string): DeviceKind {
  if (remoteType === "Air Conditioner") return "ir-ac";
  // "Others" はユーザー定義ボタンのみで ON/OFF が使えない
  if (remoteType === "Others") return "other";
  return "ir";
}

/** ステータス取得 API を呼ぶ対象か (赤外線リモコン・クラウド無効・ステータス非対応は対象外) */
export function needsStatus(device: DashboardDevice): boolean {
  return (
    !device.hidden &&
    !device.isInfrared &&
    device.cloudEnabled &&
    !NO_STATUS_PATTERN.test(device.type)
  );
}

export function toDashboardDevice(device: SwitchBotDevice): DashboardDevice {
  return {
    id: device.deviceId,
    name: device.deviceName,
    type: device.deviceType,
    kind: classifyPhysicalDevice(device.deviceType),
    isInfrared: false,
    cloudEnabled: device.enableCloudService,
    status: null,
    hidden: false,
  };
}

export function toDashboardRemote(remote: InfraredRemote): DashboardDevice {
  return {
    id: remote.deviceId,
    name: remote.deviceName,
    type: remote.remoteType,
    kind: classifyInfraredRemote(remote.remoteType),
    isInfrared: true,
    cloudEnabled: true,
    status: null,
    hidden: false,
  };
}

/**
 * 電源状態を取り出す。デバイスによって表現がバラバラなので吸収する。
 * - power: "on" / "off" / "ON" / "OFF" (多くのデバイス)
 * - switchStatus: 0 / 1 (リレースイッチ。こちらの power は消費電力 W の数値)
 */
export function getPowerState(status: DeviceStatus | null): boolean | undefined {
  if (!status) return undefined;
  if (typeof status.power === "string") return status.power.toLowerCase() === "on";
  if (typeof status.switchStatus === "number") return status.switchStatus === 1;
  return undefined;
}
