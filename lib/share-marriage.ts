// OG 공유 카드 페이로드 — 결혼운/애정운 심층 검사.
// lib/share-yearly.ts 패턴 미러, 문구/필드만 결혼운으로 교체.
// 등급(marriage_grade)·헤드라인(full_json.gradeHeadline)은 컬럼/필드로 이미 확정돼 있어
// yearly처럼 full_json.tier를 파싱할 필요가 없다 (lib/marriage-grade.ts, lib/marriage-prompt.ts 참조).
//
// ★N-4 주의: 이 헬퍼(getSharedMarriageResult)는 현재 어떤 라우트에도 연결돼 있지 않은 dead code다
//  (결혼운 공유 페이지 미구현). 공유 페이지를 붙일 때 이 함수는 id만 있으면 소유권·공개범위 확인
//  없이 marriage_results 전체 full_json을 반환하므로, 라우팅을 붙이기 전에 반드시 (a) 공개 토큰/
//  소유권 게이트, (b) full_json 중 노출 필드 화이트리스트를 먼저 세운 뒤 연결할 것. 게이트 없이
//  그대로 공개 라우트에 물리면 유료 리포트 전문이 id 추측만으로 새어나간다.

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
