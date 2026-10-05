"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "./action-button";
import type { SendCommand } from "./use-device-command";

// 赤外線エアコンは状態を取得できないため、最後に送った設定をブラウザに保存して表示する。
// setAll のパラメータ: "{温度},{モード},{風量},{電源}" 例: "26,2,1,on"

type AcState = { temperature: number; mode: number; fan: number; power: "on" | "off" };

const DEFAULT_STATE: AcState = { temperature: 26, mode: 2, fan: 1, power: "off" };

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

const MIN_TEMP = 16;
const MAX_TEMP = 30;

const storageKey = (deviceId: string) => `sasuke:ac:${deviceId}`;

function loadState(deviceId: string): AcState {
  try {
    const raw = localStorage.getItem(storageKey(deviceId));
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    // 保存できない環境 (プライベートモード等) では既定値を使う
  }
  return DEFAULT_STATE;
}

function saveState(deviceId: string, state: AcState) {
  try {
    localStorage.setItem(storageKey(deviceId), JSON.stringify(state));
  } catch {
    // 無視
  }
}

export function AirConditionerControls({
  deviceId,
  send,
  pending,
}: {
  deviceId: string;
  send: SendCommand;
  pending: boolean;
}) {
  const [state, setState] = useState<AcState>(DEFAULT_STATE);

  // localStorage はサーバー描画時に存在しないので、マウント後に読み込む
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部ストレージからの初期化
    setState(loadState(deviceId));
  }, [deviceId]);

  const apply = async (patch: Partial<AcState>) => {
    const next = { ...state, ...patch };
    // 電源 OFF 中の設定変更は保存だけして、送信は電源 ON 時にまとめて行う
    const shouldSend = next.power === "on" || patch.power !== undefined;
    if (shouldSend) {
      const ok = await send({
        command: "setAll",
        parameter: `${next.temperature},${next.mode},${next.fan},${next.power}`,
      });
      if (!ok) return;
    }
    setState(next);
    saveState(deviceId, next);
  };

  const isOn = state.power === "on";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="温度を下げる"
            disabled={pending || state.temperature <= MIN_TEMP}
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
            disabled={pending || state.temperature >= MAX_TEMP}
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
          disabled={pending}
          onChange={(mode) => apply({ mode })}
        />
        <Select
          label="風量"
          value={state.fan}
          options={FAN_SPEEDS}
          disabled={pending}
          onChange={(fan) => apply({ fan })}
        />
      </div>

      <div className="flex gap-2">
        <ActionButton onClick={() => apply({ power: "on" })} disabled={pending}>
          運転
        </ActionButton>
        <ActionButton onClick={() => apply({ power: "off" })} disabled={pending}>
          停止
        </ActionButton>
      </div>
      <p className="text-xs text-zinc-500">表示はこの画面から最後に送った設定です</p>
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
