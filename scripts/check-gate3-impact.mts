/**
 * 게이트 3(최저 카테고리 ≤ 39 → -1 등급) 제거 시 영향 분석
 * - 현재 D 등급 사용자 중 다른 게이트 발동 없이 게이트 3만으로 강등된 사람들이 C로 회복
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
let dWithMinUnder40 = 0;
let dWithDcountUnder3 = 0;
let dPureGate3 = 0;
const dPureList: { name: string; min: number; cats: any }[] = [];

for (const r of rows ?? []) {
  const fj = (r as any).full_json;
  const grade = fj?.tier?.grade;
  const composite = fj?.tier?.composite;
  const scores = fj?.scores ?? {};
  if (!grade || typeof composite !== "number") continue;
  total++;

  if (grade === "D") {
    dCount++;
    const vals = Object.values(scores).filter((v) => typeof v === "number") as number[];
    if (vals.length === 0) continue;
    const minScore = Math.min(...vals);
    const dCatCount = vals.filter((v) => v <= 44).length;

    if (minScore <= 39) {
      dWithMinUnder40++;
      // 게이트 1(D캐릭3+) 발동 안 했고 게이트 3만 발동된 케이스
      if (dCatCount < 3) {
        dPureGate3++;
        dPureList.push({ name: (r as any).name, min: minScore, cats: scores });
      } else {
        dWithDcountUnder3++;
      }
    }
  }
}

console.log(`전체 분석: ${total}건`);
console.log(`D 등급: ${dCount}건 (${(dCount/total*100).toFixed(1)}%)`);
console.log(`D 중 최저 ≤ 39: ${dWithMinUnder40}건`);
console.log(`  └ 게이트 1도 같이 발동 (D카테고리 3+): ${dWithDcountUnder3}건`);
console.log(`  └ 게이트 3만 발동 (게이트 3 제거 시 C로 회복): ${dPureGate3}건`);
console.log(`\n게이트 3 제거 시 D → C 회복 사용자:`);
for (const u of dPureList) {
  console.log(`  - ${u.name} | 최저 ${u.min} | ${JSON.stringify(u.cats)}`);
}
