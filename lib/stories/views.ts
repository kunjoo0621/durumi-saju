import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 여러 글의 조회수를 한 번의 쿼리로 읽는다(서버 전용).
 *
 * 왜: 리스트/허브에서 카드마다 개별로 `/api/stories/<slug>/view`를 fetch하던 구조가
 * 글이 수십~150편으로 늘며 한 페이지 로드에 함수 호출 수십 개를 유발(크롤러가 오면 폭증).
 * 서버에서 한 번에 읽어 카드에 prop으로 주입 → 클라이언트 조회 요청 0.
 *
 * 참고: 조회수 "증가"는 본문 페이지의 StoryViewCounter(POST)가 담당하며 이 함수와 무관.
 * 이 함수는 "표시"용 읽기 전용. 실패·누락 slug는 0으로 채워 안전하게 반환(배지는 0이면 자동 숨김).
 */
export async function getStoryViews(
  slugs: string[],
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  const views: Record<string, number> = {};
  for (const s of unique) views[s] = 0;
  if (unique.length === 0) return views;

  try {
    const { data, error } = await supabaseAdmin
      .from("story_views")
      .select("slug, view_count")
      .in("slug", unique);
    if (error) {
      console.error("[stories/getStoryViews] read failed", error);
      return views;
    }
    for (const row of data ?? []) {
      views[row.slug] = Number(row.view_count ?? 0);
    }
  } catch (err) {
    console.error("[stories/getStoryViews] threw", err);
  }
  return views;
}
