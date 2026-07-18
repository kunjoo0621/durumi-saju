// OG 공유 카드 페이로드 — 결혼운/애정운 심층 검사.
// lib/share-yearly.ts 패턴 미러, 문구/필드만 결혼운으로 교체.
// 등급(marriage_grade)·헤드라인(full_json.gradeHeadline)은 컬럼/필드로 이미 확정돼 있어
// yearly처럼 full_json.tier를 파싱할 필요가 없다 (lib/marriage-grade.ts, lib/marriage-prompt.ts 참조).

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedMarriageResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("marriage_results")
    .select(
      "id, marital_status, marriage_grade, spouse_star_type, gwansal_honjap, spouse_star_absent, full_json, name, birth_date, birth_time, gender, saju_text, source_result_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const fj = (data as any).full_json;
  // 결제 전(teaser만 있는) row는 full_json이 null — 공유 불가
  if (!fj) return null;
  return data;
});
