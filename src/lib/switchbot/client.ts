import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type {
  DeviceCommand,
  DeviceList,
  DeviceStatus,
  Scene,
  SwitchBotApi,
  SwitchBotResponse,
} from "./types";

const BASE_URL = "https://api.switch-bot.com/v1.1";

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "トークンまたはシークレットが正しくありません",
  403: "トークンまたはシークレットが正しくありません",
  429: "SwitchBot API の 1 日あたりの呼び出し上限に達しました",
};

const STATUS_ERROR_MESSAGES: Record<number, string> = {
  151: "このデバイスでは使えない操作です",
  152: "デバイスが見つかりません",
  160: "このデバイスでは使えない操作です",
  161: "デバイスがオフラインです",
  171: "ハブがオフラインです",
  190: "デバイス側でエラーが発生しました",
};

export class SwitchBotApiError extends Error {
  constructor(
    message: string,
    /** HTTP ステータス、または SwitchBot の statusCode */
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "SwitchBotApiError";
  }

  get isAuthError() {
    return this.statusCode === 401 || this.statusCode === 403;
  }
}

/**
 * SwitchBot Open API v1.1 クライアント。
 * トークン/シークレットはサーバー側でのみ扱い、ブラウザには渡さない。
 * API 呼び出しは 1 アカウントあたり 1 日 10,000 回までなので、ポーリング間隔に注意すること。
 */
export class SwitchBotClient implements SwitchBotApi {
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
      throw new SwitchBotApiError(
        HTTP_ERROR_MESSAGES[res.status] ?? `SwitchBot API エラー (HTTP ${res.status})`,
        res.status,
      );
    }

    const json = (await res.json()) as SwitchBotResponse<T>;
    if (json.statusCode !== 100) {
      throw new SwitchBotApiError(
        STATUS_ERROR_MESSAGES[json.statusCode] ?? `SwitchBot API エラー: ${json.message} (${json.statusCode})`,
        json.statusCode,
      );
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

  getScenes(): Promise<Scene[]> {
    return this.request<Scene[]>("/scenes");
  }

  executeScene(sceneId: string): Promise<unknown> {
    return this.request(`/scenes/${encodeURIComponent(sceneId)}/execute`, { method: "POST" });
  }

  async getWebhookUrls(): Promise<string[]> {
    try {
      const body = await this.request<{ urls?: string[] }>("/webhook/queryWebhook", {
        method: "POST",
        body: JSON.stringify({ action: "queryUrl" }),
      });
      return body.urls ?? [];
    } catch (error) {
      // 未設定の場合はエラーが返るので、空として扱う (認証エラーは呼び出し元へ)
      if (error instanceof SwitchBotApiError && !error.isAuthError && error.statusCode !== 429) {
        return [];
      }
      throw error;
    }
  }

  setupWebhook(url: string): Promise<unknown> {
    return this.request("/webhook/setupWebhook", {
      method: "POST",
      body: JSON.stringify({ action: "setupWebhook", url, deviceList: "ALL" }),
    });
  }

  deleteWebhook(url: string): Promise<unknown> {
    return this.request("/webhook/deleteWebhook", {
      method: "POST",
      body: JSON.stringify({ action: "deleteWebhook", url }),
    });
  }

}
