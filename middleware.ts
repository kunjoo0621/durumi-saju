import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PAGES = ["/coins", "/edit-profile", "/my/results"];
const PROTECTED_APIS = ["/api/profile", "/api/coins"];
const REFERRER_COOKIE = "dm_ref";
const REFERRER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

// 첫 진입 시 referrer/UTM을 쿠키에 저장 (가입 시점에 lib/auth.ts에서 DB로 옮김)
function captureReferrerCookie(request: NextRequest, response: NextResponse) {
  // 쿠키 이미 있으면 건드리지 않음 (첫 진입 정보 보존)
  if (request.cookies.get(REFERRER_COOKIE)) return;

  const url = request.nextUrl;
  const refererHeader = request.headers.get("referer") || "";
  // 같은 도메인에서 온 요청은 referrer로 카운트하지 않음
  let externalReferrer: string | null = null;
  if (refererHeader) {
    try {
      const refUrl = new URL(refererHeader);
      if (refUrl.host !== url.host) externalReferrer = refUrl.host;
    } catch {
      // invalid referer 헤더는 무시
    }
  }

  const refData = {
    referrer: externalReferrer,
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    landing_path: url.pathname,
  };

  // 모두 NULL이면 저장하지 않음 (의미 있는 정보가 있을 때만 캡처)
  const hasAny = Object.values(refData).some((v) => v != null && v !== "");
  if (!hasAny) return;

  response.cookies.set(REFERRER_COOKIE, JSON.stringify(refData), {
    maxAge: REFERRER_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /payment → /checkout redirect (query params 유지)
  if (pathname === "/payment" || pathname.startsWith("/payment/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/checkout";
    const res = NextResponse.redirect(redirectUrl, 308);
    captureReferrerCookie(request, res);
    return res;
  }

  const isProtectedPage = PROTECTED_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isProtectedApi = PROTECTED_APIS.some((path) => pathname.startsWith(path));

  if (!isProtectedPage && !isProtectedApi) {
    const res = NextResponse.next();
    captureReferrerCookie(request, res);
    return res;
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    const res = NextResponse.next();
    captureReferrerCookie(request, res);
    return res;
  }

  if (isProtectedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("returnTo", `${pathname}${search}`);
  const res = NextResponse.redirect(redirectUrl);
  captureReferrerCookie(request, res);
  return res;
}

export const config = {
  matcher: [
    // 보호된 라우트 (기존)
    "/payment",
    "/payment/:path*",
    "/coins",
    "/edit-profile",
    "/my/results",
    "/api/profile",
    "/api/profile/:path*",
    "/api/coins",
    "/api/coins/:path*",
    // 채널 추적용 진입 페이지 (referrer 캡처 대상)
    "/",
    "/teaser",
    "/start",
    "/login",
  ],
};
