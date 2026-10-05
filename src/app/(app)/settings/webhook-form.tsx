"use client";

import { useActionState } from "react";
import { enableWebhookAction, type WebhookFormState } from "./actions";

export function WebhookEnableForm() {
  const [state, action, pending] = useActionState<WebhookFormState, FormData>(
    enableWebhookAction,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state?.foreignUrls && (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <p>SwitchBot の Webhook は 1 アカウントに 1 つだけ登録できます。現在の登録先:</p>
          <ul className="list-disc pl-5 font-mono text-xs break-all">
            {state.foreignUrls.map((url) => (
              <li key={url}>{url}</li>
            ))}
          </ul>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="replaceForeign" />
            既存の登録を解除して、このアプリに置き換える
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "登録中…" : "リアルタイム更新を有効にする"}
      </button>
    </form>
  );
}
