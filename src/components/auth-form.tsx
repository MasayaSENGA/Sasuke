"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, passkeyErrorMessage, signIn } from "@/lib/auth-client";

const cardClass =
  "w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const primaryButtonClass =
  "w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export function LoginForm({
  allowSignup,
  allowPasswordLogin,
}: {
  allowSignup: boolean;
  allowPasswordLogin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onSuccess() {
    router.push("/dashboard");
    router.refresh();
  }

  async function handlePasskey() {
    setError(null);
    setPending(true);
    const { error } = await signIn.passkey();
    setPending(false);
    if (error) {
      setError(passkeyErrorMessage(error));
      return;
    }
    onSuccess();
  }

  async function handlePassword(formData: FormData) {
    setError(null);
    setPending(true);
    const { error } = await signIn.email({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? "エラーが発生しました");
      return;
    }
    onSuccess();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className={cardClass}>
        <h1 className="text-xl font-semibold">ログイン</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          登録したパスキー (指紋・顔認証・PIN、またはスマホ) でログインします。
        </p>

        <button type="button" onClick={handlePasskey} disabled={pending} className={primaryButtonClass}>
          {pending ? "確認中…" : "パスキーでログイン"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {allowPasswordLogin && (
          <details className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <summary className="cursor-pointer text-sm text-zinc-500">
              パスワードでログイン (パスキー未登録のアカウント)
            </summary>
            <form action={handlePassword} className="mt-4 space-y-4">
              <Field label="メールアドレス" name="email" type="email" autoComplete="email" />
              <Field label="パスワード" name="password" type="password" autoComplete="current-password" />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg border border-zinc-300 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
              >
                パスワードでログイン
              </button>
            </form>
          </details>
        )}

        {allowSignup && (
          <p className="text-center text-sm text-zinc-500">
            初めての方は <Link href="/signup" className="underline">アカウント作成</Link>
          </p>
        )}
      </div>
    </main>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    // 表示名とメールアドレスはサーバー側で検証し、パスキーの確認が済んでからアカウントを作る
    const { error } = await authClient.passkey.addPasskey({
      context: JSON.stringify({ name: formData.get("name"), email: formData.get("email") }),
      createSession: true,
    });
    setPending(false);
    if (error) {
      setError(passkeyErrorMessage(error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form action={handleSubmit} className={cardClass}>
        <h1 className="text-xl font-semibold">アカウント作成</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          パスワードの代わりにパスキーを作成します。この端末の指紋・顔認証・PIN、またはスマホで確認してください。
        </p>

        <Field label="表示名" name="name" type="text" autoComplete="name" />
        <Field label="メールアドレス" name="email" type="email" autoComplete="email" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "処理中…" : "パスキーを作成して登録"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          アカウントをお持ちの方は <Link href="/login" className="underline">ログイン</Link>
        </p>
      </form>
    </main>
  );
}

function Field(props: { label: string; name: string; type: string; autoComplete: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        {...inputProps}
        required
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
      />
    </label>
  );
}
