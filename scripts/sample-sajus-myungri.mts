/**
 * 실 사용자 사주 샘플링 — 명리학 기준 평가용 데이터 추출
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

// 등급별로 다양하게 샘플링
const { data: rows } = await sb
  .from("saju_results")
  .select("name, gender, birth_date, saju_text, full_json")
  .not("full_json", "is", null)
  .order("created_at", { ascending: false })
  .limit(100);

const samples: Array<{
  name: string;
  gender: string;
  birth: string;
  pillars: string;
  ilgan: string;
  ohaeng: string;
  shinkang: string;
  yongshin: string;
  composite: number;
  grade: string;
  scores: any;
}> = [];

for (const r of (rows ?? []) as any[]) {
  const t = r.saju_text;
  if (!t) continue;
  const pillarMatch = t.match(/년주:\s*(\S+)\s*\/\s*월주:\s*(\S+)\s*\/\s*일주:\s*(\S+)\s*\/\s*시주:\s*(\S+)/);
  const ilganMatch = t.match(/일간:\s*(\S+)/);
  const ohaengMatch = t.match(/오행분포:\s*([^\n]+)/);
  const shinkangMatch = t.match(/신강\/신약:\s*(\S+)/);
  if (!pillarMatch || !ilganMatch) continue;

  const composite = r.full_json?.tier?.composite;
  const grade = r.full_json?.tier?.grade;
  if (typeof composite !== "number") continue;

  samples.push({
    name: r.name,
    gender: r.gender,
    birth: r.birth_date,
    pillars: `${pillarMatch[1]} ${pillarMatch[2]} ${pillarMatch[3]} ${pillarMatch[4]}`,
    ilgan: ilganMatch[1],
    ohaeng: ohaengMatch?.[1] ?? "",
    shinkang: shinkangMatch?.[1] ?? "",
    yongshin: t.match(/용신:[^\n]+/)?.[0] ?? "",
    composite,
    grade,
    scores: r.full_json?.scores,
  });
}

// 등급별 분포 확인
const byGrade: Record<string, typeof samples> = { S: [], A: [], B: [], C: [], D: [] };
for (const s of samples) byGrade[s.grade]?.push(s);

console.log(`\n총 ${samples.length}건 샘플링\n`);
console.log("등급별 분포:");
for (const g of ["S", "A", "B", "C", "D"]) {
  console.log(`  ${g}: ${byGrade[g]?.length ?? 0}건`);
}

// 각 등급에서 2건씩 뽑기 (운영자 본인 신건주 제외)
console.log("\n━━━ 등급별 샘플 (운영자 신건주 제외) ━━━\n");
const picked: typeof samples = [];
for (const g of ["S", "A", "B", "C", "D"]) {
  const filtered = (byGrade[g] ?? []).filter((s) => !s.name?.includes("신건주") && !s.name?.includes("신갑주"));
  picked.push(...filtered.slice(0, 2));
}

for (const s of picked) {
  console.log(`[${s.grade} ${s.composite}점] ${s.name} (${s.gender}, ${s.birth})`);
  console.log(`  사주: ${s.pillars}`);
  console.log(`  ${s.ilgan} | ${s.shinkang}`);
  console.log(`  오행: ${s.ohaeng}`);
  console.log(`  ${s.yongshin}`);
  console.log(`  점수: 재물 ${s.scores.재물운} / 연애 ${s.scores.연애운} / 직장 ${s.scores.직장운} / 건강 ${s.scores.건강운} / 대인 ${s.scores.대인운}`);
  console.log();
}
