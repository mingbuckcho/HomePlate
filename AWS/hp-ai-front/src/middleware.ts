import { auth } from "@/auth";
import type { NextAuthRequest } from "next-auth";
import type { NextMiddleware } from "next/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

/** 이 경로들은 인증 미들웨어를 타지 않음 — /api/auth/signin 302 루프 방지 */
function shouldSkipAuth(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/i.test(pathname))
    return true;
  return false;
}

const authMiddleware = auth as (
  req: NextAuthRequest,
  event: NextFetchEvent,
) => ReturnType<NextMiddleware>;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (shouldSkipAuth(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return authMiddleware(req as NextAuthRequest, event);
}

export const config = {
  matcher: [
    /*
     * 페이지 경로만 매칭. 제외: /api/auth, /api/auth/*, /_next, favicon.ico, 정적 확장자
     */
    "/((?!api/auth|_next|favicon\\.ico)(?!.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
