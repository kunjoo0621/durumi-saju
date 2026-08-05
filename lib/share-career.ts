// 커리어운 share 페이지용 — 비로그인 SSR 조회.
//
// user_id로 스코프하지 않는다: 공유 링크는 받은 사람이 열어야 하므로 의도적이다.
// 접근 통제는 "id가 추측 불가능한 UUID"에 기댄다(share-yearly·share-pet-compat와 동일 모델).
//
// ★select 화이트리스트: 결과 화면 렌더에 실제로 쓰이는 컬럼만 뽑는다. name/birth_date/
//  gender/saju_text/source_result_id는 링크를 받은 제3자에게 보여줄 이유가 없어 제외했다.
// 결제 전(teaser만 있는) row는 full_json이 null이라 여기서 null로 떨어진다.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CAREER_SHARE_COLUMNS } from "@/lib/constants/result-columns";

export const getSharedCareerResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("career_results")
    .select(CAREER_SHARE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  if (!(data as any).full_json) return null;
  return data;
});
