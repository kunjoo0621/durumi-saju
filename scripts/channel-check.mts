import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const { data: u24, error: e24 } = await sb
  .from("users")
  .select("id, nickname, created_at, referrer, utm_source, utm_medium, utm_campaign, landing_path")
  .gte("created_at", since24h)
  .order("created_at", { ascending: false });

if (e24) {
  console.error(e24);
  process.exit(1);
}

console.log(`\n=== 최근 24h 가입자 ${u24?.length}명 ===`);
console.log("시각              닉네임    referrer             utm_source    utm_medium  utm_campaign  landing");
console.log("─".repeat(115));
for (const u of u24 ?? []) {
  const t = new Date(u.created_at).toISOString().slice(5, 16).replace("T", " ");
  console.log(
    `${t}   ${(u.nickname ?? "-").padEnd(8)} ${(u.referrer ?? "—").padEnd(20)} ${(u.utm_source ?? "—").padEnd(13)} ${(u.utm_medium ?? "—").padEnd(11)} ${(u.utm_campaign ?? "—").padEnd(13)} ${u.landing_path ?? "—"}`,
  );
}

const counts24: Record<string, number> = {};
for (const u of u24 ?? []) {
  const ch = u.utm_source ?? u.referrer ?? "직접/모름";
  counts24[ch] = (counts24[ch] ?? 0) + 1;
}
console.log(`\n=== 24h 채널 요약 ===`);
for (const [ch, n] of Object.entries(counts24).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ch.padEnd(25)} ${n}명`);
}

const { data: u7d } = await sb
  .from("users")
  .select("referrer, utm_source, created_at")
  .gte("created_at", since7d);
const counts7: Record<string, number> = {};
let nullCount = 0;
let nonNullCount = 0;
for (const u of u7d ?? []) {
  const ch = u.utm_source ?? u.referrer ?? "직접/모름";
  if (!u.utm_source && !u.referrer) nullCount++;
  else nonNullCount++;
  counts7[ch] = (counts7[ch] ?? 0) + 1;
}
console.log(`\n=== 7일 채널 요약 (총 ${u7d?.length}명) ===`);
for (const [ch, n] of Object.entries(counts7).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ch.padEnd(25)} ${n}명`);
}
console.log(`\n  추적 정보 있음: ${nonNullCount}명 / 없음(직접·과거 가입): ${nullCount}명`);
