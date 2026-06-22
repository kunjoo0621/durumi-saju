import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 랜딩 사회적 증거 카운터.
// 실제 누적 분석(개인사주+배틀+올해운세+오늘운세)을 합산한 뒤, 500단위로 "내림"한
// 마일스톤만 노출한다(예: 실제 2,480 → "2,000+"). 항상 실제보다 작게 잡으므로 과장 없음.
// 실제가 다음 500을 넘으면 자동으로 다음 마일스톤(2,500+ → 3,000+ ...)으로 올라간다.
const TABLES = ["saju_results", "saju_battles", "yearly_results", "today_results"];
const STEP = 500;
const TTL_MS = 5 * 60 * 1000;

let cache: { total: number; milestone: number; at: number } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json({ count: cache.total, milestone: cache.milestone });
    }
    let total = 0;
    for (const t of TABLES) {
      const { count } = await supabaseAdmin.from(t).select("id", { count: "exact", head: true });
      total += count ?? 0;
    }
    const milestone = Math.max(STEP, Math.floor(total / STEP) * STEP);
    cache = { total, milestone, at: Date.now() };
    return NextResponse.json({ count: total, milestone });
  } catch (e: any) {
    console.error("[stats/analyses]", e?.message);
    return NextResponse.json({ count: cache?.total ?? 0, milestone: cache?.milestone ?? STEP });
  }
}
