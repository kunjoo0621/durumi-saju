/**
 * 과거 `saju_results` 행에 원국 스냅샷(`full_json.chart`)을 채워 넣는다.
 *
 * ★언제 쓰나
 * 스냅샷 없는 과거 행은 **볼 때마다 지금 엔진으로 계산**된다. 평소엔 문제없지만,
 * 원국 계산 자체를 바꾸는 변경(절기·지역 보정 같은)이 배포되면 그 순간부터
 * **옛 리포트 본문 vs 새로 계산된 화면**이 갈라진다. 그때 이 스크립트로 굳힌다.
 *
 * ★기본은 dry-run 이다. 실제 쓰기는 `--write` 를 명시해야 한다.
 *   TZ=UTC npx tsx scripts/backfill-chart-snapshot.mts              # 미리보기만
 *   TZ=UTC npx tsx scripts/backfill-chart-snapshot.mts --write      # 실제 반영
 *   TZ=UTC npx tsx scripts/backfill-chart-snapshot.mts --write --limit 50
 *
 * ★안전장치
 *   - 저장 `saju_text` 의 시주와 재계산 시주가 **다르면 그 행은 건너뛴다**(로그로 남긴다).
 *     다르다는 건 그 사이 엔진이 바뀌었다는 뜻이고, 무엇을 정답으로 굳힐지는 사람이 정해야 한다.
 *   - 이미 `chart` 가 있는 행은 건드리지 않는다(멱등).
 *   - `full_json` 이 null/_error 인 행(미완·실패)은 대상 아님.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const WRITE = process.argv.includes("--write");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const { buildChartSnapshot } = await import("../lib/result-chart");

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const storedHour = (t: string | null) =>
  t?.match(/시주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/)?.[1] ?? null;

// ★Supabase 는 기본 1000행에서 잘린다 — 페이지네이션 필수.
const rows: any[] = [];
for (let page = 0; ; page++) {
  const { data, error } = await sb
    .from("saju_results")
    .select("id, full_json, birth_date, birth_time, calendar_type, region, saju_text")
    .order("created_at")
    .range(page * 1000, page * 1000 + 999);
  if (error) throw new Error(error.message);
  rows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

console.log(`대상 후보 ${rows.length}행 · 모드 ${WRITE ? "★실제 쓰기" : "dry-run(미리보기)"}`);

let already = 0, skippedNoData = 0, mismatch = 0, wrote = 0, failed = 0;
const mismatchSamples: string[] = [];

for (const r of rows) {
  if (wrote >= LIMIT) break;
  const fj: any = r.full_json;
  if (!fj || fj._error) { skippedNoData++; continue; }
  if (fj.chart?.sajuData) { already++; continue; }

  const chart = await buildChartSnapshot(r);
  if (!chart) { skippedNoData++; continue; }

  const want = storedHour(r.saju_text);
  const got = chart.sajuData.hour.heavenlyStem + chart.sajuData.hour.earthlyBranch;
  if (want && want !== got) {
    mismatch++;
    if (mismatchSamples.length < 10) mismatchSamples.push(`  ${r.id.slice(0, 8)} 저장 ${want} vs 재계산 ${got}`);
    continue; // ★사람이 판단할 일 — 임의로 덮어쓰지 않는다
  }

  if (!WRITE) { wrote++; continue; }

  const { error } = await sb
    .from("saju_results")
    .update({ full_json: { ...fj, chart } })
    .eq("id", r.id);
  if (error) { failed++; console.error(`  쓰기 실패 ${r.id.slice(0, 8)}: ${error.message}`); continue; }
  wrote++;
  if (wrote % 200 === 0) console.log(`  ...${wrote}건`);
}

console.log(`\n이미 스냅샷 있음  ${already}`);
console.log(`대상 아님(미완·계산불가) ${skippedNoData}`);
console.log(`★시주 불일치로 건너뜀 ${mismatch}`);
if (mismatchSamples.length) console.log(mismatchSamples.join("\n"));
console.log(`${WRITE ? "실제 반영" : "반영 예정"} ${wrote}건 · 실패 ${failed}`);
if (!WRITE) console.log("\n실제로 쓰려면 --write 를 붙여 다시 실행할 것.");
