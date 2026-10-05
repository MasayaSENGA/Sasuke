import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Server Action からサインインした際に Set-Cookie を反映させる
  plugins: [nextCookies()],
});

/** Server Component / Route Handler から現在のセッションを取得する */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
