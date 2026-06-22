import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 랜딩 사회적 증거 카운터.
// ⚠️ BASELINE = 마케팅 표시용 베이스(운영자 지시 2026-06-22). 실제 분석수 = 표시값 - 5000.
const BASELINE = 5000;
const TABLES = ["saju_results", "saju_battles", "yearly_results", "today_results"];
const TTL_MS = 5 * 60 * 1000;

let cache: { count: number; at: number } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json({ count: cache.count });
    }
    let total = 0;
    for (const t of TABLES) {
      const { count } = await supabaseAdmin.from(t).select("id", { count: "exact", head: true });
      total += count ?? 0;
    }
    const display = BASELINE + total;
    cache = { count: display, at: Date.now() };
    return NextResponse.json({ count: display });
  } catch (e: any) {
    console.error("[stats/analyses]", e?.message);
    return NextResponse.json({ count: cache?.count ?? BASELINE });
  }
}
