import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SignupForm } from "@/components/auth-form";
import { getSession, isSignupAllowed } from "@/lib/auth";

export default async function SignupPage() {
  // ALLOW_SIGNUP をビルド時ではなく実行時に読むため動的レンダリングにする
  await connection();
  // ログイン中にパスキーを作ると、新規アカウントではなく今のアカウントへの追加になってしまうため
  if (await getSession()) redirect("/dashboard");

  if (!isSignupAllowed) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold">アカウント作成は停止中です</h1>
          <p className="text-sm text-zinc-500">管理者にお問い合わせください。</p>
          <Link href="/login" className="text-sm underline">
            ログイン画面へ
          </Link>
        </div>
      </main>
    );
  }
  return <SignupForm />;
}
