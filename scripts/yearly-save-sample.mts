/**
 * 운영자 사주(癸未 일주) 기반 yearly 결과를 JSON으로 저장.
 * /yearly/preview 라우트가 이 JSON을 로드해서 결제·DB 없이 결과 페이지 렌더링.
 *
 * 사용:
 *   NODE_OPTIONS="--conditions=import" npx tsx scripts/yearly-save-sample.mts
 *
 * 출력: public/__dev__/yearly-sample.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// .env.local 로드
const envText = readFileSync(".env.local", "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  const value = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

const { runYearlyAnalysis } = await import("../lib/yearly-prompt");

const TARGET_YEAR = 2026;
const input = {
  name: "신갑주",
  birthYear: "1995", birthMonth: "06", birthDay: "21",
  calendarType: "solar" as const,
  birthHour: "16", birthMinute: "00",
  birthLocation: "서울",
  gender: "남성",
  relationshipStatus: "연애중",
  employmentStatus: "사업·프리랜서",
  coreFearAxis: "DISMISS" as const,
  unknownBirthTime: false,
};

const OUT_DIR = resolve(import.meta.dirname!, "../public/__dev__");
const OUT_PATH = resolve(OUT_DIR, "yearly-sample.json");

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log("[YEARLY_SAMPLE] LLM 분석 호출 중…");
  const t0 = Date.now();
  const result = await runYearlyAnalysis(input, TARGET_YEAR);
  console.log(`[YEARLY_SAMPLE] 완료 (${Date.now() - t0}ms)`);
  console.log(`  - tier: ${result.tier.grade} ${result.tier.composite}`);
  console.log(`  - sections: ${result.sections.length}개, 총 ${result.sections.reduce((s, x) => s + x.content.length, 0)}자`);
  console.log(`  - yearlyMeta: ${result.yearlyMeta.pillarKorean} ${result.yearlyMeta.tenStar} ${result.yearlyMeta.twelveStage}`);
  console.log(`  - monthlyFlow: ${result.monthlyFlow?.length ?? 0}개월`);

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\n✓ 저장: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("✗ 실패:", err?.stack || err);
  process.exit(1);
});
