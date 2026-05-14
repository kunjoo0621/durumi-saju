import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("utm_source", "youtube");
  url.searchParams.set("utm_medium", "shorts");
  url.searchParams.set("utm_campaign", "youtube_profile");

  return NextResponse.redirect(url, 307);
}
