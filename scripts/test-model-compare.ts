/**
 * Gemini 모델 비교 테스트: 개인사주 분석
 * 실행: npx tsx scripts/test-model-compare.ts
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

import { runFullAnalysis } from "@/lib/analysis";
import { detectCrossSectionRepetition, charSimilarity } from "@/lib/surgical-rewrite";
import type { InputPayload } from "@/lib/analysis";

const INPUT: InputPayload = {
  name: "신건호",
  birthYear: "1998",
  birthMonth: "1",
  birthDay: "10",
  calendarType: "solar",
  birthHour: "4",
  birthMinute: "20",
  birthLocation: "",
  gender: "M",
  relationshipStatus: "single",
  employmentStatus: "job_seeking",
  coreFearAxis: "",
  unknownBirthTime: false,
};

async function main() {
  const models = process.env.GEMINI_MODELS || "?";
  console.log(`\n[모델 설정] GEMINI_MODELS = ${models}`);
  console.log(`[테스트 대상] ${INPUT.name} / ${INPUT.birthYear}.${INPUT.birthMonth}.${INPUT.birthDay} ${INPUT.birthHour}:${INPUT.birthMinute} / 남 / 솔로 / 취준생\n`);

  console.log("⏳ 분석 중...");
  const start = Date.now();
  const result = await runFullAnalysis(INPUT);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ 분석 완료 (${elapsed}초)\n`);

  // 등급 & 점수
  console.log("═══ 등급 & 점수 ═══");
  console.log(`등급: ${result.tier.grade} (composite: ${result.tier.composite}, 상위 ${result.tier.topPercent}%)`);
  console.log(`타이틀: ${result.tier.title}`);
  console.log(`소개: ${result.tier.description}\n`);
  console.log("점수:", result.scores);

  // 섹션 상세
  console.log("\n═══ 섹션 상세 ═══");
  for (let i = 0; i < result.sections.length; i++) {
    const s = result.sections[i];
    console.log(`\n--- [${i}] ${s.icon} ${s.title} (${s.content.length}자) ---`);
    console.log(s.content);
  }

  // coreFearAxisBlock
  if (result.coreFearAxisBlock) {
    console.log("\n═══ coreFearAxisBlock ═══");
    console.log(result.coreFearAxisBlock);
  }

  // 품질 체크
  console.log("\n═══ 품질 체크 ═══");

  // 1. 섹션 길이
  const shortSections = result.sections.filter(s => s.content.length < 700);
  console.log(`  섹션 길이: ${shortSections.length === 0 ? "✅ 모두 700자+" : `⚠️ ${shortSections.length}개 미달`}`);
  for (const s of shortSections) {
    console.log(`    - "${s.title}" ${s.content.length}자`);
  }

  // 2. 반말 체크
  const formalPatterns = [/입니다/, /습니다/, /해요/, /거예요/, /돼요/];
  let formalCount = 0;
  for (const s of result.sections) {
    for (const p of formalPatterns) {
      if (p.test(s.content)) formalCount++;
    }
  }
  console.log(`  반말 톤: ${formalCount === 0 ? "✅ 존댓말 없음" : `⚠️ 존댓말 ${formalCount}건`}`);

  // 3. 해봐 체크
  const haebwaCount = result.sections.filter(s => /해\s?봐/.test(s.content)).length;
  console.log(`  해봐 패턴: ${haebwaCount === 0 ? "✅ 없음" : `⚠️ ${haebwaCount}개 섹션`}`);

  // 4. cross-section 반복 체크
  const crossReps = detectCrossSectionRepetition(result);
  console.log(`  섹션 간 반복: ${crossReps.length === 0 ? "✅ 없음" : `⚠️ ${crossReps.length}쌍 감지`}`);
  for (const rep of crossReps) {
    console.log(`    - 섹션 ${rep.sectionIndexA}("${result.sections[rep.sectionIndexA].title}") ↔ 섹션 ${rep.sectionIndexB}("${result.sections[rep.sectionIndexB].title}"): ${rep.similarPairs.length}쌍`);
    for (const p of rep.similarPairs.slice(0, 2)) {
      console.log(`      "${p.sentenceA.slice(0, 40)}..." ≈ "${p.sentenceB.slice(0, 40)}..." (${(p.similarity * 100).toFixed(0)}%)`);
    }
  }

  // 5. 타이틀 키워드 중복
  const titleWords = new Map<string, number>();
  for (const s of result.sections) {
    const words = s.title.replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 2);
    for (const w of new Set(words)) {
      titleWords.set(w, (titleWords.get(w) || 0) + 1);
    }
  }
  const dupTitleWords = [...titleWords].filter(([, c]) => c >= 3);
  console.log(`  타이틀 키워드 중복: ${dupTitleWords.length === 0 ? "✅ 없음" : `⚠️ ${dupTitleWords.map(([w, c]) => `"${w}"(${c}회)`).join(", ")}`}`);

  // 6. 전체 글자수
  const totalChars = result.sections.reduce((sum, s) => sum + s.content.length, 0);
  console.log(`  전체 글자수: ${totalChars}자 (평균 ${Math.round(totalChars / result.sections.length)}자/섹션)`);

  // JSON 저장
  const outPath = path.resolve(__dirname, `../test-result-flash-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n결과 저장: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ 에러:", err?.message || err);
  console.error(err?.stack);
  process.exit(1);
});
