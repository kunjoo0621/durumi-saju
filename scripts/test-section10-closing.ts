/**
 * 섹션 10 종합판정 클로징 톤 테스트
 *
 * 3명의 테스트 대상자를 분석하여 종합 섹션(index 9)의
 * 등급별 클로징 톤이 제대로 반영되는지 확인.
 *
 * 실행: npx tsx scripts/test-section10-closing.ts
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

// tsconfig paths 등록
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

import { runFullAnalysis } from "@/lib/analysis";
import type { InputPayload } from "@/lib/analysis";

// ─── 테스트 대상자 3명 ──────────────────────────────

const PERSON_1: InputPayload = {
  name: "신건주",
  birthYear: "1995",
  birthMonth: "6",
  birthDay: "21",
  calendarType: "solar",
  birthHour: "16",
  birthMinute: "30",
  birthLocation: "서울",
  gender: "M",
  relationshipStatus: "single",
  employmentStatus: "employed",
  coreFearAxis: "",
  unknownBirthTime: false,
};

const PERSON_2: InputPayload = {
  name: "이수진",
  birthYear: "1988",
  birthMonth: "11",
  birthDay: "3",
  calendarType: "solar",
  birthHour: "6",
  birthMinute: "0",
  birthLocation: "부산",
  gender: "F",
  relationshipStatus: "married",
  employmentStatus: "employed",
  coreFearAxis: "DISMISS",
  unknownBirthTime: false,
};

const PERSON_3: InputPayload = {
  name: "박준형",
  birthYear: "2000",
  birthMonth: "1",
  birthDay: "15",
  calendarType: "solar",
  birthHour: "23",
  birthMinute: "10",
  birthLocation: "대전",
  gender: "M",
  relationshipStatus: "single",
  employmentStatus: "unemployed",
  coreFearAxis: "ABANDON",
  unknownBirthTime: false,
};

const TEST_PERSONS = [PERSON_1, PERSON_2, PERSON_3];

// ─── 유틸 ─────────────────────────────────────────

function hr(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

// ─── 메인 ─────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  섹션 10 종합판정 클로징 톤 테스트 (3명)                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const FIXED_CLOSING = "바꿀 수 있는 건 사주가 아니라 네 다음 행동이야.";

  for (let i = 0; i < TEST_PERSONS.length; i++) {
    const person = TEST_PERSONS[i];
    hr(`[${i + 1}/3] ${person.name} (${person.birthYear}.${person.birthMonth}.${person.birthDay} ${person.birthHour}:${person.birthMinute})`);

    console.log("⏳ 분석 중...");
    const startTime = Date.now();

    try {
      const result = await runFullAnalysis(person);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ 분석 완료 (${elapsed}초)\n`);

      // 등급 정보
      console.log(`  종합등급: ${result.tier.grade} (composite: ${result.tier.composite}, 상위 ${result.tier.topPercent}%)`);
      console.log(`  점수:`, result.scores);

      // 섹션 10 (index 9) 전체 출력
      const section10 = result.sections[9];
      if (!section10) {
        console.log("  ❌ 섹션 10(index 9) 없음!");
        continue;
      }

      console.log(`\n  ${section10.icon} ${section10.title}`);
      console.log("─".repeat(60));
      console.log(section10.content);
      console.log("─".repeat(60));

      // 검증
      const content = section10.content;
      const hasFixedClosing = content.includes(FIXED_CLOSING);
      const paragraphs = content.split("\n\n").filter(p => p.trim().length > 0);
      const charLen = content.length;

      console.log(`\n  [검증]`);
      console.log(`  ${hasFixedClosing ? "✅" : "❌"} 고정 마무리 문장 포함`);
      console.log(`  ${paragraphs.length >= 4 ? "✅" : "⚠️"} 문단 수: ${paragraphs.length}개 (목표: 4문단)`);
      console.log(`  ${charLen >= 700 && charLen <= 1200 ? "✅" : "⚠️"} 글자 수: ${charLen}자 (목표: 700~1200자)`);

      // 마지막 문단 확인
      const lastParagraph = paragraphs[paragraphs.length - 1];
      console.log(`\n  [클로징 문단]`);
      console.log(`  "${lastParagraph.trim()}"`);

    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  ❌ 분석 실패 (${elapsed}초): ${err?.message || err}`);
    }
  }

  hr("테스트 완료");
}

main();
