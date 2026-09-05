// couple 판정 경계 캘리브레이션 — 실사용자 원국으로 판정 분포를 잰다.
//
// 실행: TZ=UTC npx tsx scripts/couple-decision-dist.ts [pairCount]
//
// ★왜: lib/pair/couple-decision.ts 의 VERDICTS 경계(±1.5/±4.5)와 궁위 가중은
//   "[제안] — Phase 2 캘리브레이션에서 확정" 상태다. 감으로 정한 값 위에 배경 3장·
//   5단계 라벨·티저 카피가 전부 얹혀 있다. 한 단계가 절반을 넘으면 "누가 봐도 같은
//   판정"이 되어 상품이 죽는다.
//
// ★LLM 을 쓰지 않는다. 만세력 + 결정론 판정만 돌린다 — 비용 0.
// ★Supabase 는 기본 1000행에서 잘린다. 페이지네이션 필수(사내 실측 사고).

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

import { decideCouple, type AxisKey } from "../lib/pair/couple-decision";
import { computePartnerChart } from "../lib/pair/couple-charts";
import { derivePairFacts, type Sex } from "../lib/pair/pair-facts";
import { deriveMarriageFacts } from "../lib/marriage-facts";

const PAIRS = Number(process.argv[2] ?? 400);
const CURRENT_YEAR = 2026;

type Row = {
  birth_date: string | null;
  birth_time: string | null;
  gender: string | null;
  region: string | null;
  calendar_type: string | null;
};

async function fetchCharts(sb: ReturnType<typeof createClient>) {
  let rows: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("saju_results")
      .select("birth_date, birth_time, gender, region, calendar_type")
      .not("birth_date", "is", null)
      .not("gender", "is", null)
      .range(from, from + 499);
    if (error) throw new Error(error.message);
    rows = rows.concat((data ?? []) as Row[]);
    if (!data || data.length < 500) break;
    from += 500;
    if (rows.length >= 3000) break; // 충분하다 — 원국 계산이 비싸다
  }
  return rows;
}

function toInput(r: Row) {
  const [y, m, d] = String(r.birth_date).split("-");
  const t = r.birth_time ?? "";
  return {
    name: "x",
    birthYear: y, birthMonth: m, birthDay: d,
    birthHour: t ? t.split(":")[0] : undefined,
    birthMinute: t ? t.split(":")[1] : undefined,
    birthLocation: r.region ?? undefined,
    gender: r.gender ?? "",
    calendarType: (r.calendar_type as string) ?? "solar",
    unknownBirthTime: !t,
  };
}

function pct(n: number, total: number) {
  return `${((n / total) * 100).toFixed(1)}%`;
}

function bar(n: number, total: number, width = 34) {
  const filled = Math.round((n / total) * width);
  return "█".repeat(filled) + "·".repeat(width - filled);
}

async function main() {
  const env: Record<string, string> = {};
  for (const line of (await import("fs")).readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("실사용자 원국을 가져오는 중...");
  const rows = await fetchCharts(sb);
  console.log(`  ${rows.length}건 (시간 미상 ${rows.filter((r) => !r.birth_time).length}건 = ${pct(rows.filter((r) => !r.birth_time).length, rows.length)})`);

  // ★무작위로 뽑는다. 앞에서 자르면 표본이 편향된다 — 1차 실측에서 앞 60건의
  //   시간 미상이 25%였는데 전체는 9%였고, 그 탓에 중화 비율이 부풀려 나왔다.
  const need = Math.min(rows.length, Math.max(120, Math.ceil(Math.sqrt(PAIRS) * 4)));
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, need);
  console.log(`\n원국 ${picked.length}건 계산 중...`);

  const charts: Array<{
    chart: Awaited<ReturnType<typeof computePartnerChart>>;
    sex: Sex;
    timing: ReturnType<typeof deriveMarriageFacts>["timingWindows"] | null;
    timeUnknown: boolean;
  }> = [];
  for (const r of picked) {
    const c = await computePartnerChart(toInput(r));
    if (!c.ok) continue;
    let timing: ReturnType<typeof deriveMarriageFacts>["timingWindows"] | null = null;
    try {
      timing = deriveMarriageFacts(c.enriched, c.fortune, c.saju, c.sex, "솔로", CURRENT_YEAR).timingWindows;
    } catch { timing = null; }
    charts.push({ chart: c, sex: c.sex, timing, timeUnknown: Boolean(c.enriched.isTimeUnknown) });
  }
  console.log(`  성공 ${charts.length}건 (시간 미상 ${charts.filter(c => c.timeUnknown).length}건, 대운 실패 ${charts.filter(c => c.timing === null).length}건)`);

  // 남녀를 섞어 짝을 만든다(같은 사람 자기 자신은 제외).
  const verdicts = new Map<string, number>();
  const axisDist: Record<AxisKey, Map<string, number>> = {
    마음: new Map(), 생활: new Map(), 보완: new Map(), 시기: new Map(),
  };
  const totals: number[] = [];
  let neutralizedAny = 0;
  let made = 0;

  for (let i = 0; i < charts.length && made < PAIRS; i++) {
    for (let j = i + 1; j < charts.length && made < PAIRS; j++) {
      const a = charts[i], b = charts[j];
      if (!a.chart.ok || !b.chart.ok) continue;
      // ★타이밍을 빼고 재면 시기 축이 100% "평"으로 나와 분포가 거짓이 된다(1차 실측).
      //   대운은 원국마다 한 번만 구해 캐시한다.
      const facts = derivePairFacts(a.chart.enriched, b.chart.enriched, {
        currentYear: CURRENT_YEAR,
        sexA: a.sex, sexB: b.sex,
        timingA: a.timing, timingB: b.timing,
        timingAvailable: a.timing !== null && b.timing !== null,
      });
      const d = decideCouple(facts);
      verdicts.set(d.verdict, (verdicts.get(d.verdict) ?? 0) + 1);
      for (const k of ["마음", "생활", "보완", "시기"] as AxisKey[]) {
        const v = d.axes[k].verdict;
        axisDist[k].set(v, (axisDist[k].get(v) ?? 0) + 1);
      }
      totals.push(d.total);
      if (d.neutralized.length) neutralizedAny++;
      made++;
    }
  }

  console.log(`\n${"=".repeat(64)}\n판정 분포 (${made}쌍)\n${"=".repeat(64)}`);
  const order = [
    "서로를 편하게 하는 결",
    "무리 없이 굴러가는 결",
    "맞춰가며 사는 결",
    "손이 자주 가는 결",
    "많이 다른 두 사람",
  ];
  let worst = 0;
  for (const label of order) {
    const n = verdicts.get(label) ?? 0;
    worst = Math.max(worst, n / made);
    console.log(`  ${label.padEnd(14)} ${bar(n, made)} ${String(n).padStart(5)} ${pct(n, made).padStart(7)}`);
  }

  console.log(`\n축별 분포`);
  for (const k of ["마음", "생활", "보완", "시기"] as AxisKey[]) {
    const parts = ["순", "평", "역", "모름"].map((v) => `${v} ${pct(axisDist[k].get(v) ?? 0, made)}`);
    console.log(`  ${k}  ${parts.join("  ")}`);
  }

  totals.sort((x, y) => x - y);
  const q = (p: number) => totals[Math.floor(totals.length * p)]?.toFixed(2);
  console.log(`\n총점 분포  최소 ${totals[0]?.toFixed(2)} · 25% ${q(0.25)} · 중앙 ${q(0.5)} · 75% ${q(0.75)} · 최대 ${totals[totals.length - 1]?.toFixed(2)}`);
  console.log(`중화된 축이 하나라도 있는 쌍: ${pct(neutralizedAny, made)}`);
  console.log(`  ※ 한쪽만 시간을 몰라도 중화된다 — 표본의 시간 미상 비율이 p 면 쌍 기준은 1-(1-p)² 이다.`);

  // ★경계를 감이 아니라 분포에서 뽑는다. 목표 비율을 주면 그 분위수를 경계로 제안한다.
  //   목표: 최상 10% · 상 25% · 중 35% · 하 22% · 최하 8%
  //   (맨 끝 단계가 0%면 5단계가 아니라 4단계짜리 상품이 된다)
  const TARGET = [0.10, 0.25, 0.35, 0.22, 0.08];
  const cuts: number[] = [];
  let acc = 0;
  for (let i = 0; i < TARGET.length - 1; i++) {
    acc += TARGET[i];
    const idx = Math.floor(totals.length * (1 - acc));
    cuts.push(Number(totals[Math.max(0, Math.min(totals.length - 1, idx))].toFixed(2)));
  }
  console.log(`\n제안 경계(목표 ${TARGET.map((t) => `${t * 100}%`).join("/")}): ${JSON.stringify(cuts)}`);
  console.log(`  현재 경계로 재현한 분포와 비교해 couple-decision.ts VERDICTS 를 갱신할 것.`);

  console.log(`\n${"=".repeat(64)}`);
  console.log(worst > 0.5
    ? `❌ 한 단계가 ${(worst * 100).toFixed(1)}% — 스펙 합격선(50%) 초과. 경계를 조정해야 한다.`
    : `✅ 최대 쏠림 ${(worst * 100).toFixed(1)}% — 스펙 합격선(50%) 이내.`);
  console.log(`※ 현재 경계: ${JSON.stringify([4.5, 1.5, -1.5, -4.5])} (couple-decision.ts VERDICTS)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
