import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// セッションクッキーの有無による楽観的なリダイレクトのみを行う。
// 実際のセッション検証は各ページ / Route Handler で行うこと。
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/history/:path*"],
};
