"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);

    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const { error } =
      mode === "signup"
        ? await signUp.email({ email, password, name: String(formData.get("name")) })
        : await signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(error.message ?? "エラーが発生しました");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const isSignup = mode === "signup";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        action={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold">{isSignup ? "アカウント作成" : "ログイン"}</h1>

        {isSignup && (
          <Field label="表示名" name="name" type="text" autoComplete="name" />
        )}
        <Field label="メールアドレス" name="email" type="email" autoComplete="email" />
        <Field
          label="パスワード"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={8}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "処理中…" : isSignup ? "作成する" : "ログイン"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          {isSignup ? (
            <>
              アカウントをお持ちの方は <Link href="/login" className="underline">ログイン</Link>
            </>
          ) : (
            <>
              初めての方は <Link href="/signup" className="underline">アカウント作成</Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}

function Field(props: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  minLength?: number;
}) {
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
