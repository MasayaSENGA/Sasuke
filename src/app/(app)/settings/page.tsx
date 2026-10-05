import { getSession } from "@/lib/auth";
import { hasCredentials, isMockMode } from "@/lib/switchbot/credentials";
import { deleteCredentialsAction } from "./actions";
import { CredentialForm } from "./credential-form";

export default async function SettingsPage() {
  const session = await getSession();
  const registered = session ? await hasCredentials(session.user.id) : false;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">設定</h1>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">SwitchBot 連携</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              registered
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {registered ? "登録済み" : "未登録"}
          </span>
        </div>

        {isMockMode && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            モックモード (SWITCHBOT_MOCK=true) で動作中です。ダッシュボードには架空のデバイスが表示されます。
          </p>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          SwitchBot アプリの「プロフィール → 設定 → 開発者向けオプション」で発行したトークンとシークレットを入力してください。
          入力内容は暗号化して保存され、画面に再表示されることはありません。
        </p>

        <CredentialForm registered={registered} />

        {registered && !isMockMode && (
          <form action={deleteCredentialsAction} className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button type="submit" className="text-sm text-red-600 hover:underline">
              連携を解除する (保存したトークンを削除)
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
