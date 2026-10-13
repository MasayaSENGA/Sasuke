import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ログインが必要なページの共通レイアウト。
// proxy.ts はクッキーの有無だけを見る楽観的チェックなので、ここで必ずセッションを検証する。
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  // パスワードで作った旧アカウントには、パスキーの登録を促す
  const hasPasskey = (await prisma.passkey.count({ where: { userId: session.user.id } })) > 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-4 text-sm whitespace-nowrap sm:gap-5">
            <Link href="/dashboard" className="text-base font-semibold">
              Sasuke
            </Link>
            {/* スマホではロゴがダッシュボードへのリンクを兼ねる */}
            <Link href="/dashboard" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-100">
              ダッシュボード
            </Link>
            <Link href="/history" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              履歴
            </Link>
            <Link href="/settings" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              設定
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{session.user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {!hasPasskey && (
        <div className="bg-amber-50 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <p className="mx-auto w-full max-w-6xl px-4 py-2">
            パスキーが未登録です。パスワードでのログインは移行期間のみ使えるため、
            <Link href="/settings" className="underline">設定画面</Link>
            でパスキーを登録してください。
          </p>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
