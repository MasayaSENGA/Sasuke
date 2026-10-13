import "server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * 新規アカウント作成を許可するか。
 * 公開環境で誰でも登録できてしまわないよう、本番では ALLOW_SIGNUP=true のときだけ許可する。
 */
export const isSignupAllowed =
  process.env.ALLOW_SIGNUP !== undefined
    ? process.env.ALLOW_SIGNUP === "true"
    : process.env.NODE_ENV !== "production";

/**
 * パスワードでのログインを許可するか (パスキー導入前に作ったアカウントの移行用)。
 * ログインして設定画面でパスキーを登録したら false に戻す。新規登録は常にパスキーのみ。
 */
export const isPasswordLoginAllowed = process.env.ALLOW_PASSWORD_LOGIN === "true";

/**
 * ログイン試行の回数制限に使う、アクセス元 IP を示すヘッダー (カンマ区切りで複数可)。
 * Cloudflare Tunnel 経由では "cf-connecting-ip" を指定する。未指定なら X-Forwarded-For (Caddy 経由向け)。
 * アプリへ直接アクセスできる構成で指定すると偽装できてしまうので、必ずプロキシ経由の構成でのみ使うこと。
 */
const ipAddressHeaders = process.env.TRUSTED_IP_HEADER?.split(",")
  .map((header) => header.trim().toLowerCase())
  .filter(Boolean);

/** パスキーの登録先 (RP)。公開 URL のホスト名に紐づくので、ドメインを変えると登録し直しになる */
const appUrl = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");

/** 新規登録時にクライアントから渡す内容 (パスキーの登録オプション取得時に context として送る) */
const signupContextSchema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
});

/**
 * 新規登録の途中であることを示す仮のユーザー ID。
 * パスキーの検証が済んでから本物のユーザーを作るため、それまではこの値で受け渡す。
 */
const SIGNUP_PENDING_USER_ID = "signup-pending";

/** 新規登録の内容を検証する (未ログインでのパスキー登録は、この経路でしか受け付けない) */
async function parseSignupContext(context: string | null | undefined) {
  if (!isSignupAllowed) {
    throw new APIError("FORBIDDEN", { message: "アカウント作成は停止中です" });
  }
  let json: unknown;
  try {
    json = JSON.parse(context ?? "");
  } catch {
    json = null;
  }
  const parsed = signupContextSchema.safeParse(json);
  if (!parsed.success) {
    throw new APIError("BAD_REQUEST", { message: "表示名とメールアドレスを正しく入力してください" });
  }
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (exists) {
    throw new APIError("BAD_REQUEST", { message: "このメールアドレスは既に登録されています" });
  }
  return parsed.data;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: isPasswordLoginAllowed,
    disableSignUp: true,
  },
  advanced: ipAddressHeaders?.length ? { ipAddress: { ipAddressHeaders } } : undefined,
  plugins: [
    passkey({
      rpID: appUrl.hostname,
      rpName: "Sasuke",
      origin: appUrl.origin,
      // パスワードもユーザー名も入力せずにログインできるよう、端末にアカウント情報を保存するパスキー (discoverable credential) にする
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
      registration: {
        // 未ログインでの登録 (= 新規登録) を受け付ける。ログイン中はそのユーザーへの追加になる
        requireSession: false,
        resolveUser: async ({ context }) => {
          const { email, name } = await parseSignupContext(context);
          return { id: SIGNUP_PENDING_USER_ID, name: email, displayName: name };
        },
        afterVerification: async ({ ctx, user, context }) => {
          if (user.id !== SIGNUP_PENDING_USER_ID) return;
          // オプション取得から検証までの間に登録停止・同じメールアドレスでの登録があった場合に備えて再確認する
          const { email, name } = await parseSignupContext(context);
          const created = await ctx.context.internalAdapter.createUser({ email, name }, { method: "passkey" });
          return { userId: created.id };
        },
      },
    }),
    // Server Action からサインインした際に Set-Cookie を反映させる (plugins の最後に置く)
    nextCookies(),
  ],
});

/** Server Component / Route Handler から現在のセッションを取得する */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
