import "server-only";
import { EventEmitter } from "node:events";
import type { DeviceStatus } from "./types";

// Webhook で受け取った状態変化を、開いているダッシュボード (SSE 接続) へ配信する。
// ※ プロセス内のイベントなので、複数インスタンス構成にする場合は Redis Pub/Sub 等へ置き換えること。

export type DeviceUpdateEvent = {
  type: "device";
  deviceId: string;
  status: Partial<DeviceStatus>;
};

const globalForEvents = globalThis as unknown as { switchBotEvents?: EventEmitter };

const bus: EventEmitter = (globalForEvents.switchBotEvents ??= new EventEmitter().setMaxListeners(0));

export function publish(userId: string, event: DeviceUpdateEvent) {
  bus.emit(userId, event);
}

/** 購読を開始し、解除用の関数を返す */
export function subscribe(userId: string, listener: (event: DeviceUpdateEvent) => void) {
  bus.on(userId, listener);
  return () => {
    bus.off(userId, listener);
  };
}
