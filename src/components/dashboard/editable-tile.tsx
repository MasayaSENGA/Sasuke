"use client";

import type { DashboardDevice } from "@/lib/switchbot/devices";
import { ICONS } from "./device-tile";

/** 並び替え・表示設定モードのタイル (誤操作を防ぐため、家電の操作ボタンは出さない) */
export function EditableTile({
  device,
  isFirst,
  isLast,
  onMove,
  onToggleHidden,
}: {
  device: DashboardDevice;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggleHidden: () => void;
}) {
  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border border-dashed p-4 ${
        device.hidden
          ? "border-zinc-300 opacity-50 dark:border-zinc-700"
          : "border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-900"
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">
          <span className="mr-1.5" aria-hidden>
            {ICONS[device.kind]}
          </span>
          {device.name}
        </h3>
        <p className="text-xs text-zinc-500">
          {device.type}
          {device.hidden && " ・非表示"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <IconButton label="前へ移動" disabled={isFirst} onClick={() => onMove(-1)}>
          ←
        </IconButton>
        <IconButton label="後ろへ移動" disabled={isLast} onClick={() => onMove(1)}>
          →
        </IconButton>
        <button
          type="button"
          onClick={onToggleHidden}
          className="ml-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-700"
        >
          {device.hidden ? "表示する" : "非表示"}
        </button>
      </div>
    </article>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-lg border border-zinc-300 text-sm disabled:opacity-30 dark:border-zinc-700"
    >
      {children}
    </button>
  );
}
