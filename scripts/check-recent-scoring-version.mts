/**
 * 최근 saju_results의 scoringVersion 분포 확인 — production이 어느 버전으로 작동했는지 확정
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

// 최근 100건 조회
const { data: rows } = await sb
  .from("saju_results")
  .select("name, created_at, full_json")
  .order("created_at", { ascending: false })
  .limit(100);

const withFullJson = (rows ?? []).filter((r: any) => r.full_json !== null);
console.log(`최근 ${withFullJson.length}건 분석 결과 scoringVersion 분포\n`);

// 날짜별·버전별 카운트
const byDateVersion: Record<string, Record<string, number>> = {};
for (const r of withFullJson) {
  const v = (r as any).full_json?.scoringVersion ?? "(없음)";
  const date = (r as any).created_at.slice(0, 10);
  byDateVersion[date] = byDateVersion[date] ?? {};
  byDateVersion[date][String(v)] = (byDateVersion[date][String(v)] ?? 0) + 1;
}

// 날짜 내림차순으로 출력
const sortedDates = Object.keys(byDateVersion).sort().reverse();
for (const date of sortedDates) {
  const versions = byDateVersion[date];
  const breakdown = Object.entries(versions).sort((a, b) => Number(b[1]) - Number(a[1]));
  const total = breakdown.reduce((sum, [_, n]) => sum + n, 0);
  console.log(`${date}: ${total}건`);
  for (const [v, n] of breakdown) {
    console.log(`  scoringVersion = ${v}: ${n}건`);
  }
}

console.log();
console.log("=== 최근 10건 상세 (이름·날짜·버전) ===");
for (const r of withFullJson.slice(0, 10)) {
  const v = (r as any).full_json?.scoringVersion ?? "(없음)";
  const created = (r as any).created_at;
  console.log(`  ${created.slice(0, 19)} | v${v} | ${(r as any).name}`);
}
