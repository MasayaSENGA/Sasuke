import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** 死活監視用 (Docker のヘルスチェック等)。DB に接続できるかも確認する */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
