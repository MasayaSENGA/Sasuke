"use client";

import type { ReactNode } from "react";

export function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}
