/**
 * 올해의 운세 dry-run.
 * 운영자 본인 사주(1995-06-21 양력, 시주 庚申)로 2026 丙午 세운 풀이를 끝까지 실행.
 * DB 저장 없이 lib/yearly-prompt::runYearlyAnalysis 만 호출 → 결과 콘솔 출력.
 *
 * 사전 조건: .env.local 의 GEMINI_API_KEY 가 유효해야 함.
 */
import { readFileSync } from "fs";

// .env.local 로드 (battle-myo-llm-test.mts 패턴 — 따옴표 stripping 포함)
const envText = readFileSync(".env.local", "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  const value = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

const { runYearlyAnalysis } = await import("../lib/yearly-prompt");
const { resolveSajuEnrichedData } = await import("../lib/analysis");
const { calculateServerScoring } = await import("../lib/utils/saju-scoring");
const { calculateYearlyInteraction, buildYearlyContextBlock } = await import("../lib/utils/yearly-interaction");

const TARGET_YEAR = 2026;

const input = {
  name: "신갑주",
  birthYear: "1995",
  birthMonth: "06",
  birthDay: "21",
  calendarType: "solar" as const,
  birthHour: "16",     // 申시 = 15~17. 운영자 메모 상 시주 庚申. 16:00으로 가정.
  birthMinute: "00",
  birthLocation: "서울",
  gender: "남자",
  relationshipStatus: "연애중",
  employmentStatus: "사업·프리랜서",
  coreFearAxis: "DISMISS" as const,
  unknownBirthTime: false,
};

function dump(label: string, value: any) {
  console.log(`\n${"=".repeat(8)} ${label} ${"=".repeat(8)}`);
  console.log(value);
}

async function main() {
  // 1) 원국 enriched + 세운 검증 (계산식 일치 보장 부분)
  const { sajuText, enriched, fortune } = await resolveSajuEnrichedData(input);
  if (!enriched) {
    console.error("✗ enriched 계산 실패");
    process.exit(1);
  }
  dump("원국 4주", enriched.pillars);
  dump("일간", enriched.dayMaster);
  dump("오행 분포", enriched.elementDist);
  dump("용신", enriched.yongshin);
  console.log("\n사주 텍스트 헤드:\n", sajuText?.split("\n").slice(0, 8).join("\n"));

  // 2) 점수/등급 (운영자 메모 vs 재계산 일치 확인)
  const { scores, tier } = calculateServerScoring(enriched);
  dump("서버 점수", scores);
  dump("서버 등급", tier);
  console.log("\n[검증] 운영자 메모 vs 재계산");
  console.log(`  composite: 메모 89 vs 실측 ${tier.composite} (${tier.composite === 89 ? "✓" : "✗ 차이 — v15→v16 변경 영향 가능"})`);
  console.log(`  직장운: 메모 85 vs 실측 ${scores.직장운}`);
  console.log(`  연애운: 메모 65 vs 실측 ${scores.연애운}`);

  // 3) 2026 세운 추출
  const seun = fortune?.seun?.find((s: any) => s.year === TARGET_YEAR);
  if (!seun) {
    console.error("✗ 2026 세운 데이터 없음");
    process.exit(1);
  }
  dump("2026 세운", seun);
  console.log(`\n[검증] 운영자 메모 vs 실측`);
  console.log(`  세운: 메모 丙午 정재 / 12운성 절 vs 실측 ${seun.pillar} ${seun.tenStar} / 12운성 ${seun.twelveStage}`);

  // 4) 세운×원국 상호작용
  const interaction = calculateYearlyInteraction(enriched, seun);
  dump("세운×원국 상호작용", {
    stems: interaction.stemInteractions,
    branches: interaction.branchInteractions,
    napum: interaction.napum,
  });
  console.log("\n----- yearlyContextBlock (LLM 입력) -----");
  console.log(buildYearlyContextBlock(interaction));

  // 5) LLM 호출 (실제 분석)
  console.log("\n\n========== LLM 분석 호출 (Gemini) ==========");
  const t0 = Date.now();
  const full = await runYearlyAnalysis(input, TARGET_YEAR);
  console.log(`소요 ${(Date.now() - t0) / 1000}s`);

  dump("tier", full.tier);
  dump("scores (원국 그대로)", full.scores);
  dump("yearlyMeta", full.yearlyMeta);
  dump("luckyMeta", full.luckyMeta);

  console.log("\n========== sections ==========");
  for (let i = 0; i < full.sections.length; i++) {
    const s = full.sections[i];
    console.log(`\n--- [${i + 1}] ${s.icon} ${s.title} (${s.content.length}자) ---`);
    console.log(s.content);
  }

  // 6) 품질 진단
  console.log("\n\n========== 품질 진단 ==========");
  const totalChars = full.sections.reduce((sum, s) => sum + s.content.length, 0);
  console.log(`총 본문 ${totalChars}자 (목표 5500~7500)`);
  for (const s of full.sections) {
    const isLast = s === full.sections[full.sections.length - 1];
    const target = isLast ? "1000~1400" : "600~900";
    console.log(`  ${s.icon} ${s.title}: ${s.content.length}자 (목표 ${target})`);
  }

  const monthRegex = /(\d+월|\d+~\d+월|봄|여름|가을|겨울|상반기|하반기|초반|중반|후반)/g;
  for (const s of full.sections) {
    const matches = s.content.match(monthRegex) ?? [];
    console.log(`  ${s.icon} ${s.title}: 시기 표현 ${matches.length}회 ${matches.length === 0 ? "✗ (의무 미달)" : "✓"}`);
  }

  const threatPatterns = [
    /안 ~?[가-힣]+면 [가-힣]+ 거다/,
    /후회할 때는 이미/,
    /평생 [가-힣]+ 못/,
    /영원히/,
  ];
  for (const s of full.sections) {
    for (const re of threatPatterns) {
      if (re.test(s.content)) {
        console.log(`  ⚠ ${s.icon} ${s.title}: 협박 어미 의심 (${re.source})`);
      }
    }
  }

  console.log("\n✓ dry-run 완료");
}

main().catch((err) => {
  console.error("\n✗ dry-run 실패:", err?.stack || err);
  process.exit(1);
});
