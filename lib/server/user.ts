import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Session } from "next-auth";

export async function getSupabaseUserId(session?: Session | null) {
  const sessionUser = session?.user as { supabaseId?: string; id?: string; name?: string } | undefined;
  let userId = sessionUser?.supabaseId;
  const kakaoId = sessionUser?.id;

  if (userId) return userId;
  if (!kakaoId) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data?.id) {
    return data.id;
  }

  const inserted = await supabaseAdmin
    .from("users")
    .insert({ kakao_id: kakaoId, nickname: sessionUser?.name || null })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return inserted.data?.id || null;
}
