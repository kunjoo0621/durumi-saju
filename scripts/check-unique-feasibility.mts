import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// 같은 reference_id 로 charge 행이 2개 이상인 케이스 식별
// 페이지네이션으로 모든 행 로드
let all: any[] = [];
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await sb
    .from("coin_transactions")
    .select("user_id, reference_id, type, amount, created_at")
    .eq("type", "charge")
    .not("reference_id", "is", null)
    .range(from, from + PAGE - 1);
  if (error) throw error;
  if (!data || data.length === 0) break;
  all = all.concat(data);
  if (data.length < PAGE) break;
  from += PAGE;
}

const byRef = new Map<string, any[]>();
for (const r of all) {
  const arr = byRef.get(r.reference_id) ?? [];
  arr.push(r);
  byRef.set(r.reference_id, arr);
}

const dups = [...byRef.entries()].filter(([, arr]) => arr.length >= 2);
console.log(`type='charge' & reference_id NOT NULL 인 총 행 수: ${all.length}`);
console.log(`중복 reference_id 그룹: ${dups.length}개`);
console.log(`UNIQUE INDEX 생성 시 충돌하는 행 수: ${dups.reduce((s, [, arr]) => s + arr.length - 1, 0)}`);
console.log();
for (const [ref, arr] of dups) {
  console.log(`  ${ref}  ${arr.length}행  user=${arr[0].user_id.slice(0, 8)}`);
}
