/**
 * 재사용 이중과금 감사 — "10알 차감됐는데 새 결과가 안 만들어진 건"을 센다.
 *
 * 배경: /api/coins/spend(analysis)가 spend_coins를 먼저 부르고 나서야 재사용을 판정해서,
 * 같은 입력으로 재진입하면 알만 빠지고 저장된 옛 결과가 그대로 재노출됐다.
 * 2026-05~07 실측 75건/54명. fix/reuse-charge에서 확인-후-차감으로 교정.
 *
 * 사용:
 *   npx tsx scripts/check-reuse-spend.mts          # 전체 기간
 *   npx tsx scripts/check-reuse-spend.mts 7        # 최근 7일만
 *
 * 배포 후 판정: 수정 배포 시각 이후 건수가 0이어야 한다.
 *
 * 주의: Supabase select는 기본 1000행에서 잘린다 → 전 테이블 페이지네이션 필수.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const days = process.argv[2] ? Number(process.argv[2]) : null;
const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;

async function all(table: string, cols: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

// 결과가 실제로 만들어졌는지 판정할 때 보는 테이블 전부.
// (배틀·펫까지 포함해야 "다른 상품을 산 것"을 오탐하지 않는다)
const RESULT_TABLES = [
  "saju_results",
  "yearly_results",
  "today_results",
  "marriage_results",
  "wealth_results",
  "career_results",
  "saju_battles",
  "pet_compat_results",
];

const spends = (
  await all("coin_transactions", "user_id, type, amount, reference_id, created_at")
).filter(
  (t) => t.type === "spend" && t.amount === -10 && (!since || t.created_at >= since)
);
const sessions = await all("prepayment_sessions", "id, user_id, input_hash");
const unlocks = await all("result_unlocks", "user_id, input_hash, created_at");

const sessById = new Map(sessions.map((s) => [s.id, s]));
const firstUnlock = new Map<string, string>();
for (const u of unlocks) {
  const k = `${u.user_id}|${u.input_hash}`;
  if (!firstUnlock.has(k) || u.created_at < firstUnlock.get(k)!) firstUnlock.set(k, u.created_at);
}

const created: Record<string, string[]> = {};
for (const t of RESULT_TABLES) {
  let rows: any[] = [];
  try {
    rows = await all(t, "user_id, created_at");
  } catch {
    continue; // 아직 없는 테이블은 건너뛴다
  }
  for (const r of rows) {
    if (r.user_id) (created[r.user_id] ??= []).push(r.created_at);
  }
}

// 차감 시각 ±(직전 5초 ~ 이후 10분)에 어떤 결과든 새로 생겼으면 정상 과금이다.
const WINDOW_MS = 10 * 60 * 1000;

// ★환불로 상계된 차감은 이중과금이 아니다.
// 2026-08-05 실측: 8/2 문수양 건이 유일한 "수정 배포 이후" 검출이었는데, 실제로는
// 올해운세 환불(+10) 직후 재차감이라 순증이 0이었다. 환불을 안 보면 정상 재시도가
// 영원히 이중과금으로 잡힌다.
const refunds = (
  await all("coin_transactions", "user_id, type, amount, created_at")
).filter((t) => t.type === "refund");
const refundsByUser = new Map<string, number[]>();
for (const r of refunds) {
  if (!r.user_id) continue;
  (refundsByUser.get(r.user_id) ?? refundsByUser.set(r.user_id, []).get(r.user_id)!).push(+new Date(r.created_at));
}
const REFUND_WINDOW_MS = 10 * 60 * 1000;
const offsetByRefund = (userId: string, atIso: string) => {
  const t = +new Date(atIso);
  return (refundsByUser.get(userId) ?? []).some((r) => Math.abs(r - t) <= REFUND_WINDOW_MS);
};

const hits: any[] = [];
let skippedByRefund = 0;
for (const sp of spends) {
  const s = sessById.get(sp.reference_id);
  if (!s) continue; // 세션 기반 spend가 아님(다른 상품 경로)
  const prev = firstUnlock.get(`${s.user_id}|${s.input_hash}`);
  if (!prev || prev >= sp.created_at) continue; // 기존 결과가 먼저 있어야 재사용
  const t0 = new Date(sp.created_at).getTime();
  const madeNew = (created[s.user_id] ?? []).some((c) => {
    const d = new Date(c).getTime() - t0;
    return d > -5000 && d < WINDOW_MS;
  });
  if (madeNew) continue;
  if (offsetByRefund(s.user_id, sp.created_at)) { skippedByRefund++; continue; }
  hits.push({ ...sp, prevAt: prev });
}

const users = await all("users", "id, nickname");
const nick = new Map(users.map((u) => [u.id, u.nickname]));

hits.sort((a, b) => b.created_at.localeCompare(a.created_at));
const scope = days ? `최근 ${days}일` : "전체 기간";
console.log(`\n[재사용 이중과금] ${scope} — ${hits.length}건 / ${new Set(hits.map((h) => h.user_id)).size}명\n`);
if (skippedByRefund > 0) console.log(`  (환불로 상계돼 제외한 차감 ${skippedByRefund}건 — 순증 0이라 이중과금 아님)`);

const gap: Record<string, number> = { "1분 이내": 0, "1~10분": 0, "10분~1시간": 0, "1시간~1일": 0, "1일 이상": 0 };
for (const h of hits) {
  const m = (new Date(h.created_at).getTime() - new Date(h.prevAt).getTime()) / 60000;
  if (m < 1) gap["1분 이내"]++;
  else if (m < 10) gap["1~10분"]++;
  else if (m < 60) gap["10분~1시간"]++;
  else if (m < 1440) gap["1시간~1일"]++;
  else gap["1일 이상"]++;
}
console.log("이전 결과와의 간격:", JSON.stringify(gap));

for (const h of hits.slice(0, 30)) {
  const kst = new Date(h.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const d = (new Date(h.created_at).getTime() - new Date(h.prevAt).getTime()) / 86400000;
  console.log(`  ${kst}  ${nick.get(h.user_id) ?? "?"} (${h.user_id.slice(0, 8)})  ${d.toFixed(1)}일 만에`);
}
if (hits.length > 30) console.log(`  … 외 ${hits.length - 30}건`);
