// OG 공유 카드 페이로드 — 커리어운 심층 검사.
// lib/share-wealth.ts 패턴 미러, 문구/필드만 커리어운으로 교체.
// 등급(career_grade)·헤드라인(full_json.gradeHeadline)은 컬럼/필드로 이미 확정돼 있어
// full_json.tier를 파싱할 필요가 없다 (lib/career-grade.ts, lib/career-prompt.ts 참조).
//
// user_id로 스코프하지 않는다 — 공유 링크는 결과 id를 아는 누구나 볼 수 있는 공개 OG 카드용이며,
// 결제 전(full_json null) row만 공유 불가로 막는다.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedCareerResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("career_results")
    .select(
      "id, situation, career_grade, gwanseong_type, gwanda_sinyak, gwanin_sangsaeng, sanggwan_gyeongwan, career_grip, full_json, name, birth_date, gender, saju_text, source_result_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const fj = (data as any).full_json;
  // 결제 전(teaser만 있는) row는 full_json이 null — 공유 불가
  if (!fj) return null;
  return data;
});
