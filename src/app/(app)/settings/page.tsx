import { getSession } from "@/lib/auth";
import { hasCredentials, isMockMode } from "@/lib/switchbot/credentials";
import { canUseWebhook, isWebhookEnabled } from "@/lib/switchbot/webhook";
import { deleteCredentialsAction, disableWebhookAction } from "./actions";
import { CredentialForm } from "./credential-form";
import { WebhookEnableForm } from "./webhook-form";

export default async function SettingsPage() {
  const session = await getSession();
  const registered = session ? await hasCredentials(session.user.id) : false;
  const webhookEnabled = session && registered ? await isWebhookEnabled(session.user.id) : false;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">設定</h1>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">SwitchBot 連携</h2>
          <StatusBadge on={registered} onLabel="登録済み" offLabel="未登録" />
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

      {registered && (
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">リアルタイム更新 (Webhook)</h2>
            <StatusBadge on={webhookEnabled} onLabel="有効" offLabel="無効" />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            デバイスの状態が変わると SwitchBot から通知が届き、ダッシュボードにすぐ反映されます。
            定期的な状態取得の回数が減るので、API の回数制限の節約にもなります。
            温湿度計の通知は履歴グラフの記録にも使われます。
          </p>

          {webhookEnabled ? (
            <form action={disableWebhookAction}>
              <button type="submit" className="text-sm text-red-600 hover:underline">
                リアルタイム更新を無効にする
              </button>
            </form>
          ) : canUseWebhook() ? (
            <WebhookEnableForm />
          ) : (
            <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              SwitchBot のサーバーから届く公開 HTTPS の URL が必要なため、ローカル開発環境では使えません。
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs ${
        on
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}
