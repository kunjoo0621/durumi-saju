import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedBattle = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("saju_battles")
    .select(
      "id, full_result, player_a_name, player_b_name, player_a_grade, player_b_grade, overall_winner, overall_intensity, wins_a, wins_b, draws, relationship_type, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
});
