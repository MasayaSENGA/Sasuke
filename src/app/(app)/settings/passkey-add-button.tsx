"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, passkeyErrorMessage } from "@/lib/auth-client";

export function PasskeyAddButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setError(null);
    setPending(true);
    const { error } = await authClient.passkey.addPasskey();
    setPending(false);
    if (error) {
      setError(passkeyErrorMessage(error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "確認中…" : "パスキーを追加"}
      </button>
    </div>
  );
}
