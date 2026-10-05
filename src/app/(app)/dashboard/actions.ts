"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { saveDevicePreferences } from "@/lib/switchbot/preferences";

const layoutSchema = z
  .array(
    z.object({
      deviceId: z.string().min(1).max(128),
      hidden: z.boolean(),
    }),
  )
  .max(500);

/** タイルの並び順 (配列の順) と表示/非表示を保存する */
export async function saveLayoutAction(items: { deviceId: string; hidden: boolean }[]) {
  const session = await getSession();
  if (!session) return { error: "ログインしてください" };

  const parsed = layoutSchema.safeParse(items);
  if (!parsed.success) return { error: "保存する内容が不正です" };

  await saveDevicePreferences(
    session.user.id,
    parsed.data.map((item, index) => ({ ...item, sortOrder: index })),
  );
  return { ok: true };
}
