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
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-";

async function main() {
  const { data: payments } = await sb
    .from("payment_transactions")
    .select("id, user_id, method, amount, status, order_id, created_at")
    .order("created_at", { ascending: true });

  const { data: users } = await sb.from("users").select("id, kakao_id, nickname");
  const userById = new Map<string, any>();
  for (const u of users ?? []) userById.set(u.id, u);

  console.log("=== method별 집계 ===\n");
  const byMethod = new Map<string, { n: number; sum: number; range: string[] }>();
  for (const p of payments ?? []) {
    const key = p.method ?? "null";
    const prev = byMethod.get(key) ?? { n: 0, sum: 0, range: [] };
    prev.n += 1;
    prev.sum += p.amount ?? 0;
    prev.range.push((p.created_at ?? "").slice(0, 10));
    byMethod.set(key, prev);
  }
  for (const [m, v] of byMethod) {
    const first = v.range[0];
    const last = v.range[v.range.length - 1];
    console.log(`  ${m.padEnd(12)}  ${String(v.n).padStart(3)}건  ${v.sum.toLocaleString().padStart(8)}원  (${first} ~ ${last})`);
  }

  // KAKAOPAY만 (실결제)
  console.log("\n=== KAKAOPAY (실결제) 상세 ===\n");
  const kakao = (payments ?? []).filter((p: any) => p.method === "KAKAOPAY");
  const kakaoTotal = kakao.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  console.log(`총 ${kakao.length}건 / ${kakaoTotal.toLocaleString()}원\n`);

  for (const p of kakao) {
    const u = userById.get(p.user_id);
    const nick = u ? `${u.nickname ?? "(없음)"} [${u.kakao_id?.slice(0, 10) ?? "?"}]` : "(user null)";
    console.log(`  ${fmt(p.created_at)}  ${String(p.amount).padStart(5)}원  ${nick}`);
  }

  // 날짜 경계별 집계 (심사 전 vs 심사 후 추정)
  console.log("\n=== 일자별 KAKAOPAY 집계 ===\n");
  const byDay = new Map<string, number>();
  for (const p of kakao) {
    const d = (p.created_at ?? "").slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + (p.amount ?? 0));
  }
  for (const [d, s] of [...byDay.entries()].sort()) {
    console.log(`  ${d}  ${s.toLocaleString().padStart(6)}원`);
  }

  // 본인 계정 가능성 (심사계정 등) 체크
  console.log("\n=== payer 계정 분포 ===\n");
  const byUser = new Map<string, { n: number; sum: number; nick: string }>();
  for (const p of kakao) {
    const u = userById.get(p.user_id);
    const key = p.user_id ?? "null";
    const prev = byUser.get(key) ?? { n: 0, sum: 0, nick: u?.nickname ?? "?" };
    prev.n += 1;
    prev.sum += p.amount ?? 0;
    byUser.set(key, prev);
  }
  for (const [uid, v] of byUser) {
    const u = userById.get(uid);
    const kid = u?.kakao_id?.slice(0, 12) ?? "?";
    console.log(`  ${v.nick.padEnd(14)} [${kid.padEnd(12)}]  ${v.n}건 / ${v.sum.toLocaleString()}원`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
