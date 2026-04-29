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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({ baseUrl: path.resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths as Record<string, string[]> });

import { resolveSajuEnrichedData } from "@/lib/analysis";
import type { InputPayload } from "@/lib/analysis";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";

async function main() {
  const input: InputPayload = {
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

  console.log("⏳ 신건주 사주 계산 중...");
  const { enriched } = await resolveSajuEnrichedData(input);
  const scoring = calculateServerScoring(enriched);

  console.log("\n═══════════════════════════════════════");
  console.log("  신건주 (1995.06.21 16:30 남)");
  console.log("═══════════════════════════════════════");
  console.log(`  등급: ${scoring.tier.grade}`);
  console.log(`  종합점수: ${scoring.tier.composite}`);
  console.log(`  상위: ${scoring.tier.topPercent}%`);
  console.log(`  타이틀: ${scoring.tier.title}`);
  console.log(`\n  카테고리 점수:`);
  for (const [k, v] of Object.entries(scoring.scores)) {
    console.log(`    ${k}: ${v}점`);
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
