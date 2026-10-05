"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { getPowerState, type DashboardDevice, type DeviceKind } from "@/lib/switchbot/devices";
import type { DeviceStatus } from "@/lib/switchbot/types";
import { ActionButton } from "./action-button";
import { AirConditionerControls } from "./air-conditioner-controls";
import { useDeviceCommand, type SendCommand } from "./use-device-command";

export const ICONS: Record<DeviceKind, string> = {
  climate: "🌡️",
  switch: "🔌",
  bot: "🤖",
  light: "💡",
  curtain: "🪟",
  lock: "🔒",
  sensor: "📡",
  "ir-ac": "❄️",
  ir: "📺",
  other: "📦",
};

type TileProps = { device: DashboardDevice; onUpdate: (device: DashboardDevice) => void };

export function DeviceTile({ device, onUpdate }: TileProps) {
  const { send, pending, error } = useDeviceCommand(device, onUpdate);
  const power = getPowerState(device.status);
  const canControl = device.cloudEnabled && !device.statusError;

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-zinc-900 ${
        power ? "border-amber-300 dark:border-amber-700" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">
            <span className="mr-1.5" aria-hidden>
              {ICONS[device.kind]}
            </span>
            {device.name}
          </h3>
          <p className="text-xs text-zinc-500">
            {device.type}
            {device.isInfrared && " (赤外線)"}
          </p>
        </div>
        {power !== undefined && canControl && device.kind !== "bot" && (
          <PowerToggle on={power} disabled={pending} send={send} />
        )}
      </header>

      {!device.cloudEnabled ? (
        <Notice>SwitchBot アプリでクラウドサービスを有効にすると操作できます</Notice>
      ) : device.statusError ? (
        <Notice>{device.statusError}</Notice>
      ) : (
        <TileBody device={device} send={send} pending={pending} />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {(typeof device.status?.battery === "number" || device.kind === "climate") && (
        <footer className="mt-auto flex items-center justify-between text-xs text-zinc-500">
          <span>{typeof device.status?.battery === "number" && `🔋 ${device.status.battery}%`}</span>
          {device.kind === "climate" && (
            <Link href={`/history?device=${encodeURIComponent(device.id)}`} className="hover:underline">
              履歴を見る →
            </Link>
          )}
        </footer>
      )}
    </article>
  );
}

function TileBody({
  device,
  send,
  pending,
}: {
  device: DashboardDevice;
  send: SendCommand;
  pending: boolean;
}) {
  const status = device.status;
  switch (device.kind) {
    case "climate":
      return <ClimateBody status={status} />;
    case "switch":
      return <SwitchBody status={status} send={send} pending={pending} />;
    case "bot":
      return <BotBody status={status} send={send} pending={pending} />;
    case "light":
      return <LightBody status={status} send={send} pending={pending} />;
    case "curtain":
      return <CurtainBody device={device} send={send} pending={pending} />;
    case "lock":
      return <LockBody device={device} send={send} pending={pending} />;
    case "sensor":
      return <SensorBody status={status} />;
    case "ir-ac":
      return <AirConditionerControls deviceId={device.id} send={send} pending={pending} />;
    case "ir":
      return <InfraredBody device={device} send={send} pending={pending} />;
    default:
      return <OtherBody status={status} />;
  }
}

// ---- 種別ごとの表示 ----

function ClimateBody({ status }: { status: DeviceStatus | null }) {
  if (!status) return <Notice>ステータスなし</Notice>;
  return (
    <div className="flex items-end gap-6">
      {typeof status.temperature === "number" && (
        <p className="text-4xl font-semibold tabular-nums">
          {status.temperature.toFixed(1)}
          <span className="ml-0.5 text-lg font-normal text-zinc-500">℃</span>
        </p>
      )}
      <dl className="space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
        {typeof status.humidity === "number" && <Stat label="湿度" value={`${status.humidity}%`} />}
        {typeof status.CO2 === "number" && <Stat label="CO₂" value={`${status.CO2} ppm`} />}
      </dl>
    </div>
  );
}

function SwitchBody({ status, send, pending }: { status: DeviceStatus | null; send: SendCommand; pending: boolean }) {
  if (!status) return null;
  // Plug Mini は weight、Relay Switch 1PM は power (数値) が消費電力 (W)
  const watts =
    typeof status.weight === "number"
      ? status.weight
      : typeof status.power === "number"
        ? status.power
        : undefined;
  return (
    <div className="space-y-3">
      <dl className="space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
        {watts !== undefined && <Stat label="消費電力" value={`${watts} W`} />}
        {typeof status.humidity === "number" && <Stat label="湿度" value={`${status.humidity}%`} />}
        {typeof status.temperature === "number" && <Stat label="温度" value={`${status.temperature}℃`} />}
      </dl>
      {/* 電源状態が取れない機種でも操作はできるようにする */}
      {getPowerState(status) === undefined && (
        <div className="flex gap-2">
          <ActionButton onClick={() => send({ command: "turnOn" })} disabled={pending}>ON</ActionButton>
          <ActionButton onClick={() => send({ command: "turnOff" })} disabled={pending}>OFF</ActionButton>
        </div>
      )}
    </div>
  );
}

function BotBody({ status, send, pending }: { status: DeviceStatus | null; send: SendCommand; pending: boolean }) {
  const isPressMode = status?.deviceMode === "pressMode";
  if (isPressMode) {
    return (
      <ActionButton onClick={() => send({ command: "press" })} disabled={pending}>
        押す
      </ActionButton>
    );
  }
  return (
    <div className="flex gap-2">
      <ActionButton onClick={() => send({ command: "turnOn" }, { power: "on" })} disabled={pending}>
        ON
      </ActionButton>
      <ActionButton onClick={() => send({ command: "turnOff" }, { power: "off" })} disabled={pending}>
        OFF
      </ActionButton>
    </div>
  );
}

function LightBody({ status, send, pending }: { status: DeviceStatus | null; send: SendCommand; pending: boolean }) {
  const current = typeof status?.brightness === "number" ? status.brightness : undefined;
  const [value, setValue] = useState<number | null>(null);
  if (current === undefined) return null;

  const shown = value ?? current;
  const commit = async () => {
    if (value === null || value === current) return;
    await send({ command: "setBrightness", parameter: value }, { brightness: value });
    setValue(null);
  };

  return (
    <label className="block space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
      <span>明るさ {shown}%</span>
      <input
        type="range"
        min={1}
        max={100}
        value={shown}
        disabled={pending}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-full accent-amber-500"
      />
    </label>
  );
}

function CurtainBody({ device, send, pending }: { device: DashboardDevice; send: SendCommand; pending: boolean }) {
  const raw = Number(device.status?.slidePosition);
  const isBlindTilt = /blind tilt/i.test(device.type);
  const isRollerShade = /roller shade/i.test(device.type);
  // カーテン/ロールスクリーンは 0 = 全開・100 = 全閉、ブラインドは 0 = 閉・100 = 開
  const openness = Number.isFinite(raw) ? (isBlindTilt ? raw : 100 - raw) : undefined;

  const open = isBlindTilt
    ? { command: "fullyOpen" }
    : isRollerShade
      ? { command: "setPosition", parameter: 0 }
      : { command: "turnOn" };
  const close = isBlindTilt
    ? { command: "closeDown" }
    : isRollerShade
      ? { command: "setPosition", parameter: 100 }
      : { command: "turnOff" };
  const canPause = !isBlindTilt && !isRollerShade;

  return (
    <div className="space-y-3">
      {openness !== undefined && (
        <div className="space-y-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            開度 {openness}%{device.status?.moving ? " (動作中)" : ""}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-sky-500" style={{ width: `${openness}%` }} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <ActionButton onClick={() => send(open)} disabled={pending}>
          開ける
        </ActionButton>
        {canPause && (
          <ActionButton onClick={() => send({ command: "pause" })} disabled={pending}>
            停止
          </ActionButton>
        )}
        <ActionButton onClick={() => send(close)} disabled={pending}>
          閉める
        </ActionButton>
      </div>
    </div>
  );
}

function LockBody({ device, send, pending }: { device: DashboardDevice; send: SendCommand; pending: boolean }) {
  const lockState = String(device.status?.lockState ?? "").toLowerCase();
  const doorState = String(device.status?.doorState ?? "").toLowerCase();
  const locked = lockState.startsWith("lock");
  const label = locked ? "施錠中" : lockState.startsWith("unlock") ? "解錠中" : lockState === "jammed" ? "エラー (詰まり)" : "不明";

  const unlock = () => {
    // 解錠は誤操作の影響が大きいので確認する
    if (window.confirm(`「${device.name}」を解錠しますか？`)) {
      void send({ command: "unlock" }, { lockState: "unlocked" });
    }
  };

  return (
    <div className="space-y-3">
      <p className={`text-lg font-semibold ${locked ? "text-emerald-600" : "text-amber-600"}`}>{label}</p>
      {doorState && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ドア: {doorState.startsWith("open") ? "開" : doorState.startsWith("close") ? "閉" : doorState}
        </p>
      )}
      <div className="flex gap-2">
        <ActionButton onClick={() => send({ command: "lock" }, { lockState: "locked" })} disabled={pending || locked}>
          施錠
        </ActionButton>
        <ActionButton onClick={unlock} disabled={pending || !locked}>
          解錠
        </ActionButton>
      </div>
    </div>
  );
}

function SensorBody({ status }: { status: DeviceStatus | null }) {
  if (!status) return null;
  const openState = status.openState;
  return (
    <dl className="space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
      {typeof openState === "string" && (
        <Stat
          label="開閉"
          value={openState === "open" ? "開" : openState === "close" ? "閉" : "開けっぱなし"}
        />
      )}
      {typeof status.moveDetected === "boolean" && (
        <Stat label="動き" value={status.moveDetected ? "検知" : "なし"} />
      )}
      {typeof status.Detected === "boolean" && <Stat label="在室" value={status.Detected ? "検知" : "なし"} />}
      {typeof status.status === "number" && <Stat label="水漏れ" value={status.status === 1 ? "検知" : "なし"} />}
      {typeof status.brightness === "string" && (
        <Stat label="周囲" value={status.brightness === "bright" ? "明るい" : "暗い"} />
      )}
    </dl>
  );
}

function InfraredBody({ device, send, pending }: { device: DashboardDevice; send: SendCommand; pending: boolean }) {
  const isTv = /tv|streamer|set top box/i.test(device.type);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <ActionButton onClick={() => send({ command: "turnOn" })} disabled={pending}>
          ON
        </ActionButton>
        <ActionButton onClick={() => send({ command: "turnOff" })} disabled={pending}>
          OFF
        </ActionButton>
      </div>
      {isTv && (
        <div className="grid grid-cols-4 gap-2">
          <ActionButton onClick={() => send({ command: "volumeSub" })} disabled={pending}>音−</ActionButton>
          <ActionButton onClick={() => send({ command: "volumeAdd" })} disabled={pending}>音＋</ActionButton>
          <ActionButton onClick={() => send({ command: "channelSub" })} disabled={pending}>CH−</ActionButton>
          <ActionButton onClick={() => send({ command: "channelAdd" })} disabled={pending}>CH＋</ActionButton>
        </div>
      )}
      <p className="text-xs text-zinc-500">赤外線リモコンは状態を取得できません</p>
    </div>
  );
}

function OtherBody({ status }: { status: DeviceStatus | null }) {
  if (!status) return null;
  const entries = Object.entries(status)
    .filter(([key, value]) => !["deviceId", "deviceType", "hubDeviceId", "version", "battery"].includes(key) && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4);
  if (entries.length === 0) return null;
  return (
    <dl className="space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
      {entries.map(([key, value]) => (
        <Stat key={key} label={key} value={String(value)} />
      ))}
    </dl>
  );
}

// ---- 共通パーツ ----

function PowerToggle({ on, disabled, send }: { on: boolean; disabled: boolean; send: SendCommand }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="電源"
      disabled={disabled}
      onClick={() => send({ command: on ? "turnOff" : "turnOn" }, { power: on ? "off" : "on" })}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
        on ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`}
      />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{value}</dd>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
