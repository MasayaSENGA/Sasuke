import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/components/auth-form";
import { getSession, isPasswordLoginAllowed, isSignupAllowed } from "@/lib/auth";

export default async function LoginPage() {
  // ALLOW_SIGNUP などをビルド時ではなく実行時に読むため動的レンダリングにする
  await connection();
  if (await getSession()) redirect("/dashboard");
  return <LoginForm allowSignup={isSignupAllowed} allowPasswordLogin={isPasswordLoginAllowed} />;
}
