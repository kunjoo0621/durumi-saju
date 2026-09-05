// couple 하네스 — 실제 두 원국으로 리포트를 프로덕션 경로 그대로 생성한다.
// analyze 라우트의 4)~5) 단계(facts → decision → prompt → generateWithQaRegen → 가드)를
// 결제·DB 없이 재현. scripts/career-report-probe.ts 미러.
//
// 실행: TZ=UTC npx tsx scripts/couple-report-probe.ts
//
// ★왜 필요한가: 지금까지 이 상품의 실제 리포트를 한 번도 안 뽑아봤다. 코드 리뷰로는
//   LLM 출력 결함이 안 보인다 — 사내 실측이 그걸 증명한다(프롬프트에 적은 예시가
//   리포트 21.5%에 그대로 복제, "겉/속" 골격 61%). 분량 스펙·가드 임계를 감으로
//   정하지 않으려면 baseline 을 먼저 재야 한다.

import { config } from "dotenv";
config({ path: ".env.local" });

import { callGemini, DEFAULT_MODELS, shouldFallback } from "../lib/analysis";
import { parseJson5Loose } from "../lib/json5Utils";
import { decideCouple } from "../lib/pair/couple-decision";
import { applyCoupleGuards, validateCoupleBlocks, validateCoupleRichness } from "../lib/pair/couple-postprocess";
import { buildCoupleFactsBlock, buildCouplePrompt } from "../lib/pair/couple-prompt";
import { derivePairFacts, type Sex } from "../lib/pair/pair-facts";
import { computePartnerChart } from "../lib/pair/couple-charts";
import { deriveMarriageFacts } from "../lib/marriage-facts";
import { generateWithQaRegen } from "../lib/qa-regen";

const SYSTEM =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

const CURRENT_YEAR = 2026;

type Person = {
  label: string;
  name: string;
  y: string; m: string; d: string;
  hh?: string; mm?: string;
  unknownTime?: boolean;
  gender: "남성" | "여성";
};

// 층화 케이스 — 판정이 갈리는 조합을 일부러 섞는다.
const CASES: Array<{ title: string; a: Person; b: Person }> = [
  {
    title: "① 시간 둘 다 앎",
    a: { label: "A", name: "민수", y: "1995", m: "6", d: "21", hh: "16", mm: "0", gender: "남성" },
    b: { label: "B", name: "지영", y: "1996", m: "11", d: "3", hh: "9", mm: "30", gender: "여성" },
  },
  {
    title: "② 상대 시간 모름 (축 중화)",
    a: { label: "A", name: "민수", y: "1995", m: "6", d: "21", hh: "16", mm: "0", gender: "남성" },
    b: { label: "B", name: "다혜", y: "1990", m: "2", d: "14", unknownTime: true, gender: "여성" },
  },
  {
    title: "③ 부딪히는 조합",
    a: { label: "A", name: "준호", y: "1988", m: "5", d: "6", hh: "1", mm: "0", gender: "남성" },
    b: { label: "B", name: "서연", y: "1994", m: "11", d: "12", hh: "22", mm: "0", gender: "여성" },
  },
];

function toPartnerInput(p: Person) {
  return {
    name: p.name,
    birthYear: p.y, birthMonth: p.m, birthDay: p.d,
    birthHour: p.unknownTime ? undefined : p.hh,
    birthMinute: p.unknownTime ? undefined : p.mm,
    gender: p.gender,
    calendarType: "solar",
    unknownBirthTime: Boolean(p.unknownTime),
  };
}

function count(s: unknown): number {
  return typeof s === "string" ? s.replace(/\s/g, "").length : 0;
}

async function runCase(c: (typeof CASES)[number]) {
  console.log(`\n${"=".repeat(78)}\n${c.title}\n${"=".repeat(78)}`);

  const ca = await computePartnerChart(toPartnerInput(c.a));
  const cb = await computePartnerChart(toPartnerInput(c.b));
  if (!ca.ok || !cb.ok) {
    console.error("원국 계산 실패");
    return null;
  }
  console.log(`원국 A: ${["year","month","day","hour"].map(k => (ca.enriched.pillars as never)[k] ?? "—").join(" ")}`);
  console.log(`원국 B: ${["year","month","day","hour"].map(k => (cb.enriched.pillars as never)[k] ?? "—").join(" ")}`);

  const sexA: Sex = c.a.gender === "여성" ? "female" : "male";
  const timing = (chart: typeof ca, sex: Sex) => {
    if (!chart.ok) return [];
    try {
      return deriveMarriageFacts(chart.enriched, chart.fortune, chart.saju, sex, "솔로", CURRENT_YEAR).timingWindows;
    } catch (e) {
      console.error("  타이밍 산출 실패:", (e as Error).message);
      return [];
    }
  };

  const facts = derivePairFacts(ca.enriched, cb.enriched, {
    currentYear: CURRENT_YEAR,
    sexA, sexB: cb.sex,
    timingA: timing(ca, sexA),
    timingB: timing(cb, cb.sex),
    timingAvailable: Boolean(ca.fortune) && Boolean(cb.fortune),
  });
  const decision = decideCouple(facts);

  console.log(`\n판정: ${decision.verdict}  (총점 ${decision.total})`);
  console.log(`축: ${(["마음","생활","보완","시기"] as const).map(k => `${k}=${decision.axes[k].verdict}`).join(" · ")}`);
  console.log(`중화된 축: ${decision.neutralized.length ? decision.neutralized.join("·") : "없음"}`);
  console.log(`둘 다 열리는 해: ${facts.fortuneCross.timingOverlapYears.join(", ") || "없음"}`);
  console.log(`걸리는 자리: ${facts.branchMatrix.length}칸`);

  const names = { nameA: c.a.name, nameB: c.b.name };
  console.log(`\n──── 사실 블록 ────\n${buildCoupleFactsBlock(facts, decision, names)}`);

  const prompt = buildCouplePrompt(facts, decision, names);
  const allowedYears = facts.fortuneCross.timingOverlapYears;

  const AXIS_BLOCK: Record<string, string> = { 마음: "mindScene", 생활: "lifeScene", 보완: "complement", 시기: "timing" };
  const deadBlocks = decision.neutralized.map((a) => AXIS_BLOCK[a]).filter(Boolean);

  const envModels = (process.env.GEMINI_MODELS || "").split(",").map(m => m.trim()).filter(Boolean);
  const models = envModels.length > 0 ? envModels : DEFAULT_MODELS;

  const gen = await generateWithQaRegen<Record<string, unknown>>({
    prompt,
    systemPrompt: SYSTEM,
    models,
    temperature: 0.75,
    callModel: (model, p, sys, cfg) => callGemini(model, p, sys, cfg),
    shouldFallback,
    parse: (text) => parseJson5Loose<Record<string, unknown>>(text),
    validateBlocks: (cand) => validateCoupleBlocks(cand, { deadBlocks }),
    softValidate: (cand) => validateCoupleRichness(cand),
    applyGuards: (cand) => applyCoupleGuards(cand, { allowedYears, currentYear: CURRENT_YEAR }),
  });

  if (!gen.ok) {
    console.error("\n❌ 생성 실패:", gen.error);
    return null;
  }

  const b = gen.blocks as Record<string, unknown>;
  console.log(`\n──── 생성 결과 (재생성 ${gen.attempts}회) ────`);
  if (gen.violations.length) console.log(`⚠ 잔존 위반: ${gen.violations.join(" / ")}`);

  const lens: Record<string, number> = {};
  for (const k of ["headline", "mindScene", "lifeScene", "complement", "timing"]) {
    lens[k] = count(b[k]);
    console.log(`\n【${k}】(${lens[k]}자)\n${b[k]}`);
  }
  const advice = Array.isArray(b.advice) ? b.advice : [];
  console.log(`\n【advice】(${advice.length}개)`);
  advice.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

  const total = Object.values(lens).reduce((s, n) => s + n, 0) + advice.reduce((s: number, a) => s + count(a), 0);
  console.log(`\n총 ${total}자`);

  // 한자 누출 검사 — 가드에 없어서 여기서 잰다
  const dumped = JSON.stringify(b);
  const hanja = dumped.match(/[一-鿿]/g) ?? [];
  console.log(`한자 누출: ${hanja.length}자 ${hanja.length ? `(${[...new Set(hanja)].join("")})` : ""}`);

  // 두 이름 동시 등장 — 이 상품의 무기가 실제로 살아 있는지
  const bothNames = ["mindScene", "lifeScene", "complement"].filter(
    (k) => typeof b[k] === "string" && (b[k] as string).includes(c.a.name) && (b[k] as string).includes(c.b.name),
  );
  console.log(`두 이름 동시 등장 블록: ${bothNames.length}/3 (${bothNames.join(",") || "없음"})`);

  return { title: c.title, total, lens, adviceCount: advice.length, hanja: hanja.length, bothNames: bothNames.length, violations: gen.violations, attempts: gen.attempts };
}

async function main() {
  const rows = [];
  for (const c of CASES) {
    const r = await runCase(c);
    if (r) rows.push(r);
  }
  console.log(`\n${"=".repeat(78)}\n요약\n${"=".repeat(78)}`);
  for (const r of rows) {
    console.log(
      `${r.title.padEnd(24)} 총 ${String(r.total).padStart(5)}자 · advice ${r.adviceCount}개 · ` +
      `한자 ${r.hanja} · 두이름 ${r.bothNames}/3 · 재생성 ${r.attempts} · 위반 ${r.violations.length}`,
    );
  }
  console.log("\n※ 비교: marriage(10알)는 블록당 400~550자 요구 + 총량 1900자 soft 하한.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
