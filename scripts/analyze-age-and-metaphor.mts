/**
 * 분석: (1) 결제 사용자 연령대 분포 (2) 풀이 본문 게임 슬랭 빈도 (3) 50+ 사용자 게임 슬랭 부조화
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

const CURRENT_YEAR = 2026;

function ageOf(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const y = parseInt(birthDate.slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 1900 || y > 2025) return null;
  return CURRENT_YEAR - y;
}

function ageBucket(age: number): string {
  if (age < 20) return "10s";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  if (age < 70) return "60s";
  return "70+";
}

// (1) 결제 사용자 연령 분포 (성공 결제, 운영자 제외)
const { data: ownerRows } = await sb.from("saju_results").select("user_id").eq("name", "신건주");
const ownerUids = new Set<string>();
for (const r of ownerRows ?? []) if (r.user_id) ownerUids.add(r.user_id);

const { data: payments } = await sb
  .from("payment_transactions")
  .select("user_id")
  .eq("method", "KAKAOPAY")
  .eq("status", "success");
const payerUids = [...new Set((payments ?? []).map((p: any) => p.user_id).filter(Boolean))].filter((u) => !ownerUids.has(u));

// 각 user의 본인 사주(보통 첫 분석) birth_date
const ageOfPayer: Record<string, number> = {};
for (let i = 0; i < payerUids.length; i += 100) {
  const chunk = payerUids.slice(i, i + 100);
  const { data: rs } = await sb
    .from("saju_results")
    .select("user_id, birth_date, created_at")
    .in("user_id", chunk)
    .order("created_at", { ascending: true });
  for (const r of rs ?? []) {
    if (!ageOfPayer[r.user_id]) {
      const a = ageOf(r.birth_date);
      if (a != null) ageOfPayer[r.user_id] = a;
    }
  }
}

const bucketCount: Record<string, number> = {};
for (const u of Object.keys(ageOfPayer)) {
  const b = ageBucket(ageOfPayer[u]);
  bucketCount[b] = (bucketCount[b] ?? 0) + 1;
}

console.log(`\n## 1) 결제 사용자 연령 분포 (운영자 제외 ${Object.keys(ageOfPayer).length}명)\n`);
const buckets = ["10s", "20s", "30s", "40s", "50s", "60s", "70+"];
const total = Object.values(bucketCount).reduce((a, b) => a + b, 0);
for (const b of buckets) {
  const n = bucketCount[b] ?? 0;
  const pct = total > 0 ? (n / total * 100).toFixed(1) : "0";
  console.log(`  ${b.padEnd(5)}  ${String(n).padStart(3)}명  ${pct}%`);
}

// (2) 풀이 본문 게임 슬랭 빈도
const { data: rows } = await sb
  .from("saju_results")
  .select("name, birth_date, full_json")
  .gte("created_at", "2026-04-01")
  .not("full_json", "is", null);

const GAME_SLANG_PATTERNS = [
  /만렙/g, /너프/g, /버프/g, /\bHP\b/g, /\bEXP\b/g, /\bMP\b/g,
  /스킬트리/g, /스킬셋/g, /빌드(?!업)/g, /챔피언/g, /캐릭(?!터)/g,
  /쿨타임/g, /딜링/g, /딜러/g, /탱커/g, /힐러/g, /패치/g,
  /가챠/g, /업데이트(?:하면)?/g, /노드 캡쳐/g, /젠/g, /리젠/g,
  /\bGG\b/g, /엔드게임/g, /엔드콘텐츠/g, /파밍/g, /레이드/g,
  /길드/g, /pvp/gi, /pve/gi, /\b만렙캐\b/g,
  /(?<!\w)스펙(?!\w)/g, /(?<!\w)퀘스트(?!\w)/g, /(?<!\w)미션 클리어/g,
  /구독\s*해지/g, /자동결제/g, /월정액/g, // (디지털)
];

const slangCount = new Map<string, number>();
let totalSlang = 0;
const userSlangs: Array<{ name: string; age: number | null; count: number; samples: string[] }> = [];

for (const r of rows ?? []) {
  const fj = r.full_json as any;
  const allText = JSON.stringify({
    title: fj?.tier?.title ?? "",
    description: fj?.tier?.description ?? "",
    sections: (fj?.sections ?? []).map((s: any) => s?.content ?? ""),
  });
  let userCount = 0;
  const userSamples: string[] = [];
  for (const pat of GAME_SLANG_PATTERNS) {
    const matches = allText.match(pat);
    if (matches) {
      const key = pat.source;
      slangCount.set(key, (slangCount.get(key) ?? 0) + matches.length);
      totalSlang += matches.length;
      userCount += matches.length;
      if (userSamples.length < 2) userSamples.push(matches[0]);
    }
  }
  if (userCount > 0) {
    userSlangs.push({ name: r.name, age: ageOf(r.birth_date), count: userCount, samples: userSamples });
  }
}

console.log(`\n## 2) 풀이 본문 게임/디지털 슬랭 빈도 (${rows?.length}건)\n`);
console.log(`총 발견 ${totalSlang}건 / 평균 ${(totalSlang / (rows?.length ?? 1)).toFixed(2)}건/풀이\n`);
console.log("상위 패턴:");
for (const [k, v] of [...slangCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${k.padEnd(20)}  ${v}회`);
}

// (3) 50+ 사용자 게임 슬랭 부조화
console.log(`\n## 3) 50+ 사용자 + 게임 슬랭 케이스\n`);
const elders = userSlangs.filter((u) => u.age && u.age >= 50);
console.log(`50+ 사용자 풀이 중 게임 슬랭 포함: ${elders.length}건`);
for (const e of elders.slice(0, 10)) {
  console.log(`  ${e.age}세 ${e.name?.padEnd(8)}  슬랭 ${e.count}회  예: ${e.samples.join(", ")}`);
}

// 연령대별 슬랭 빈도
console.log(`\n## 연령대별 평균 슬랭 빈도 (분석 풀이 기준)\n`);
const ageBucketSlang: Record<string, { totalCount: number; users: number }> = {};
for (const u of userSlangs) {
  if (u.age == null) continue;
  const b = ageBucket(u.age);
  if (!ageBucketSlang[b]) ageBucketSlang[b] = { totalCount: 0, users: 0 };
  ageBucketSlang[b].totalCount += u.count;
  ageBucketSlang[b].users += 1;
}
// 전체 풀이 기준 연령대 모수
const ageBucketTotal: Record<string, number> = {};
for (const r of rows ?? []) {
  const a = ageOf(r.birth_date);
  if (a == null) continue;
  const b = ageBucket(a);
  ageBucketTotal[b] = (ageBucketTotal[b] ?? 0) + 1;
}
for (const b of buckets) {
  const tot = ageBucketTotal[b] ?? 0;
  const slang = ageBucketSlang[b];
  if (tot === 0) continue;
  const pct = slang ? (slang.users / tot * 100).toFixed(0) : "0";
  const avg = slang ? (slang.totalCount / slang.users).toFixed(1) : "0";
  console.log(`  ${b.padEnd(5)}  풀이 ${String(tot).padStart(3)}건 · 슬랭 포함 ${pct}% · 슬랭 포함 풀이당 평균 ${avg}회`);
}
