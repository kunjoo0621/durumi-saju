// /api/pet-compat/list — 내 펫 궁합 결과 목록 (등급·라벨·펫이름/종·일러스트·생성일).
// app/api/marriage/list/route.ts 패턴 미러 — 조회 전용 GET, user_id 스코프, 최신순.
// pet_compat_results + pet_profiles(name, species) 조인. error.message 비노출(CLAUDE.md).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("pet_compat_results")
      .select(
        "id, label_grade, label_text, illustration_url, created_at, pet:pet_profiles (name, species)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PET_COMPAT_LIST] error", error.message);
      return NextResponse.json({ error: "펫 궁합 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    const enriched = (rows ?? [])
      // label_grade 없는 미완/에러 행 방어적으로 제외 (yearly/list의 미완 필터 선례)
      .filter((r: any) => r.label_grade != null)
      .map((r: any) => {
        // Supabase 조인은 many-to-one이면 객체, 배열로 오는 케이스 모두 방어
        const pet = Array.isArray(r.pet) ? r.pet[0] : r.pet;
        return {
          id: r.id,
          labelGrade: r.label_grade,
          labelText: r.label_text,
          illustrationUrl: r.illustration_url,
          petName: pet?.name ?? null,
          petSpecies: pet?.species ?? null,
          createdAt: r.created_at,
        };
      });

    return NextResponse.json({ results: enriched });
  } catch (error: any) {
    console.error("[PET_COMPAT_LIST] error", error?.message || error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
