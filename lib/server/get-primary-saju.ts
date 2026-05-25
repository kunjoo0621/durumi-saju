// 대표사주 lookup — yearly·today entry에서 공유.
// users.primary_result_id 우선, 없으면 result_unlocks 최신 fallback.
// battle/my-saju는 응답 shape이 다름(tier/scores 포함) — 별도 라운드까지 분리.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PrimarySajuData = {
  sourceResultId: string;
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: string;
  unknownBirthTime: boolean;
  grade: string | null;
  ownedCount: number;
};

/**
 * userId의 대표사주(또는 최근 사주) 조회.
 * - 결과 없음 → null
 * - DB 에러 → throw (호출처 try/catch에서 500 응답)
 */
export async function getPrimarySajuData(userId: string): Promise<PrimarySajuData | null> {
  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("primary_result_id")
    .eq("id", userId)
    .single();

  let targetResultId: string | null = userData?.primary_result_id || null;

  if (!targetResultId) {
    const { data: unlock, error: unlockError } = await supabaseAdmin
      .from("result_unlocks")
      .select("result_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (unlockError) throw new Error(unlockError.message);
    targetResultId = unlock?.result_id || null;
  }

  if (!targetResultId) return null;

  const { data: result, error: resultError } = await supabaseAdmin
    .from("saju_results")
    .select(
      "id, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis, full_json",
    )
    .eq("id", targetResultId)
    .eq("user_id", userId)
    .maybeSingle();

  if (resultError) throw new Error(resultError.message);
  if (!result) return null;

  const { count: ownedCount } = await supabaseAdmin
    .from("saju_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const grade = (result.full_json as any)?.tier?.grade || null;
  const birthParts = result.birth_date?.split("-") || [];
  const timeParts = result.birth_time?.split(":") || [];

  return {
    sourceResultId: result.id,
    name: result.name,
    birthYear: birthParts[0] || "",
    birthMonth: birthParts[1] || "",
    birthDay: birthParts[2] || "",
    calendarType: (result.calendar_type as "solar" | "lunar") || "solar",
    birthHour: timeParts[0] || "",
    birthMinute: timeParts[1] || "",
    birthLocation: result.region || "",
    gender: result.gender || "",
    relationshipStatus: result.relationship_status || "",
    employmentStatus: result.employment_status || "",
    coreFearAxis: result.core_fear_axis || "",
    unknownBirthTime: !result.birth_time,
    grade,
    ownedCount: ownedCount ?? 0,
  };
}
