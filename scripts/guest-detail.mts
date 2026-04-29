import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "-";

async function main() {
  // 게스트 saju_results 전수 조회
  const { data: guestResults } = await sb
    .from("saju_results")
    .select("id, guest_token_hash, order_id, input_hash, created_at, saju_text")
    .is("user_id", null)
    .order("created_at", { ascending: true });

  console.log("=== 게스트 saju_results 분석 ===\n");
  console.log(`총 ${guestResults?.length ?? 0}건\n`);

  // 월별 분포
  const byMonth = new Map<string, number>();
  const withOrderId = guestResults?.filter((r) => r.order_id).length ?? 0;
  const withoutOrderId = guestResults?.filter((r) => !r.order_id).length ?? 0;
  const withSajuText = guestResults?.filter((r) => r.saju_text && r.saju_text.length > 100).length ?? 0;

  for (const r of guestResults ?? []) {
    const month = (r.created_at ?? "").slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }

  console.log("월별 분포:");
  for (const [m, n] of [...byMonth.entries()].sort()) {
    console.log(`  ${m}: ${n}건`);
  }

  console.log("\n경로 추정:");
  console.log(`  order_id 있음 (=결제 경로):     ${withOrderId}건`);
  console.log(`  order_id 없음 (=다른 경로):    ${withoutOrderId}건`);
  console.log(`  saju_text 채워진 것 (풀 분석 완료): ${withSajuText}건`);

  // 최근 10건 샘플
  console.log("\n최근 10건 샘플:");
  const recent = (guestResults ?? []).slice(-10).reverse();
  for (const r of recent) {
    const orderId = r.order_id ? r.order_id.slice(0, 20) : "(없음)";
    const hasText = r.saju_text && r.saju_text.length > 100 ? "✓분석완료" : "×비어있음";
    console.log(`  ${fmt(r.created_at)}  order=${orderId.padEnd(22)}  ${hasText}`);
  }

  // 게스트 배틀도 같이
  console.log("\n\n=== 게스트 saju_battles 분석 ===\n");
  const { data: guestBattles } = await sb
    .from("saju_battles")
    .select("id, guest_token_hash, created_at")
    .is("user_id", null)
    .order("created_at", { ascending: true });

  console.log(`총 ${guestBattles?.length ?? 0}건\n`);
  const bMonth = new Map<string, number>();
  for (const b of guestBattles ?? []) {
    const month = (b.created_at ?? "").slice(0, 7);
    bMonth.set(month, (bMonth.get(month) ?? 0) + 1);
  }
  console.log("월별 분포:");
  for (const [m, n] of [...bMonth.entries()].sort()) {
    console.log(`  ${m}: ${n}건`);
  }

  // teaser_cache 확인
  console.log("\n\n=== teaser_cache ===\n");
  const { count: teaserCount } = await sb.from("teaser_cache").select("*", { count: "exact", head: true });
  console.log(`총 ${teaserCount ?? 0}건 (티저만 본 방문자 흔적)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
