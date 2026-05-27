import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 배치 조회수 — 허브에서 카드 리스트의 조회수를 한 번에 받기 위함.
 * 클라이언트가 ?slugs=a,b,c 로 호출.
 */
export async function GET(req: NextRequest) {
  const slugsParam = req.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = slugsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (slugs.length === 0) {
    return NextResponse.json({ views: {} });
  }

  const { data, error } = await supabaseAdmin
    .from("story_views")
    .select("slug, view_count")
    .in("slug", slugs);

  if (error) {
    console.error("[stories/views] batch read failed", error);
    return NextResponse.json({ error: "조회수를 불러오지 못했습니다." }, { status: 500 });
  }

  const views: Record<string, number> = {};
  for (const slug of slugs) views[slug] = 0;
  for (const row of data ?? []) {
    views[row.slug] = Number(row.view_count ?? 0);
  }
  return NextResponse.json({ views });
}
