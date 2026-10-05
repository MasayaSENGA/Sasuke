"use client";

import { useActionState } from "react";
import { saveCredentialsAction, type CredentialFormState } from "./actions";

export function CredentialForm({ registered }: { registered: boolean }) {
  const [state, action, pending] = useActionState<CredentialFormState, FormData>(
    saveCredentialsAction,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <SecretField
        label="トークン"
        name="token"
        placeholder={registered ? "登録済み (変更する場合のみ入力)" : ""}
      />
      <SecretField
        label="シークレット"
        name="secret"
        placeholder={registered ? "登録済み (変更する場合のみ入力)" : ""}
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "確認中…" : registered ? "更新する" : "登録する"}
      </button>
    </form>
  );
}

function SecretField({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        name={name}
        type="password"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
      />
    </label>
  );
}
