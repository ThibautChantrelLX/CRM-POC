import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Use fetch to check session — avoids importing Node.js-only auth code in Edge runtime
  const res = await fetch(new URL("/api/auth/get-session", request.nextUrl.origin), {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  const session = res.ok ? await res.json().catch(() => null) : null;

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
