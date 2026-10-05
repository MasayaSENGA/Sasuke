// SwitchBot Open API v1.1 の型定義
// https://github.com/OpenWonderLabs/SwitchBotAPI

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
  power?: "on" | "off";
  temperature?: number;
  humidity?: number;
  battery?: number;
  version?: string;
  [key: string]: unknown;
};

export type DeviceCommand = {
  command: string;
  parameter?: string | number | Record<string, unknown>;
  /** 通常は "command"。赤外線リモコンのカスタムボタンは "customize" */
  commandType?: "command" | "customize";
};
