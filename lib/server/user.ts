import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Session } from "next-auth";

export async function getSupabaseUserId(session?: Session | null) {
  const sessionUser = session?.user as { supabaseId?: string; id?: string; name?: string } | undefined;
  let userId = sessionUser?.supabaseId;
  const kakaoId = sessionUser?.id;

  if (userId) return userId;
  if (!kakaoId) return null;

  // Single upsert avoids a race where two concurrent requests try to create the same user.
  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(
      { kakao_id: kakaoId, nickname: sessionUser?.name || null },
      { onConflict: "kakao_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("[getSupabaseUserId] DB error:", error.message, error.code);
    throw new Error("사용자 정보를 처리하는 중 오류가 발생했습니다.");
  }
  return data?.id || null;
}
