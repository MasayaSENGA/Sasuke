import "server-only";
import type { DeviceCommand, DeviceList, DeviceStatus, SwitchBotApi } from "./types";

// 開発用のモック (SWITCHBOT_MOCK=true のとき使用)。
// 実機や API 回数を気にせずダッシュボードの UI を確認するためのもの。

const DEVICE_LIST: DeviceList = {
  deviceList: [
    { deviceId: "MOCK-METER", deviceName: "リビング温湿度計", deviceType: "MeterPro(CO2)", enableCloudService: true, hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-OUTDOOR", deviceName: "屋外温湿度計", deviceType: "WoIOSensor", enableCloudService: true, hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-HUB", deviceName: "ハブ2", deviceType: "Hub 2", enableCloudService: true, hubDeviceId: "000000000000" },
    { deviceId: "MOCK-PLUG", deviceName: "電気ケトル", deviceType: "Plug Mini (JP)", enableCloudService: true, hubDeviceId: "000000000000" },
    { deviceId: "MOCK-BOT", deviceName: "給湯器ボタン", deviceType: "Bot", enableCloudService: true, hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-LIGHT", deviceName: "寝室シーリング", deviceType: "Ceiling Light", enableCloudService: true, hubDeviceId: "000000000000" },
    { deviceId: "MOCK-CURTAIN", deviceName: "リビングカーテン", deviceType: "Curtain3", enableCloudService: true, hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-LOCK", deviceName: "玄関ロック", deviceType: "Smart Lock Pro", enableCloudService: true, hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-CONTACT", deviceName: "窓の開閉センサー", deviceType: "Contact Sensor", enableCloudService: true, hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-OFFLINE", deviceName: "クラウド無効のボット", deviceType: "Bot", enableCloudService: false, hubDeviceId: "MOCK-HUB" },
  ],
  infraredRemoteList: [
    { deviceId: "MOCK-IR-AC", deviceName: "リビングエアコン", remoteType: "Air Conditioner", hubDeviceId: "MOCK-HUB" },
    { deviceId: "MOCK-IR-TV", deviceName: "テレビ", remoteType: "TV", hubDeviceId: "MOCK-HUB" },
  ],
};

type MockState = Record<string, Record<string, unknown>>;

const globalForMock = globalThis as unknown as { switchBotMockState?: MockState };

const state: MockState = (globalForMock.switchBotMockState ??= {
  "MOCK-METER": { temperature: 24.3, humidity: 52, CO2: 820, battery: 100 },
  "MOCK-OUTDOOR": { temperature: 17.8, humidity: 71, battery: 60 },
  "MOCK-HUB": { temperature: 24.1, humidity: 50, lightLevel: 12 },
  "MOCK-PLUG": { power: "off", voltage: 100.4, weight: 0, electricCurrent: 0 },
  "MOCK-BOT": { power: "off", battery: 100, deviceMode: "pressMode" },
  "MOCK-LIGHT": { power: "on", brightness: 80, colorTemperature: 4000 },
  "MOCK-CURTAIN": { slidePosition: 0, moving: false, battery: 80, calibrate: true },
  "MOCK-LOCK": { lockState: "locked", doorState: "closed", battery: 90 },
  "MOCK-CONTACT": { openState: "close", moveDetected: false, brightness: "bright", battery: 100 },
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockSwitchBotClient implements SwitchBotApi {
  async getDevices(): Promise<DeviceList> {
    await delay(150);
    return DEVICE_LIST;
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    await delay(100);
    const device = DEVICE_LIST.deviceList.find((d) => d.deviceId === deviceId);
    return {
      deviceId,
      deviceType: device?.deviceType ?? "Unknown",
      hubDeviceId: device?.hubDeviceId ?? "",
      ...state[deviceId],
    };
  }

  async sendCommand(deviceId: string, { command, parameter }: DeviceCommand): Promise<unknown> {
    await delay(200);
    const s = (state[deviceId] ??= {});
    switch (command) {
      case "turnOn":
        if ("slidePosition" in s) s.slidePosition = 0;
        else s.power = "on";
        break;
      case "turnOff":
        if ("slidePosition" in s) s.slidePosition = 100;
        else s.power = "off";
        break;
      case "setBrightness":
        s.brightness = Number(parameter);
        break;
      case "lock":
        s.lockState = "locked";
        break;
      case "unlock":
        s.lockState = "unlocked";
        break;
    }
    if (deviceId === "MOCK-PLUG") s.weight = s.power === "on" ? 1200 : 0;
    return {};
  }
}
