"use client";

import { useEffect, useState } from "react";
import { AC_MAX_TEMP, AC_MIN_TEMP, type DashboardDevice, type RemoteState } from "@/lib/switchbot/devices";
import { ActionButton } from "./action-button";
import type { SendCommand } from "./use-device-command";

// 赤外線エアコンは状態を取得できないため、最後に送った設定をサーバーに保存して表示する (どの端末からでも同じ表示)。
// setAll のパラメータ: "{温度},{モード},{風量},{電源}" 例: "26,2,1,on"

type AcState = Required<Pick<RemoteState, "temperature" | "mode" | "fanSpeed" | "power">>;

const DEFAULT_STATE: AcState = { temperature: 26, mode: 2, fanSpeed: 1, power: "off" };

const MODES = [
  { value: 1, label: "自動" },
  { value: 2, label: "冷房" },
  { value: 3, label: "除湿" },
  { value: 4, label: "送風" },
  { value: 5, label: "暖房" },
];

const FAN_SPEEDS = [
  { value: 1, label: "自動" },
  { value: 2, label: "弱" },
  { value: 3, label: "中" },
  { value: 4, label: "強" },
];

/** 以前ブラウザ (localStorage) に保存していた設定のキー。サーバーに未保存なら一度だけ引き継ぐ */
const legacyStorageKey = (deviceId: string) => `sasuke:ac:${deviceId}`;

function takeLegacyState(deviceId: string): Partial<AcState> | null {
  try {
    const raw = localStorage.getItem(legacyStorageKey(deviceId));
    if (!raw) return null;
    localStorage.removeItem(legacyStorageKey(deviceId));
    const { temperature, mode, fan, power } = JSON.parse(raw);
    return { temperature, mode, fanSpeed: fan, power };
  } catch {
    return null;
  }
}

async function putRemoteState(
  deviceId: string,
  patch: Partial<AcState>,
): Promise<{ remoteState: RemoteState } | { error: string }> {
  try {
    const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/remote-state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? "設定を保存できませんでした" };
    return { remoteState: body.remoteState };
  } catch {
    return { error: "通信に失敗しました" };
  }
}

export function AirConditionerControls({
  device,
  send,
  pending,
  onUpdate,
}: {
  device: DashboardDevice;
  send: SendCommand;
  pending: boolean;
  onUpdate: (device: DashboardDevice) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state: AcState = { ...DEFAULT_STATE, ...device.remoteState };
  const busy = pending || saving;

  /** コマンドを送らずに設定だけ保存する */
  const save = async (patch: Partial<AcState>) => {
    setSaving(true);
    setError(null);
    const result = await putRemoteState(device.id, patch);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onUpdate({ ...device, remoteState: result.remoteState });
  };

  // 以前このブラウザに保存していた設定があれば、サーバーへ移す (サーバーに設定が無い場合のみ)
  const hasServerState = Boolean(device.remoteState);
  useEffect(() => {
    if (hasServerState) return;
    const legacy = takeLegacyState(device.id);
    if (!legacy) return;
    void putRemoteState(device.id, legacy).then((result) => {
      if ("remoteState" in result) onUpdate({ ...device, remoteState: result.remoteState });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 表示時に一度だけ確認する
  }, [device.id, hasServerState]);

  const apply = async (patch: Partial<AcState>) => {
    const next = { ...state, ...patch };
    // 電源 OFF 中の設定変更は保存だけして、送信は電源 ON 時にまとめて行う
    if (next.power === "off" && patch.power === undefined) {
      await save(patch);
      return;
    }
    // 送信に成功すると、サーバーが送った内容を保存して返す (use-device-command で反映)
    await send({
      command: "setAll",
      parameter: `${next.temperature},${next.mode},${next.fanSpeed},${next.power}`,
    });
  };

  const isOn = state.power === "on";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="温度を下げる"
            disabled={busy || state.temperature <= AC_MIN_TEMP}
            onClick={() => apply({ temperature: state.temperature - 1 })}
            className="h-9 w-9 rounded-full border border-zinc-300 text-lg disabled:opacity-40 dark:border-zinc-700"
          >
            −
          </button>
          <p className={`text-3xl font-semibold tabular-nums ${isOn ? "" : "text-zinc-400"}`}>
            {state.temperature}
            <span className="ml-0.5 text-base font-normal text-zinc-500">℃</span>
          </p>
          <button
            type="button"
            aria-label="温度を上げる"
            disabled={busy || state.temperature >= AC_MAX_TEMP}
            onClick={() => apply({ temperature: state.temperature + 1 })}
            className="h-9 w-9 rounded-full border border-zinc-300 text-lg disabled:opacity-40 dark:border-zinc-700"
          >
            ＋
          </button>
        </div>
        <span className={`text-sm font-medium ${isOn ? "text-sky-600" : "text-zinc-400"}`}>
          {isOn ? "運転中" : "停止中"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Select
          label="モード"
          value={state.mode}
          options={MODES}
          disabled={busy}
          onChange={(mode) => apply({ mode })}
        />
        <Select
          label="風量"
          value={state.fanSpeed}
          options={FAN_SPEEDS}
          disabled={busy}
          onChange={(fanSpeed) => apply({ fanSpeed })}
        />
      </div>

      <div className="flex gap-2">
        <ActionButton onClick={() => apply({ power: "on" })} disabled={busy}>
          運転
        </ActionButton>
        <ActionButton onClick={() => apply({ power: "off" })} disabled={busy}>
          停止
        </ActionButton>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">
        表示はこのアプリから最後に送った設定です (付属のリモコンでの操作は反映されません)
        {device.remoteState && ` ・ ${formatUpdatedAt(device.remoteState.updatedAt)}`}
      </p>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs text-zinc-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// サーバー描画とブラウザで表示がずれないよう、タイムゾーンを固定する
const updatedAtFormat = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

/** 最後に操作した日時 */
export function formatUpdatedAt(iso: string): string {
  return `${updatedAtFormat.format(new Date(iso))} 操作`;
}
