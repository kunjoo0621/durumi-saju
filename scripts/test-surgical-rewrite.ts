/**
 * 테스트: surgical rewrite before/after 확인
 *
 * 실행: npx tsx -r tsconfig-paths/register scripts/test-surgical-rewrite.ts
 */

import * as fs from "fs";
import * as path from "path";

// .env.local 수동 로드
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  // 따옴표 제거
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

import {
  detectKillingLinePattern,
  detectPunchlineDuplicates,
  detectDetailFirstSentence,
  charSimilarity,
} from "@/lib/surgical-rewrite";
import { surgicalRewriteBattle } from "@/lib/surgical-rewrite";
import type { BattleLlmAnalysis } from "@/types/battle";

// ─── 반복적인 killingLine을 가진 mock 데이터 ────

const MOCK_RESULT: BattleLlmAnalysis = {
  heroQuip: "건주 vs 민수, 사주 한판 뜬다!",
  categoryResults: {
    wealth: {
      killingLine: "건주가 12점 차이로 재물운 이겼어",
      detail: "건주의 재물운은 토(土) 기운이 탄탄해서 자산을 꾸준히 불려가는 구조야. 반면 민수는 수(水) 기운이 과해서 돈이 들어와도 빠져나가는 흐름이 강해. 장기전에서 건주가 훨씬 유리한 판이야.",
    },
    love: {
      killingLine: "건주가 8점 차이로 연애운 이겼어",
      detail: "건주의 연애 기운은 목(木)이 살아있어서 감정 표현이 자연스러워. 상대방 마음을 읽는 감각도 뛰어나지. 민수는 금(金) 기운이 강해서 감정 표현이 좀 딱딱한 편이야.",
    },
    career: {
      killingLine: "건주가 5점 차이로 직장운 이겼어",
      detail: "건주의 직장운은 관성(官星)이 제대로 자리 잡아서 조직 안에서 인정받는 구조야. 민수도 나쁘진 않지만 편인 기운이 튀어나와서 상사랑 자주 부딪히는 패턴이 보여.",
    },
    health: {
      killingLine: "건주의 건강운이 압도적이야",
      detail: "건주는 화(火) 기운과 토(土) 기운의 밸런스가 좋아서 기초 체력이 탄탄해. 민수는 목(木) 기운이 지나쳐서 간 쪽에 부담이 갈 수 있어. 건주가 건강 관리 면에서 한 수 위야.",
    },
    social: {
      killingLine: "건주가 3점 차이로 대인운 이겼어",
      detail: "건주는 식신(食神) 기운이 살아있어서 사람들한테 인기가 많아. 자연스럽게 어울리는 스타일이지. 민수는 비겁(比劫)이 강해서 혼자 있는 걸 더 편해하는 구조야.",
    },
  },
  chemistry: {
    punchline: "이 둘은 서로 없는 걸 채워주는 조합이야",
    analysis: "건주의 토(土)와 민수의 수(水)가 만나면 서로 부족한 부분을 보완하는 관계가 돼. 다만 너무 가까우면 기운이 충돌할 수도 있어서 적당한 거리가 필요해.",
    bonusScenarios: [
      {
        type: "travel",
        label: "같이 여행 가면?",
        punchline: "건주가 일정 짜고 민수가 분위기 띄우는 꿀조합",
        analysis: "계획형 건주와 자유형 민수의 여행은 서로 장점이 살아나는 구조야.",
      },
      {
        type: "business",
        label: "같이 사업하면?",
        punchline: "건주가 관리하고 민수가 영업 뛰면 시너지 폭발",
        analysis: "건주의 안정적인 관리 능력과 민수의 추진력이 합쳐지면 사업이 잘 될 구조야.",
      },
    ],
  },
  simulations: [
    {
      question: "둘이 같이 로또 사면 누가 당첨될까?",
      punchline: "건주 손에서 당첨 번호가 나올 확률이 높아",
      reasoning: "건주의 편재 기운이 횡재수에 유리한 구조야.",
      basis: "건주 편재(偏財) 기운 우세",
    },
    {
      question: "무인도에 둘만 남으면?",
      punchline: "건주가 집 짓고 민수가 식량 구해올 거야",
      reasoning: "건주의 실용적 기질과 민수의 행동력이 합쳐지면 생존력 최강이야.",
      basis: "건주 식신, 민수 겁재 기운 상호보완",
    },
    {
      question: "10년 뒤 누가 더 성공했을까?",
      punchline: "건주가 안정적으로, 민수가 파란만장하게 성공해있어",
      reasoning: "건주는 꾸준한 성장형, 민수는 대박 아니면 쪽박 스타일이야.",
      basis: "건주 정관(正官) vs 민수 편관(偏官)",
    },
    {
      question: "둘이 게임하면 누가 이길까?",
      punchline: "순발력은 민수가 앞서지만 전략 게임은 건주가 잡아",
      reasoning: "민수의 겁재 기운은 순발력에 유리하고, 건주의 정인 기운은 전략에 유리해.",
      basis: "건주 정인(正印) vs 민수 겁재(劫財)",
    },
    {
      question: "비밀을 말하면 누가 더 잘 지킬까?",
      punchline: "건주 입은 금고급이야, 민수는... 글쎄",
      reasoning: "건주의 정인 기운은 비밀 유지에 탁월하고, 민수의 식신 기운은 말이 술술 나오는 구조야.",
      basis: "건주 정인(正印) vs 민수 식신(食神)",
    },
  ],
  futureOutlook: {
    punchline: "2026년은 건주에게 전환점이 되는 해야",
    timeline: [
      { year: 2025, label: "준비기", eventA: "기반 다지기", eventB: "새 시작", relationship: "서로 응원", mood: "neutral" },
      { year: 2026, label: "도약기", eventA: "승진 가능성", eventB: "이직 기회", relationship: "경쟁 의식", mood: "up" },
      { year: 2027, label: "안정기", eventA: "재물 증가", eventB: "안정 추구", relationship: "협력 관계", mood: "up" },
    ],
  },
  finalVerdict: {
    punchline: "건주가 한 발 앞서지만, 민수도 만만치 않은 상대야",
    verdict: "건주 3승 1패 1무. 전체적으로 건주가 우세하지만 민수도 건강운에서 선전했어. 서로 다른 강점을 가진 좋은 라이벌이야.",
  },
};

// ─── 테스트 실행 ─────────────────────────────────

async function main() {
  const names = ["건주", "민수"];

  console.log("=" .repeat(70));
  console.log("  SURGICAL REWRITE 테스트 — killingLine 반복 케이스");
  console.log("=".repeat(70));

  // ── Step 1: 감지 결과 확인 ──
  console.log("\n▶ [감지 1] killingLine 어미 반복");
  const klResult = detectKillingLinePattern(MOCK_RESULT.categoryResults, names);
  console.log("  needsRewrite:", klResult.needsRewrite);
  console.log("  targets:", klResult.targets);
  console.log("  pattern:", klResult.pattern);

  console.log("\n▶ [감지 2] punchline 중복");
  const plResult = detectPunchlineDuplicates(MOCK_RESULT, names);
  console.log("  needsRewrite:", plResult.needsRewrite);
  console.log("  targets:", plResult.targets.map((t) => t.path));

  console.log("\n▶ [감지 3] detail 첫 문장 반복");
  const dtResult = detectDetailFirstSentence(MOCK_RESULT.categoryResults);
  console.log("  needsRewrite:", dtResult.needsRewrite);
  console.log("  targets:", dtResult.targets);

  // ── Step 2: 유사도 디테일 ──
  console.log("\n▶ [참고] killingLine 어미 분석:");
  for (const cat of ["wealth", "love", "career", "health", "social"] as const) {
    const kl = MOCK_RESULT.categoryResults[cat].killingLine;
    const ending = kl.trim().slice(-3);
    console.log(`  ${cat.padEnd(8)} → 어미 "${ending}" → "${kl}"`);
  }

  console.log("\n▶ [참고] killingLine pairwise 유사도 (이름 마스킹 후):");
  const cats = ["wealth", "love", "career", "health", "social"] as const;
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = MOCK_RESULT.categoryResults[cats[i]].killingLine
        .replace(/건주/g, "__NAME__").replace(/민수/g, "__NAME__");
      const b = MOCK_RESULT.categoryResults[cats[j]].killingLine
        .replace(/건주/g, "__NAME__").replace(/민수/g, "__NAME__");
      const sim = charSimilarity(a, b);
      if (sim > 0.3) {
        console.log(`  ${cats[i]} ↔ ${cats[j]}: ${(sim * 100).toFixed(1)}%`);
      }
    }
  }

  // 리라이트 대상이 없으면 mock을 더 극단적으로 조정
  if (!klResult.needsRewrite && !plResult.needsRewrite && !dtResult.needsRewrite) {
    console.log("\n⚠ 감지된 대상 없음 — 원본 데이터가 충분히 다양합니다.");
    console.log("  (실제 Gemini가 생성하는 반복적 데이터에서 발동됩니다)");
    return;
  }

  // ── Step 3: BEFORE 출력 ──
  console.log("\n" + "─".repeat(70));
  console.log("  BEFORE (원본)");
  console.log("─".repeat(70));

  for (const cat of cats) {
    console.log(`\n  [${cat}]`);
    console.log(`    killingLine: "${MOCK_RESULT.categoryResults[cat].killingLine}"`);
    console.log(`    detail 첫줄: "${MOCK_RESULT.categoryResults[cat].detail.slice(0, 60)}..."`);
  }

  // ── Step 4: Gemini 리라이트 호출 ──
  console.log("\n" + "─".repeat(70));
  console.log("  Gemini API 호출 중...");
  console.log("─".repeat(70));

  const warnings: string[] = [];
  const rewritten = await surgicalRewriteBattle(
    MOCK_RESULT,
    warnings,
    { nameA: "건주", nameB: "민수", relationshipType: "friend" },
  );

  // ── Step 5: AFTER 출력 ──
  console.log("\n" + "─".repeat(70));
  console.log("  AFTER (리라이트 후)");
  console.log("─".repeat(70));

  for (const cat of cats) {
    const before = MOCK_RESULT.categoryResults[cat].killingLine;
    const after = rewritten.categoryResults[cat].killingLine;
    const changed = before !== after;
    console.log(`\n  [${cat}] ${changed ? "✦ CHANGED" : "(유지)"}`);
    console.log(`    killingLine: "${after}"`);
    if (changed) {
      console.log(`    (원본: "${before}")`);
    }

    const detBefore = MOCK_RESULT.categoryResults[cat].detail;
    const detAfter = rewritten.categoryResults[cat].detail;
    if (detBefore !== detAfter) {
      console.log(`    detail: ✦ CHANGED`);
      console.log(`      첫줄: "${detAfter.slice(0, 60)}..."`);
      console.log(`      (원본: "${detBefore.slice(0, 60)}...")`);
    }
  }

  // ── Step 6: 기타 punchline 변경 ──
  const otherPaths = [
    "chemistry.punchline",
    "futureOutlook.punchline",
    "finalVerdict.punchline",
    "heroQuip",
  ];
  const changedOthers: string[] = [];
  for (const p of otherPaths) {
    const before = getByPath(MOCK_RESULT, p);
    const after = getByPath(rewritten, p);
    if (before !== after) changedOthers.push(`${p}: "${after}"`);
  }
  if (changedOthers.length > 0) {
    console.log("\n  [기타 punchline 변경]");
    for (const c of changedOthers) console.log(`    ✦ ${c}`);
  }

  // ── Step 7: 경고 출력 ──
  if (warnings.length > 0) {
    console.log("\n" + "─".repeat(70));
    console.log("  WARNINGS");
    console.log("─".repeat(70));
    for (const w of warnings) console.log(`  ${w}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("  테스트 완료");
  console.log("=".repeat(70));
}

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

main().catch((err) => {
  console.error("테스트 실패:", err);
  process.exit(1);
});
