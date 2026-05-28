import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStoryBySlug } from "@/lib/stories/registry";

type Params = { params: Promise<{ slug: string }> };

/** POST: 조회수 증분 후 새 카운트 반환 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  if (!slug || !getStoryBySlug(slug)) {
    return NextResponse.json({ error: "잘못된 글입니다." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.rpc("increment_story_view", {
    p_slug: slug,
  });

  if (error) {
    console.error("[stories/view] increment failed", { slug, error });
    return NextResponse.json({ error: "조회수를 처리하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ slug, viewCount: Number(data ?? 0) });
}

/** GET: 증분 없이 현재 카운트만 반환 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  if (!slug || !getStoryBySlug(slug)) {
    return NextResponse.json({ error: "잘못된 글입니다." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("story_views")
    .select("view_count")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[stories/view] read failed", { slug, error });
    return NextResponse.json({ error: "조회수를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ slug, viewCount: Number(data?.view_count ?? 0) });
}
