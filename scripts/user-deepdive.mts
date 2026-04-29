import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const fmtFull = (d: string | null | undefined) => {
  if (!d) return "-";
  const date = new Date(d);
  // KST
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 19).replace("T", " ") + " KST";
};

// 외부 실사용자 4명 카카오ID
const EXTERNAL_USER_KAKAO_IDS = [
  "4791081139", // 최녜림
  "4843545750", // 세인
  "4845281282", // ㅎㅂㅁ
  "4854718455", // 이우진
];

async function main() {
  const { data: users } = await sb
    .from("users")
    .select("id, kakao_id, nickname, created_at, primary_result_id")
    .in("kakao_id", EXTERNAL_USER_KAKAO_IDS);

  for (const u of users ?? []) {
    console.log("\n" + "=".repeat(70));
    console.log(`▶ 카카오ID ${u.kakao_id}  |  닉네임: ${u.nickname ?? "(없음)"}`);
    console.log(`  가입일: ${fmtFull(u.created_at)}`);
    console.log("=".repeat(70));

    // 사주 결과 전체
    const { data: results } = await sb
      .from("saju_results")
      .select("id, name, birth_date, birth_time, region, gender, relationship_status, employment_status, created_at, order_id")
      .eq("user_id", u.id)
      .order("created_at", { ascending: true });

    // 배틀
    const { data: battles } = await sb
      .from("saju_battles")
      .select("id, player_a_name, player_b_name, player_a_birth_date, player_b_birth_date, relationship_type, created_at, order_id")
      .eq("user_id", u.id)
      .order("created_at", { ascending: true });

    // 결제
    const { data: payments } = await sb
      .from("payment_transactions")
      .select("method, amount, order_id, created_at")
      .eq("user_id", u.id)
      .order("created_at", { ascending: true });

    // 코인 트랜잭션
    const { data: coins } = await sb
      .from("coin_transactions")
      .select("type, amount, balance_after, reference_id, package_id, created_at")
      .eq("user_id", u.id)
      .order("created_at", { ascending: true });

    // 현재 잔고
    const { data: profile } = await sb
      .from("profiles")
      .select("coin_balance")
      .eq("user_id", u.id)
      .maybeSingle();

    // 타임라인 통합
    type Event = { at: string; kind: string; desc: string };
    const events: Event[] = [];
    events.push({ at: u.created_at, kind: "가입", desc: `카카오 로그인` });
    for (const p of payments ?? [])
      events.push({ at: p.created_at, kind: "💳결제", desc: `${p.method} ${p.amount.toLocaleString()}원 (order=${p.order_id.slice(0, 12)}…)` });
    for (const c of coins ?? [])
      events.push({
        at: c.created_at,
        kind: c.type === "charge" ? "🥚충전" : c.type === "spend" ? "🔥소비" : c.type === "bonus" ? "🎁보너스" : `↩환불`,
        desc: `${c.amount > 0 ? "+" : ""}${c.amount}알 (잔고 ${c.balance_after}, pkg=${c.package_id ?? "-"})`,
      });
    for (const r of results ?? [])
      events.push({
        at: r.created_at,
        kind: "🔮분석",
        desc: `${r.name} | ${r.birth_date} ${r.birth_time ?? ""} ${r.gender} | ${r.region} | [${r.relationship_status}/${r.employment_status}]`,
      });
    for (const b of battles ?? [])
      events.push({
        at: b.created_at,
        kind: "⚔배틀",
        desc: `${b.player_a_name}(${b.player_a_birth_date}) × ${b.player_b_name}(${b.player_b_birth_date}) [${b.relationship_type}]`,
      });

    events.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

    console.log(`\n요약: 분석 ${results?.length ?? 0}건 / 배틀 ${battles?.length ?? 0}건 / 결제 ${payments?.length ?? 0}건 / 잔고 ${profile?.coin_balance ?? 0}알`);
    console.log(`\n활동 타임라인 (KST):`);
    console.log("-".repeat(70));
    let prevDate = "";
    for (const e of events) {
      const kst = fmtFull(e.at);
      const dateOnly = kst.slice(0, 10);
      if (dateOnly !== prevDate) {
        console.log(`[${dateOnly}]`);
        prevDate = dateOnly;
      }
      console.log(`  ${kst.slice(11, 19)}  ${e.kind.padEnd(5)}  ${e.desc}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
