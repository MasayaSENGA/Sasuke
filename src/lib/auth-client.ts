import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [passkeyClient()],
});

export const { signIn, signOut, useSession } = authClient;

/** パスキー操作のエラーを、画面に出す日本語のメッセージにする */
export function passkeyErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "AUTH_CANCELLED":
    case "ERROR_CEREMONY_ABORTED":
    case "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY":
      return "キャンセルされたか、時間切れになりました。もう一度お試しください";
    case "PASSKEY_NOT_FOUND":
      return "このパスキーは登録されていません。別のパスキーを選んでください";
    case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
    case "PREVIOUSLY_REGISTERED":
      return "この端末のパスキーは既に登録されています";
    case "ERROR_INVALID_DOMAIN":
    case "ERROR_INVALID_RP_ID":
      return "このアドレスではパスキーを使えません (BETTER_AUTH_URL と開いている URL が一致しているか確認してください)";
    case "CHALLENGE_NOT_FOUND":
      return "時間切れになりました。もう一度お試しください";
    case "AUTHENTICATION_FAILED":
    case "FAILED_TO_VERIFY_REGISTRATION":
      return "パスキーを確認できませんでした。もう一度お試しください";
  }
  return error.message || "エラーが発生しました";
}
