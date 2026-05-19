/**
 * 라벨 변경 시각 확인용 — 실 데이터 변환 전후 비교
 * 운영자(신건주) + 무작위 사용자 2명의 결과를 transformGradeText 적용 전/후로 출력
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
// tsx ESM 캐시 버그 회피용 — gradeSystem.ts 의 두 함수만 인라인 재정의
const DISPLAY: Record<string, string> = { S: "SS", A: "S", B: "A", C: "B", D: "C" };
function safeDisplayGrade(grade: unknown, fallback = "?") {
  if (typeof grade !== "string") return fallback;
  const t = grade.trim();
  return DISPLAY[t] ?? (t || fallback);
}
function transformGradeText(text: string) {
  if (!text) return text;
  return text.replace(/(^|[^A-Za-z0-9_])([SABCD])(등급|급(?![가-힣]))/gu,
    (_m, lead, g, suffix) => `${lead}${DISPLAY[g] ?? g}${suffix}`);
}

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

// 1. 신건주 (운영자 본인)
const { data: owner } = await sb
  .from("saju_results")
  .select("id, name, full_json")
  .eq("name", "신건주")
  .not("full_json", "is", null)
  .limit(1);

// 2. 무작위 사용자 — 카테고리 등급 박혀 있는 raw 풀이 좋아하는 케이스
const { data: samples } = await sb
  .from("saju_results")
  .select("id, name, full_json")
  .not("full_json", "is", null)
  .gte("created_at", "2026-05-01")
  .order("created_at", { ascending: false })
  .limit(20);

// 본문에 등급 표기가 박힌 샘플 우선 선택
const goodSamples = (samples ?? []).filter((r: any) => {
  const fj = JSON.stringify(r.full_json);
  return /[SABCD]등급/.test(fj);
}).slice(0, 2);

const all = [...(owner ?? []), ...goodSamples];

for (const r of all) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`이름: ${r.name}  id: ${r.id.slice(0, 8)}`);
  console.log("═".repeat(80));

  const tier = (r.full_json as any).tier;
  console.log(`\n[종합 등급]`);
  console.log(`  옛 표시: ${tier.grade}등급`);
  console.log(`  새 표시: ${safeDisplayGrade(tier.grade)}등급`);
  console.log(`  composite: ${tier.composite}  topPercent: ${tier.topPercent}%`);

  console.log(`\n[tier.title]  (변환 대상 아님)`);
  console.log(`  ${tier.title}`);

  console.log(`\n[tier.description]`);
  console.log(`  옛: ${tier.description}`);
  console.log(`  새: ${transformGradeText(tier.description)}`);

  // scores 카테고리별 등급
  const scores = (r.full_json as any).scores;
  if (scores) {
    console.log(`\n[카테고리별 등급]`);
    for (const [k, v] of Object.entries(scores)) {
      if (v && typeof v === "object") {
        const g = (v as any).grade;
        const s = (v as any).score;
        console.log(`  ${k.padEnd(8)} ${s}점  ${g}등급 → ${safeDisplayGrade(g)}등급`);
      }
    }
  }

  // 섹션 본문 중 등급 박힌 부분 추출
  const sections = (r.full_json as any).sections ?? [];
  console.log(`\n[풀이 본문 등급 표기 변환 샘플]`);
  let printed = 0;
  for (const sec of sections) {
    if (typeof sec?.content !== "string") continue;
    const lines = sec.content.split(/\n+/);
    for (const line of lines) {
      if (/[SABCD]등급/.test(line) && printed < 4) {
        const transformed = transformGradeText(line);
        if (line !== transformed) {
          console.log(`  [섹션: ${sec.title}]`);
          console.log(`  옛: ${line.trim()}`);
          console.log(`  새: ${transformed.trim()}`);
          console.log("");
          printed++;
        }
      }
    }
    if (printed >= 4) break;
  }
}

console.log(`\n${"═".repeat(80)}`);
console.log("dev 서버 확인: http://localhost:3000/my/results");
