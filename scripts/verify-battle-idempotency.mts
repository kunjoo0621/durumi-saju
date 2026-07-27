/**
 * 배틀 멱등성 — 배포 전/후 검증기.
 *
 *   npx tsx scripts/verify-battle-idempotency.mts
 *
 * 1) session_id 컬럼 존재 확인  ← ★배포 전 필수. 없으면 배포 시 배틀 저장 전면 실패.
 * 2) 과거 중복 배틀 실측 (같은 유저·같은 상대·짧은 간격) = 이 버그가 낸 손실 규모
 * 3) 마이그레이션 후 신규 배틀에 session_id 가 채워지는지
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const l of envText.split("\n")) {
  const m = l.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const DUP_WINDOW_MS = 120_000; // 같은 조합이 2분 안에 또 생기면 중복 호출로 본다

console.log("\n=== 배틀 멱등성 검증 ===\n");

// ── 1) 컬럼 존재 ──────────────────────────────────
const colProbe = await sb.from("saju_battles").select("session_id").limit(1);
const hasColumn = !colProbe.error;
if (hasColumn) {
  console.log("✅ 1. session_id 컬럼 있음 — 배포 가능");
} else {
  console.log("❌ 1. session_id 컬럼 없음 →", colProbe.error!.message);
  console.log("   ⚠️  이 상태로 배포하면 배틀 저장이 전부 실패한다.");
  console.log("   먼저 supabase/migrations/20260727_battle_session_idempotency.sql 을");
  console.log("   Supabase SQL Editor 에서 'Run without RLS' 로 실행할 것.");
}

// ★ Supabase 는 기본 1000행에서 잘린다 — 반드시 페이지네이션할 것.
//   (이 스크립트 작성 중 실제로 당했다: 90일 coin_transactions 가 7,282행이라
//    한 번에 읽으면 6·7월이 통째로 잘려 "결제 0건" 오판이 났다.)
async function selectAll(
  table: string,
  cols: string,
  build: (q: any) => any
): Promise<any[]> {
  const out: any[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await build(sb.from(table).select(cols)).range(from, from + PAGE - 1);
    if (e) throw new Error(`${table}: ${e.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// ── 2) 과거 중복 배틀 실측 ────────────────────────
const since = new Date(Date.now() - 90 * 864e5).toISOString();
const battles = await selectAll(
  "saju_battles",
  "id, user_id, player_a_name, player_b_name, relationship_type, created_at",
  (q) => q.gte("created_at", since).not("user_id", "is", null).order("created_at")
);

const groups = new Map<string, { at: number; id: string }[]>();
for (const b of battles || []) {
  const key = [b.user_id, b.player_a_name, b.player_b_name, b.relationship_type].join("|");
  const arr = groups.get(key) || [];
  arr.push({ at: new Date(b.created_at).getTime(), id: b.id });
  groups.set(key, arr);
}

let dupCount = 0;
const dupUsers = new Map<string, number>();
const examples: string[] = [];
for (const [key, arr] of groups) {
  arr.sort((a, b) => a.at - b.at);
  for (let i = 1; i < arr.length; i++) {
    const gap = arr[i].at - arr[i - 1].at;
    if (gap <= DUP_WINDOW_MS) {
      dupCount++;
      const uid = key.split("|")[0];
      dupUsers.set(uid, (dupUsers.get(uid) || 0) + 1);
      if (examples.length < 10) {
        examples.push(
          `${new Date(arr[i - 1].at).toISOString().slice(0, 19)} +${Math.round(gap / 1000)}s  ` +
            `${key.split("|").slice(1).join(" vs ").slice(0, 40)}  (user ${uid.slice(0, 8)})`
        );
      }
    }
  }
}

const total = battles.length;
console.log(`\n2. 과거 90일 중복 배틀 (같은 조합 ${DUP_WINDOW_MS / 1000}초 이내 재생성)`);
console.log(`   로그인 배틀 ${total}건 중 근접 재생성 ${dupCount}건 (${((dupCount / Math.max(total, 1)) * 100).toFixed(1)}%)`);
console.log(`   영향 유저 ${dupUsers.size}명`);
if (examples.length) {
  console.log("   예시:");
  examples.forEach((e) => console.log("     " + e));
}

// ── 2-b) 결제 대조 = 실제 무과금 배틀 수 (money number) ──
//   "근접 재생성"은 정황이고, 진짜 손실은 배틀 수 > 20알 결제 수 인 초과분이다.
const txs = await selectAll("coin_transactions", "user_id, type, amount, created_at", (q) =>
  q.gte("created_at", since).order("created_at")
);
const BATTLE_EGGS = 20;
const battlesPerUser = new Map<string, number>();
const paidPerUser = new Map<string, number>();
for (const b of battles) battlesPerUser.set(b.user_id, (battlesPerUser.get(b.user_id) || 0) + 1);
for (const t of txs) {
  if (t.type === "spend" && Math.abs(Number(t.amount)) === BATTLE_EGGS) {
    paidPerUser.set(t.user_id, (paidPerUser.get(t.user_id) || 0) + 1);
  }
}
let unpaid = 0;
const unpaidRows: string[] = [];
for (const [u, n] of battlesPerUser) {
  const paid = paidPerUser.get(u) || 0;
  if (n > paid) {
    unpaid += n - paid;
    unpaidRows.push(`     ${u.slice(0, 8)}  배틀 ${n} / 결제 ${paid} → 무과금 ${n - paid}`);
  }
}
const totalPaid = [...paidPerUser.values()].reduce((a, c) => a + c, 0);
console.log(`\n2-b. 결제 대조 (coin_transactions ${txs.length}행)`);
console.log(`   로그인 배틀 ${total}건 / 20알 결제 ${totalPaid}건 → 무과금 ${unpaid}건 (${unpaidRows.length}명)`);
unpaidRows
  .sort((a, b) => Number(b.split("무과금 ")[1]) - Number(a.split("무과금 ")[1]))
  .slice(0, 10)
  .forEach((r) => console.log(r));
console.log(`   → 수정 후 신규 배틀에서 이 초과분이 늘지 않아야 한다.`);
console.log(`   ⚠️ 20알 spend 는 배틀 고유 금액이라는 가정에 기댄 근사치다`);
console.log(`      (PET_COMPAT_COST 정상가도 20알 — 현재는 출시가 10알이라 섞이지 않음).`);

// ── 3) 마이그레이션 후 신규 배틀 채움 확인 ─────────
if (hasColumn) {
  const { data: recent } = await sb
    .from("saju_battles")
    .select("id, session_id, created_at, user_id")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const filled = (recent || []).filter((r) => r.session_id).length;
  console.log(`\n3. 최근 로그인 유저 배틀 20건 중 session_id 채워진 것: ${filled}건`);
  if (filled === 0) {
    console.log("   (배포 전이면 정상 — 배포 후 신규 배틀부터 채워진다)");
  }
}
console.log("");
