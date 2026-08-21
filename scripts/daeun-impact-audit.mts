/**
 * 대운 영향 전수 감사 — 정밀 절기를 넣으면 대운수가 몇 건이나 바뀌는가.
 *
 * 왜: 절기 오차 ±13분의 실피해는 **월주가 아니라 대운수**에 있을 가능성이 크다.
 *     월주는 절입 시각 ±13분 창에 출생해야 뒤집히지만(3,197건 전수 실측 = 0건),
 *     대운수는 `daysToTerm ÷ 3` 의 반올림 경계에 걸리면 출생 시각과 무관하게 1세가 밀린다.
 *
 * 방법: `calculateMajorLuck` 을 같은 입력으로 **두 번** 호출한다.
 *        ① 엔진 analyzeSolarTerms 의 prev/next
 *        ② lib/utils/solar-terms-precise 의 정밀 prev/next
 *       나머지 인자(성별·연주·월주·adapter·count)는 완전히 동일.
 *
 * ★★TZ=UTC 필수. KST 로 돌리면 절기가 9시간 밀려 조용히 틀린 값이 나온다.
 *     TZ=UTC npx tsx scripts/daeun-impact-audit.mts [표본수=전체]
 *
 * 의사결정 규칙(미리 정함):
 *   - 정수 startAge 변경 > 0건        → 대운 주입 진행
 *   - startAgeDetail(일 단위)만 변화  → 진행하되 우선순위는 윤달 뒤
 *   - 둘 다 0건                       → 주입 스킵, 모듈은 테스트 자산으로만 유지
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=["']?(.+?)["']?$/); if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function all<T>(build: (a: number, b: number) => any): Promise<T[]> {
  const P = 1000, out: T[] = [];
  for (let i = 0; ; i += P) {
    const { data, error } = await build(i, i + P - 1); if (error) throw error;
    if (!data?.length) break; out.push(...data); if (data.length < P) break;
  }
  return out;
}

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m", red:"\x1b[31m", yellow:"\x1b[33m" };
const L = (s:any,n:number)=>String(s).padEnd(n);
const R = (s:any,n:number)=>String(s).padStart(n);

async function main() {
  if (new Date().getTimezoneOffset() !== 0) {
    console.error(`${c.red}TZ 가 UTC 가 아닙니다(offset ${-new Date().getTimezoneOffset()/60}h). TZ=UTC 로 실행하세요.${c.reset}`);
    process.exit(1);
  }
  const limit = Number(process.argv[2] ?? 0);

  const { getAdapter, calculateSaju, isInKoreaDST } = await import("../lib/utils/saju");
  const { analyzeSolarTerms, calculateMajorLuck } = await import("@gracefullight/saju");
  const { getPreciseJieMillis } = await import("../lib/utils/solar-terms-precise");
  const adapter = await getAdapter();

  const rows = await all<any>((a,b)=> sb.from("saju_results")
    .select("birth_date, birth_time, gender, region, calendar_type").range(a,b));
  const target = limit ? rows.slice(0, limit) : rows;

  console.log(`\n${c.bold}${c.cyan}대운 영향 전수 감사${c.reset}  ${c.dim}${target.length.toLocaleString()}건${c.reset}`);

  let checked=0, ageDiff=0, detailDiff=0, dirDiff=0, skipped=0;
  const shifts: number[] = [];            // daysToTerm 이동량(분)
  const examples: string[] = [];

  for (const r of target) {
    const d = String(r.birth_date ?? ""); if (d.length < 10) { skipped++; continue; }
    const [y, mo, dd] = [+d.slice(0,4), +d.slice(5,7), +d.slice(8,10)];
    if (!y || y < 1901 || y > 2030) { skipped++; continue; }
    const tm = String(r.birth_time ?? "");
    const [h, mi] = tm.length >= 5 ? [+tm.slice(0,2), +tm.slice(3,5)] : [12, 0];
    const gender = r.gender === "male" || r.gender === "female" ? r.gender : "male";

    // ★calculateFortune 의 입력 구성을 그대로 재현한다(DST 보정 포함).
    let birthDate = new Date(y, mo-1, dd, h, mi);
    if (isInKoreaDST(y, mo, dd)) birthDate = new Date(birthDate.getTime() - 3600_000);
    const dtLocal = { date: birthDate, timeZone: "Asia/Seoul" };

    const saju = await calculateSaju(y, mo, dd, h, mi, { birthLocation: r.region ?? undefined });
    if (!saju) { skipped++; continue; }
    const yp = `${saju.year.heavenlyStem}${saju.year.earthlyBranch}`;
    const mp = `${saju.month.heavenlyStem}${saju.month.earthlyBranch}`;

    let engine: any, precise: any;
    try {
      const st: any = analyzeSolarTerms(dtLocal, { adapter });
      engine = calculateMajorLuck(dtLocal, gender as any, yp, mp,
        { adapter, count: 10, nextJieMillis: st.nextJieMillis, prevJieMillis: st.prevJieMillis });

      // DST 보정된 벽시계를 그대로 UTC 인코딩 — 프로젝트 millis 규약
      const wallMs = Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate(),
                              birthDate.getHours(), birthDate.getMinutes());
      const p = getPreciseJieMillis(wallMs);
      if (!p) { skipped++; continue; }
      precise = calculateMajorLuck(dtLocal, gender as any, yp, mp,
        { adapter, count: 10, nextJieMillis: p.nextJieMillis, prevJieMillis: p.prevJieMillis });

      // 절기 이동량(분) — 순행이면 next, 역행이면 prev 를 본다
      const useNext = engine.isForward;
      shifts.push(Math.abs(((useNext ? p.nextJieMillis : p.prevJieMillis) -
                            (useNext ? st.nextJieMillis : st.prevJieMillis)) / 60000));
    } catch { skipped++; continue; }

    checked++;
    if (engine.isForward !== precise.isForward) dirDiff++;
    if (engine.startAge !== precise.startAge) {
      ageDiff++;
      if (examples.length < 10)
        examples.push(`${d} ${tm||"12:00"} ${gender==="male"?"남":"여"} — ${engine.startAge}세 → ${precise.startAge}세`);
    }
    const ed = engine.startAgeDetail, pd = precise.startAgeDetail;
    if (ed && pd && (ed.years!==pd.years || ed.months!==pd.months || ed.days!==pd.days)) detailDiff++;
  }

  const avg = shifts.length ? shifts.reduce((a,b)=>a+b,0)/shifts.length : 0;
  const max = shifts.length ? Math.max(...shifts) : 0;

  console.log(`\n${c.bold}━━ 결과 ━━${c.reset}`);
  console.log(`  ${L("검사",22)}${R(checked.toLocaleString(),8)}건  ${c.dim}(건너뜀 ${skipped})${c.reset}`);
  console.log(`  ${L("절기 이동량",22)}${R(avg.toFixed(1),8)}분 평균 · 최대 ${max.toFixed(0)}분`);
  console.log(`  ${L("대운 방향 변경",22)}${dirDiff?c.red:c.green}${R(dirDiff,8)}건${c.reset}  ${c.dim}(0 이어야 정상 — 방향은 연간 음양×성별로만 결정)${c.reset}`);
  console.log(`  ${c.bold}${L("정수 startAge 변경",22)}${ageDiff?c.yellow:c.green}${R(ageDiff,8)}건${c.reset}  ` +
    `${c.dim}${checked?(ageDiff/checked*100).toFixed(2):0}%${c.reset}`);
  console.log(`  ${L("startAgeDetail 변경",22)}${detailDiff?c.yellow:c.green}${R(detailDiff,8)}건${c.reset}  ` +
    `${c.dim}${checked?(detailDiff/checked*100).toFixed(2):0}%${c.reset}`);

  if (examples.length) {
    console.log(`\n${c.bold}정수 대운수가 바뀌는 예시${c.reset}`);
    examples.forEach(e => console.log(`  ${e}`));
  }

  console.log(`\n${c.bold}판정${c.reset}`);
  if (ageDiff > 0)
    console.log(`  ${c.yellow}→ 정수 대운수가 ${ageDiff}건 바뀐다. 대운 주입(3단계) 진행.${c.reset}`);
  else if (detailDiff > 0)
    console.log(`  ${c.yellow}→ 정수는 그대로, 일 단위만 ${detailDiff}건 변한다. 진행하되 우선순위는 윤달 뒤.${c.reset}`);
  else
    console.log(`  ${c.green}→ 변경 0건. 대운 주입 실익 없음 — 3단계 스킵 가능.${c.reset}`);
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
