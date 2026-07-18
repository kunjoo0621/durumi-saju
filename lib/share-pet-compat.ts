// 펫 궁합 share 페이지용 — 비로그인 SSR 조회
// /pet/result/share/[id] 에서 호출 (배틀의 share-battle.ts 패턴)

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedPetCompat = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("pet_compat_results")
    .select(`
      id, label_grade, label_text, composite_score,
      sync_score, ruler_score, lover_score, loyalty_score, conflict_score,
      illustration_key, illustration_url,
      full_result, scoring_version, created_at,
      pet:pet_profiles (id, name, species, breed, gender, birth_tier)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
});
