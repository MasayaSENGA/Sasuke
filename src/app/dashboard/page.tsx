import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/auth";

export default async function DashboardPage() {
  // proxy.ts はクッキーの有無だけを見る楽観的チェックなので、ここで必ずセッションを検証する
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>

      {/* TODO: SwitchBot デバイスのタイル表示 */}
      <p className="text-zinc-500">デバイスのタイル表示はここに実装予定です。</p>
    </div>
  );
}
