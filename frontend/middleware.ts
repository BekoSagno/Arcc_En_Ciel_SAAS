import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPaths = [
  "/dashboard",
  "/stats",
  "/sources",
  "/catalogue",
  "/conversations",
  "/tickets",
  "/channels",
  "/billing",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const requiresAuth = protectedPaths.some((path) => pathname.startsWith(path));
  if (!requiresAuth) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });
  if (!token || token.role !== "TENANT_ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/stats/:path*",
    "/sources/:path*",
    "/catalogue/:path*",
    "/conversations/:path*",
    "/tickets/:path*",
    "/channels/:path*",
    "/billing/:path*",
    "/settings/:path*",
  ],
};
