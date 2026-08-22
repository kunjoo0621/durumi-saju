/**
 * 결과·공유 화면이 그리는 원국 시주 == 서버가 분석에 쓴 시주(saju_text) 인가 전수 대조.
 *
 * 왜 필요한가: 화면(ResultClient·share)은 저장된 원국을 쓰지 않고 `calculateSaju` 로 다시 계산한다.
 * 이때 `birthLocation` 을 빼먹으면 기본 서울 경도로 진태양시 보정이 걸려 시주가 어긋난다
 * (2026-08-22 유료 클레임: 1995-07-22 15:35 경남 → 화면 辛未 vs 서버 壬申).
 *
 * ★실행은 반드시 TZ=UTC (CLAUDE.md 규약. 로컬 KST 로 돌리면 절기가 밀려 프로덕션과 다른 값이 나온다)
 *
 *   TZ=UTC npx tsx scripts/audit-hour-pillar-display.mts              # 수정 후 화면 동작(지역 적용)
 *   TZ=UTC npx tsx scripts/audit-hour-pillar-display.mts --no-region  # 수정 전 화면 동작(역검증)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const { calculateSaju } = await import("../lib/utils/saju");
const { convertLunarToSolar } = await import("../lib/utils/lunar");

const NO_REGION = process.argv.includes("--no-region");

const envText = readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ★Supabase select 는 기본 1000행에서 잘린다 — 감사는 반드시 페이지네이션.
async function fetchAll() {
  const rows: any[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await sb
      .from("saju_results")
      .select("id, created_at, birth_date, birth_time, calendar_type, region, saju_text")
      .order("created_at")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const storedHourPillar = (sajuText: string | null): string | null => {
  if (!sajuText) return null;
  const m = sajuText.match(/시주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  return m ? m[1] : null;
};

const rows = await fetchAll();
console.log(`saju_results 전수 ${rows.length}행 · 모드 ${NO_REGION ? "지역 미적용(수정 전 화면)" : "지역 적용(수정 후 화면)"}`);

let checked = 0;
const mismatches: Array<{ id: string; date: string; time: string; region: string; stored: string; screen: string }> = [];
const byRegion: Record<string, { n: number; diff: number }> = {};

for (const r of rows) {
  const stored = storedHourPillar(r.saju_text);
  if (!stored || !r.birth_time || !r.birth_date) continue; // 시간 미상·구버전 텍스트는 대조 불가

  let [y, mo, d] = String(r.birth_date).split("-").map(Number);
  if (r.calendar_type === "lunar") {
    const c = convertLunarToSolar(y, mo, d, false);
    if (!c) continue;
    y = c.year; mo = c.month; d = c.day;
  }
  const [hh, mi] = String(r.birth_time).split(":").map(Number);

  const saju = NO_REGION
    ? await calculateSaju(y, mo, d, hh, mi)
    : await calculateSaju(y, mo, d, hh, mi, { birthLocation: r.region ?? undefined });
  if (!saju) continue;

  checked++;
  const region = r.region ?? "(없음)";
  byRegion[region] ??= { n: 0, diff: 0 };
  byRegion[region].n++;

  const screen = saju.hour.heavenlyStem + saju.hour.earthlyBranch;
  if (screen !== stored) {
    byRegion[region].diff++;
    mismatches.push({ id: r.id, date: r.birth_date, time: r.birth_time, region, stored, screen });
  }
}

console.log(`\n대조 가능 ${checked}건 중 화면≠저장 ${mismatches.length}건 (${((mismatches.length / checked) * 100).toFixed(1)}%)`);
if (mismatches.length) {
  console.log("\n지역별:");
  for (const [k, v] of Object.entries(byRegion).filter(([, v]) => v.diff > 0).sort((a, b) => b[1].diff - a[1].diff))
    console.log(`  ${k.padEnd(8)} n=${String(v.n).padStart(4)}  불일치 ${String(v.diff).padStart(3)} (${((v.diff / v.n) * 100).toFixed(0)}%)`);
  console.log("\n불일치 목록(상위 10건):");
  for (const m of mismatches.slice(0, 10))
    console.log(`  ${m.id.slice(0, 8)} ${m.date} ${m.time} ${m.region.padEnd(4)} 저장 ${m.stored} vs 화면 ${m.screen}`);
  console.log(`\n불일치 ID 전체(${mismatches.length}): ${mismatches.map((m) => m.id).join(",")}`);
}
process.exit(mismatches.length === 0 ? 0 : 1);
