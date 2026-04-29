import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// KST 기준 시간대 윈도우 (UTC로 환산)
// 오전: 00~12 KST = 15~03 UTC (전날)
// 오후: 12~24 KST = 03~15 UTC (당일)
// KST D-day 자정 = D-1 15:00 UTC

const ranges = [
  { label: "04-24 (목, 이벤트 시작)", start: "2026-04-23T15:00:00Z", noon: "2026-04-24T03:00:00Z", end: "2026-04-24T15:00:00Z" },
  { label: "04-25 (금)",              start: "2026-04-24T15:00:00Z", noon: "2026-04-25T03:00:00Z", end: "2026-04-25T15:00:00Z" },
  { label: "04-26 (토)",              start: "2026-04-25T15:00:00Z", noon: "2026-04-26T03:00:00Z", end: "2026-04-26T15:00:00Z" },
];

async function count(table: string, from: string, to: string) {
  const { count } = await sb.from(table).select("*", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to);
  return count ?? 0;
}

console.log("\n시간 기준: KST (한국 시간)\n");
console.log("날짜                    오전(00~12)  오후(12~24)  계");
console.log("─".repeat(60));

let totalAm = 0, totalPm = 0;
for (const r of ranges) {
  const am = await count("users", r.start, r.noon);
  const pm = await count("users", r.noon, r.end);
  console.log(`${r.label.padEnd(22)}    ${String(am).padStart(4)}명       ${String(pm).padStart(4)}명     ${String(am+pm).padStart(4)}명`);
  totalAm += am; totalPm += pm;
}
console.log("─".repeat(60));
console.log(`합계                      ${String(totalAm).padStart(4)}명       ${String(totalPm).padStart(4)}명     ${String(totalAm+totalPm).padStart(4)}명`);
