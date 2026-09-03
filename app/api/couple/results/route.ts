// /api/couple/results — 결과 조회. ?id= 지정 시 해당 결과, 없으면 최신 1건.
// app/api/marriage/results 패턴 미러.
//
// ★언락 판정은 `full_json` 존재로만 한다. `unlocked_at` 은 컬럼 default now() 때문에
//   무료 teaser row 에도 값이 박혀 있어 결제 여부를 말해주지 않는다(코드리뷰 지적).
//
// ★판정(verdict)·4축은 결제 전에 내려보내지 않는다. 판정이 곧 이 상품의 결론이라,
//   화면만 가리면 개발자도구로 보인다. 응답 경계에서 자른다(marriage 의 등급 처리와 같은 이유).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// pair_facts_json 은 화면이 사실을 그릴 때만 쓴다(표시 계층 사주 계산 금지, CLAUDE.md).
const SELECT_COLUMNS =
  "id, created_at, full_json, teaser_json, pair_facts_json, verdict, axis_mind, axis_life, axis_complement, axis_timing, neutralized_axes, current_year, name, partner_name";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");

    // ★소유 스코프 — 상대 생년월일이 들어 있는 row 라 남의 것을 읽으면 안 된다.
    const query = supabaseAdmin.from("couple_results").select(SELECT_COLUMNS).eq("user_id", userId);

    const { data: row, error } = id
      ? await query.eq("id", id).maybeSingle()
      : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (error) {
      console.error("[COUPLE_RESULTS] query", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    // 결제 전 — teaser 만. 판정·축·사실은 내려보내지 않는다.
    if (row.full_json === null) {
      return NextResponse.json({
        status: "teaser",
        resultId: row.id,
        names: { a: row.name, b: row.partner_name },
        teaser: row.teaser_json ?? {},
        createdAt: row.created_at,
      });
    }

    return NextResponse.json({
      status: "completed",
      resultId: row.id,
      names: { a: row.name, b: row.partner_name },
      verdict: row.verdict,
      axes: {
        마음: row.axis_mind,
        생활: row.axis_life,
        보완: row.axis_complement,
        시기: row.axis_timing,
      },
      neutralizedAxes: row.neutralized_axes ?? [],
      currentYear: row.current_year,
      facts: row.pair_facts_json,
      result: row.full_json,
      createdAt: row.created_at,
    });
  } catch (error: unknown) {
    console.error("[COUPLE_RESULTS] error", (error as Error)?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
