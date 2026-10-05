"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { SwitchBotApiError, SwitchBotClient } from "@/lib/switchbot/client";
import { deleteCredentials, saveCredentials } from "@/lib/switchbot/credentials";

export type CredentialFormState = { error?: string } | null;

const credentialSchema = z.object({
  token: z.string().trim().min(1, "トークンを入力してください").max(512),
  secret: z.string().trim().min(1, "シークレットを入力してください").max(512),
});

async function requireUserId() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user.id;
}

export async function saveCredentialsAction(
  _prev: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const userId = await requireUserId();

  const parsed = credentialSchema.safeParse({
    token: formData.get("token"),
    secret: formData.get("secret"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }
  const { token, secret } = parsed.data;

  // 保存前に実際に API を呼んで、トークン/シークレットが正しいか確かめる
  try {
    await new SwitchBotClient(token, secret).getDevices();
  } catch (error) {
    return {
      error:
        error instanceof SwitchBotApiError
          ? error.message
          : "SwitchBot API に接続できませんでした",
    };
  }

  await saveCredentials(userId, token, secret);
  redirect("/dashboard");
}

export async function deleteCredentialsAction() {
  const userId = await requireUserId();
  await deleteCredentials(userId);
  redirect("/settings");
}
