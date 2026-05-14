import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedYearlyResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("yearly_results")
    .select(
      "id, target_year, full_json, name, birth_date, birth_time, gender, yearly_pillar, saju_text, source_result_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const fj = (data as any).full_json;
  // 실패 row나 pending row는 공유 불가
  if (!fj || fj._error) return null;
  return data;
});
