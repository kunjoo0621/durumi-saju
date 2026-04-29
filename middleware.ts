import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PAGES = ["/coins", "/edit-profile", "/my/results"];
const PROTECTED_APIS = ["/api/profile", "/api/coins"];
const REFERRER_COOKIE = "dm_ref";
const REFERRER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

// User-Agent 문자열에서 인앱 브라우저/네이티브 앱 식별
// referrer 헤더가 없는 모바일 트래픽 대부분은 카톡/인스타/페북 인앱 브라우저
function detectAppFromUserAgent(ua: string): string | null {
  if (!ua) return null;
  // 우선순위 높은 한국 앱부터 매칭
  if (/KAKAOTALK/i.test(ua)) return "kakaotalk_inapp";
  if (/NAVER\(inapp/i.test(ua) || /NAVER\//i.test(ua)) return "naver_inapp";
  if (/Instagram/i.test(ua)) return "instagram_inapp";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "facebook_inapp";
  if (/Line\//i.test(ua)) return "line_inapp";
  if (/DaumApps|Daum\//i.test(ua)) return "daum_inapp";
  if (/Twitter|TwitterAndroid/i.test(ua)) return "twitter_inapp";
  if (/TikTok|musical_ly/i.test(ua)) return "tiktok_inapp";
  if (/Threads/i.test(ua)) return "threads_inapp";
  return null; // 일반 모바일/PC 브라우저
}

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

  // referrer 헤더가 없으면 UA로 인앱 브라우저 추정
  if (!externalReferrer) {
    const ua = request.headers.get("user-agent") || "";
    externalReferrer = detectAppFromUserAgent(ua);
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
    "/dict",
    "/dict/:path*",
    "/battle/input",
  ],
};
