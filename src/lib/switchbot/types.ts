// SwitchBot Open API v1.1 の型定義
// https://github.com/OpenWonderLabs/SwitchBotAPI (各デバイスの詳細は devices/ 配下)

export type SwitchBotResponse<T> = {
  /** 100 = 成功。それ以外はエラー */
  statusCode: number;
  message: string;
  body: T;
};

/** 物理デバイス (Bot, Plug, Meter, Curtain など) */
export type SwitchBotDevice = {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  enableCloudService: boolean;
  hubDeviceId: string;
};

/** ハブに登録された赤外線リモコン (エアコン, テレビ, 照明など) */
export type InfraredRemote = {
  deviceId: string;
  deviceName: string;
  remoteType: string;
  hubDeviceId: string;
};

export type DeviceList = {
  deviceList: SwitchBotDevice[];
  infraredRemoteList: InfraredRemote[];
};

/**
 * デバイスのステータス。項目はデバイス種別ごとに異なる。
 * 例: Meter → temperature / humidity / battery, Plug → power, Curtain → slidePosition
 */
export type DeviceStatus = {
  deviceId: string;
  deviceType: string;
  hubDeviceId: string;
  /** 多くのデバイスでは "on"/"off" (大文字の場合あり)。Relay Switch 1PM 等では消費電力 (W) */
  power?: string | number;
  /** Relay Switch の電源状態 (0: off, 1: on) */
  switchStatus?: number;
  temperature?: number;
  humidity?: number;
  CO2?: number;
  battery?: number;
  brightness?: number | string;
  slidePosition?: number | string;
  moving?: boolean;
  lockState?: string;
  doorState?: string;
  openState?: string;
  moveDetected?: boolean;
  deviceMode?: string;
  version?: string;
  [key: string]: unknown;
};

export type DeviceCommand = {
  command: string;
  parameter?: string | number | Record<string, unknown>;
  /** 通常は "command"。赤外線リモコンのカスタムボタンは "customize" */
  commandType?: "command" | "customize";
};

/** SwitchBotClient とモックで共通のインターフェース */
export interface SwitchBotApi {
  getDevices(): Promise<DeviceList>;
  getDeviceStatus(deviceId: string): Promise<DeviceStatus>;
  sendCommand(deviceId: string, command: DeviceCommand): Promise<unknown>;
}
