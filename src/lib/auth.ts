import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * 新規アカウント作成を許可するか。
 * 公開環境で誰でも登録できてしまわないよう、本番では ALLOW_SIGNUP=true のときだけ許可する。
 */
export const isSignupAllowed =
  process.env.ALLOW_SIGNUP !== undefined
    ? process.env.ALLOW_SIGNUP === "true"
    : process.env.NODE_ENV !== "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: !isSignupAllowed,
  },
  // Server Action からサインインした際に Set-Cookie を反映させる
  plugins: [nextCookies()],
});

/** Server Component / Route Handler から現在のセッションを取得する */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
