import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("saju_results")
    .select(
      "id, full_json, name, birth_date, birth_time, region, gender, calendar_type, core_fear_axis, saju_text"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
});
