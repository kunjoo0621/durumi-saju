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

  if (error) throw new Error(error.message);
  return data?.id || null;
}
