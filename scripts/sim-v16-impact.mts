/**
 * v15 → v16 변경의 시뮬레이션 영향 분석
 * 변경 1: 결핍 페널티 -4 → -3 (× count)
 * 변경 2: 극편중 추가 -5 → -2 (편중 -6 + 극편중 -2 = -8)
 * 변경 3: 형 이중 페널티 단일화 (편관+형 발동 시 형살 -4 제외)
 * 변경 4: 게이트 3 (최저 ≤39 → -1 등급) 제거
 *
 * 한계: 재계산 못 하고, 저장된 카테고리 점수 + 등급에서 변동 추정
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows } = await sb
  .from("saju_results")
  .select("name, full_json")
  .not("full_json", "is", null)
  .limit(5000);

let total = 0;
let dCount = 0;
let dGate3Only = 0;
let healthScoreUnder40 = 0;

const COMPOSITE_GRADE = (c: number) => c >= 86 ? "S" : c >= 80 ? "A" : c >= 69 ? "B" : c >= 45 ? "C" : "D";
const distBefore: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const distAfter: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const transitions: Record<string, number> = {};

for (const r of rows ?? []) {
  const fj = (r as any).full_json;
  const grade = fj?.tier?.grade;
  const composite = fj?.tier?.composite;
  const scores = fj?.scores ?? {};
  if (!grade || typeof composite !== "number") continue;
  total++;

  const vals = Object.values(scores).filter((v) => typeof v === "number") as number[];
  const minScore = vals.length ? Math.min(...vals) : 100;
  const dCatCount = vals.filter((v) => v <= 44).length;

  // 건강운 산식 변동은 정확히 추정 불가 (구조 정보 필요).
  // 근사: 건강운 ≤39인 사용자에게 +6 추정 (양미선·양미현 사례 기반).
  const healthAdj = (typeof scores["건강운"] === "number" && scores["건강운"] <= 39) ? 6
                  : (typeof scores["건강운"] === "number" && scores["건강운"] <= 44) ? 4
                  : 2;
  const newHealth = Math.min(88, (scores["건강운"] ?? 60) + healthAdj);

  // composite 변화 추정: 건강운 가중치 0.15 변화분
  const compositeShift = Math.round((newHealth - (scores["건강운"] ?? 60)) * 0.15);
  let newComposite = composite + compositeShift;

  // 게이트 3 제거 효과: 기존 D 등급 + 게이트 3만 발동된 사람들 → 등급 회복
  let newGrade = grade;
  if (grade === "D") {
    dCount++;
    // 게이트 3 단독 발동 추정: D카테고리 < 3개 + 최저 ≤39 + risk < 80
    if (dCatCount < 3 && minScore <= 39) {
      dGate3Only++;
      // 강등 이전 composite 추정 — clamp 풀고 +3~5 정도 회복
      newComposite = Math.max(45, newComposite + 3);
      newGrade = COMPOSITE_GRADE(newComposite);
    }
  }
  if (typeof scores["건강운"] === "number" && scores["건강운"] <= 39) healthScoreUnder40++;

  // grade가 안 바뀐 경우 등급은 그대로 + composite만 약간 변동
  if (grade === newGrade) {
    newGrade = COMPOSITE_GRADE(newComposite);
    if (newGrade !== grade) {
      // 등급 경계 넘어선 케이스만 변동
    } else {
      newGrade = grade;
    }
  }

  distBefore[grade]++;
  distAfter[newGrade]++;
  if (grade !== newGrade) {
    const k = `${grade} → ${newGrade}`;
    transitions[k] = (transitions[k] ?? 0) + 1;
  }
}

console.log(`전체: ${total}건`);
console.log(`현재 D: ${dCount}건`);
console.log(`  └ 게이트 3 단독 발동 (v16에서 D→C 회복): ${dGate3Only}건`);
console.log(`현재 건강운 ≤39: ${healthScoreUnder40}건 (v16에서 +5~7 회복 예상)\n`);

console.log("=== 등급 분포 추정 (v15 → v16) ===");
console.log("등급   v15        v16        변화");
for (const g of ["S", "A", "B", "C", "D"]) {
  const b = distBefore[g];
  const a = distAfter[g];
  const diff = a - b;
  const sign = diff > 0 ? "+" : "";
  console.log(`  ${g}    ${String(b).padStart(3)}건     ${String(a).padStart(3)}건     ${sign}${diff}`);
}

console.log("\n=== 등급 변동 ===");
for (const [k, v] of Object.entries(transitions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}  ${v}건`);
}
