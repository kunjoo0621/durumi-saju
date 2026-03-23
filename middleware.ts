import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PAGES = ["/coins", "/edit-profile", "/my/results"];
const PROTECTED_APIS = ["/api/profile", "/api/coins"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /payment → /checkout redirect (query params 유지)
  if (pathname === "/payment" || pathname.startsWith("/payment/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/checkout";
    return NextResponse.redirect(redirectUrl, 308);
  }

  const isProtectedPage = PROTECTED_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isProtectedApi = PROTECTED_APIS.some((path) => pathname.startsWith(path));

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return NextResponse.next();
  }

  if (isProtectedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/payment",
    "/payment/:path*",
    "/coins",
    "/edit-profile",
    "/my/results",
    "/api/profile",
    "/api/profile/:path*",
    "/api/coins",
    "/api/coins/:path*",
  ],
};
