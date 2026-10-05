import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSwitchBot, switchBotErrorResponse } from "@/lib/switchbot/route-helpers";
import { findDevice, sendDeviceCommand } from "@/lib/switchbot/service";

const commandSchema = z.object({
  command: z.string().min(1).max(64),
  parameter: z
    .union([z.string().max(256), z.number(), z.record(z.string(), z.unknown())])
    .optional(),
  commandType: z.enum(["command", "customize"]).optional(),
});

/** デバイスにコマンドを送信する */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/devices/[deviceId]/commands">,
) {
  const sb = await requireSwitchBot();
  if (sb instanceof NextResponse) return sb;

  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "コマンドの形式が不正です" }, { status: 400 });
  }

  const { deviceId } = await ctx.params;
  try {
    // 自分のデバイス一覧に含まれる ID だけ操作を許可する
    const device = await findDevice(sb.userId, sb.client, deviceId);
    if (!device) {
      return NextResponse.json({ error: "デバイスが見つかりません" }, { status: 404 });
    }
    await sendDeviceCommand(sb.userId, sb.client, deviceId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return switchBotErrorResponse(error);
  }
}
