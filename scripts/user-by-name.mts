/**
 * 닉네임/카카오ID/분석대상 이름으로 사용자 활동 전체 deep-dive
 * 실행: npx tsx scripts/user-by-name.mts <검색어>
 *
 * 검색 우선순위: users.nickname → users.kakao_id → saju_results.name
 * 점수는 saju_results.full_json.{tier,scores}에서 추출 (직접 컬럼 X)
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

const fmtFull = (d: string | null | undefined) => {
  if (!d) return "-";
  const kst = new Date(new Date(d).getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 19).replace("T", " ") + " KST";
};

async function resolveUserIds(query: string): Promise<string[]> {
  const ids = new Set<string>();
  const { data: byNick } = await sb.from("users").select("id").ilike("nickname", `%${query}%`);
  byNick?.forEach((u) => ids.add(u.id));
  if (/^\d+$/.test(query)) {
    const { data: byKakao } = await sb.from("users").select("id").eq("kakao_id", query);
    byKakao?.forEach((u) => ids.add(u.id));
  }
  if (ids.size === 0) {
    const { data: byResultName } = await sb.from("saju_results").select("user_id").ilike("name", `%${query}%`);
    byResultName?.forEach((r) => r.user_id && ids.add(r.user_id));
  }
  return [...ids];
}

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("사용법: npx tsx scripts/user-by-name.mts <닉네임|카카오ID|분석대상이름>");
    process.exit(1);
  }

  const userIds = await resolveUserIds(query);
  if (userIds.length === 0) {
    console.log(`'${query}' 검색 결과 없음`);
    return;
  }

  const { data: users } = await sb
    .from("users")
    .select("id, kakao_id, nickname, created_at, primary_result_id")
    .in("id", userIds);

  for (const u of users ?? []) {
    console.log("\n" + "=".repeat(90));
    console.log(`▶ ${u.nickname ?? "(닉네임없음)"}  카카오ID ${u.kakao_id}  user_id=${u.id.slice(0, 8)}…`);
    console.log(`  가입일: ${fmtFull(u.created_at)}`);
    console.log("=".repeat(90));

    const [{ data: results }, { data: battles }, { data: payments }, { data: coins }, { data: profile }] = await Promise.all([
      sb.from("saju_results").select("*").eq("user_id", u.id).order("created_at", { ascending: true }),
      sb.from("saju_battles").select("*").eq("user_id", u.id).order("created_at", { ascending: true }),
      sb.from("payment_transactions").select("*").eq("user_id", u.id).order("created_at", { ascending: true }),
      sb.from("coin_transactions").select("*").eq("user_id", u.id).order("created_at", { ascending: true }),
      sb.from("profiles").select("coin_balance").eq("user_id", u.id).maybeSingle(),
    ]);

    console.log(
      `\n요약: 분석 ${results?.length ?? 0} / 배틀 ${battles?.length ?? 0} / 결제 ${payments?.length ?? 0} / 잔고 ${profile?.coin_balance ?? 0}알  / 매출 ${(payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0).toLocaleString()}원`,
    );

    if (results?.length) {
      console.log("\n📋 분석 결과 (점수는 full_json.tier/scores)");
      for (const r of results) {
        const fj: any = r.full_json ?? {};
        const tier = fj.tier ?? {};
        const sc = fj.scores ?? {};
        console.log(`  ${fmtFull(r.created_at)}  ${tier.grade ?? "—"}(${tier.composite ?? "—"})  ${r.name}  ${r.birth_date} ${r.birth_time ?? "(시간없음)"}  ${r.gender}/${r.region}`);
        console.log(`    건강 ${sc.건강운 ?? "—"} / 대인 ${sc.대인운 ?? "—"} / 연애 ${sc.연애운 ?? "—"} / 재물 ${sc.재물운 ?? "—"} / 직장 ${sc.직장운 ?? "—"}  v${fj.scoringVersion ?? "—"}  hash=${r.input_hash?.slice(0, 8) ?? "-"}`);
      }
    }

    if (payments?.length) {
      console.log("\n💳 결제");
      for (const p of payments)
        console.log(`  ${fmtFull(p.created_at)}  ${p.method} ${p.amount?.toLocaleString()}원  ${p.status}  order=${p.order_id?.slice(0, 12)}…`);
    }

    if (coins?.length) {
      console.log("\n🥚 코인");
      const k: Record<string, string> = { charge: "충전", spend: "소비", bonus: "보너스", refund: "환불" };
      for (const c of coins)
        console.log(`  ${fmtFull(c.created_at)}  ${(k[c.type] ?? c.type).padEnd(4)}  ${c.amount > 0 ? "+" : ""}${c.amount}알  잔고 ${c.balance_after}  pkg=${c.package_id ?? "-"}  ref=${c.reference_id?.slice(0, 12) ?? "-"}`);
    }

    if (battles?.length) {
      console.log("\n⚔ 배틀");
      for (const b of battles)
        console.log(`  ${fmtFull(b.created_at)}  ${b.player_a_name}(${b.player_a_birth_date}) × ${b.player_b_name}(${b.player_b_birth_date}) [${b.relationship_type}]`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
