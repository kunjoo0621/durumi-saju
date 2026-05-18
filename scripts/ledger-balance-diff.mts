import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1) 모든 profiles
  const { data: profiles, error: pe } = await sb
    .from("profiles")
    .select("user_id, coin_balance");
  if (pe) throw pe;

  // 2) ledger SUM per user (페이지네이션으로 1000행 limit 회피)
  const sumByUser = new Map<string, number>();
  let fromIdx = 0;
  const PAGE = 1000;
  let totalLoaded = 0;
  while (true) {
    const { data, error } = await sb
      .from("coin_transactions")
      .select("user_id, amount")
      .order("created_at", { ascending: true })
      .range(fromIdx, fromIdx + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const t of data) {
      sumByUser.set(t.user_id, (sumByUser.get(t.user_id) ?? 0) + (t.amount ?? 0));
    }
    totalLoaded += data.length;
    if (data.length < PAGE) break;
    fromIdx += PAGE;
  }
  console.log(`(coin_transactions 총 ${totalLoaded}행 로드)`);

  // 3) users
  const { data: users } = await sb.from("users").select("id, kakao_id, nickname, name");
  const userById = new Map<string, any>();
  for (const u of users ?? []) userById.set(u.id, u);

  // 4) diff
  type Row = { uid: string; nick: string; kakao: string; bal: number; ledger: number; diff: number };
  const rows: Row[] = [];
  for (const p of profiles ?? []) {
    const u = userById.get(p.user_id);
    const ledger = sumByUser.get(p.user_id) ?? 0;
    const bal = p.coin_balance ?? 0;
    rows.push({
      uid: p.user_id,
      nick: u?.nickname ?? u?.name ?? "?",
      kakao: u?.kakao_id ?? "?",
      bal,
      ledger,
      diff: bal - ledger,
    });
  }

  const mismatches = rows.filter((r) => r.diff !== 0);
  console.log(`전체 user ${rows.length}명 중 ledger != balance: ${mismatches.length}명\n`);
  console.log("nickname".padEnd(14) + " kakao_id".padEnd(13) + "  balance  ledger    diff   user_id");
  console.log("-".repeat(100));
  for (const r of mismatches.sort((a, b) => b.diff - a.diff)) {
    console.log(
      `${r.nick.padEnd(14)} ${r.kakao.padEnd(12)}  ${String(r.bal).padStart(6)}  ${String(r.ledger).padStart(6)}  ${String(r.diff).padStart(6)}   ${r.uid}`
    );
  }

  const totalDiff = mismatches.reduce((s, r) => s + r.diff, 0);
  console.log(`\n총 diff 합: ${totalDiff}알`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
