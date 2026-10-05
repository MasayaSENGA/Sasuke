import { connection } from "next/server";
import { AuthForm } from "@/components/auth-form";
import { isSignupAllowed } from "@/lib/auth";

export default async function LoginPage() {
  // ALLOW_SIGNUP をビルド時ではなく実行時に読むため動的レンダリングにする
  await connection();
  return <AuthForm mode="login" allowSignup={isSignupAllowed} />;
}
