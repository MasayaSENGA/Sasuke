import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type {
  DeviceCommand,
  DeviceList,
  DeviceStatus,
  SwitchBotResponse,
} from "./types";

const BASE_URL = "https://api.switch-bot.com/v1.1";

export class SwitchBotApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "SwitchBotApiError";
  }
}

/**
 * SwitchBot Open API v1.1 クライアント。
 * トークン/シークレットはサーバー側でのみ扱い、ブラウザには渡さない。
 * API 呼び出しは 1 アカウントあたり 1 日 10,000 回までなので、ポーリング間隔に注意すること。
 */
export class SwitchBotClient {
  constructor(
    private readonly token: string,
    private readonly secret: string,
  ) {}

  /** 署名ヘッダーを生成する (sign = base64(HMAC-SHA256(secret, token + t + nonce))) */
  private buildHeaders(): HeadersInit {
    const t = Date.now().toString();
    const nonce = randomUUID();
    const sign = createHmac("sha256", this.secret)
      .update(this.token + t + nonce)
      .digest("base64");

    return {
      Authorization: this.token,
      sign,
      t,
      nonce,
      "Content-Type": "application/json; charset=utf8",
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: this.buildHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new SwitchBotApiError(`SwitchBot API HTTP ${res.status}`, res.status);
    }

    const json = (await res.json()) as SwitchBotResponse<T>;
    if (json.statusCode !== 100) {
      throw new SwitchBotApiError(json.message, json.statusCode);
    }
    return json.body;
  }

  getDevices(): Promise<DeviceList> {
    return this.request<DeviceList>("/devices");
  }

  getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    return this.request<DeviceStatus>(`/devices/${encodeURIComponent(deviceId)}/status`);
  }

  sendCommand(deviceId: string, command: DeviceCommand): Promise<unknown> {
    return this.request(`/devices/${encodeURIComponent(deviceId)}/commands`, {
      method: "POST",
      body: JSON.stringify({
        parameter: "default",
        commandType: "command",
        ...command,
      }),
    });
  }
}
