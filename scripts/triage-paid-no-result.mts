/**
 * 결제-무결과 판별 도구 (읽기 전용).
 *
 * "결제(spend)했는데 현재 정상 결과가 부족한" 유저를 뽑아,
 * 각 케이스를 [🟢본인삭제 / 🟡실패환불 / 🔵미완 / 🔴손실후보] 로 분류한다.
 *
 * 판정 근거:
 *   - 정상결과  : saju_results 중 full_json 정상(전달완료)
 *   - 미완/pending: full_json = null
 *   - 에러      : full_json._error
 *   - 환불      : coin_transactions.type='refund'
 *   - 삭제      : result_deletions (감사 로그 — 20260722 마이그레이션 이후만)
 *
 * 사용법:
 *   npx tsx scripts/triage-paid-no-result.mts            # 최근 7일
 *   npx tsx scripts/triage-paid-no-result.mts --days 14  # 최근 14일
 *   npx tsx scripts/triage-paid-no-result.mts <user_id>  # 특정 유저 딥다이브
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// result_deletions 표 존재 여부(마이그레이션 적용 전이면 삭제=불명 처리).
// head:true 조회는 없는 표(PGRST205)를 못 잡으므로 실제 select 로 확인한다.
async function deletionLogAvailable(): Promise<boolean> {
  const { error } = await sb.from("result_deletions").select("id").limit(1);
  return !error;
}

type Stat = {
  userId: string;
  nickname: string | null;
  spends: number;
  firstSpend: string | null;
  delivered: number;
  pending: number;
  errored: number;
  refunds: number;
  deletions: number;
};

async function statFor(userId: string): Promise<Stat> {
  const [{ data: u }, { count: spendC }, spendFirst, { data: rs }, { count: refundC }, { count: delC }] =
    await Promise.all([
      sb.from("users").select("nickname").eq("id", userId).maybeSingle(),
      sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "spend"),
      sb.from("coin_transactions").select("created_at").eq("user_id", userId).eq("type", "spend").order("created_at").limit(1),
      sb.from("saju_results").select("full_json").eq("user_id", userId),
      sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "refund"),
      sb.from("result_deletions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
  let delivered = 0, pending = 0, errored = 0;
  for (const r of rs ?? []) {
    const fj = (r as any).full_json;
    if (fj == null) pending++;
    else if (fj._error) errored++;
    else delivered++;
  }
  return {
    userId,
    nickname: (u as any)?.nickname ?? null,
    spends: spendC ?? 0,
    firstSpend: (spendFirst.data?.[0] as any)?.created_at ?? null,
    delivered,
    pending,
    errored,
    refunds: refundC ?? 0,
    deletions: delC ?? 0,
  };
}

// 유저 단위 회계: spend 가 (정상+환불+삭제+미완) 로 다 설명되는가?
// 핵심: 삭제로그가 비어있으면 gap을 손실로 단정하지 않는다(삭제/reuse/손실 구분 불가 → 보류).
function verdict(s: Stat, logAvailable: boolean, logStart: string | null) {
  const accounted = s.delivered + s.refunds + s.deletions + s.pending;
  const gap = s.spends - accounted;
  if (gap <= 0) return { tag: "🟢 설명됨", gap: 0, actionable: false, note: "" };
  if (!logAvailable) return { tag: "⚪ 보류", gap, actionable: false, note: "삭제로그 미생성 → 삭제/reuse/손실 구분불가" };
  // 로그 도입 이전 결제는 삭제 기록이 있을 수 없음 → 소급 판별 불가
  const preLog = logStart && s.firstSpend && new Date(s.firstSpend) < new Date(logStart);
  if (preLog) return { tag: "🟤 로그이전", gap, actionable: false, note: "감사로그 도입 전 결제 → 삭제 소급불가" };
  // 로그 활성 이후인데도 설명 안 됨 = 진짜 확인 대상(단, reuse 중복결제일 수도)
  return { tag: "🟠 미설명", gap, actionable: true, note: "삭제·환불·미완 아님 → reuse중복결제 or 손실, 확인要" };
}

async function main() {
  const arg = process.argv[2];
  const logAvailable = await deletionLogAvailable();
  const logStart = logAvailable
    ? ((await sb.from("result_deletions").select("deleted_at").order("deleted_at").limit(1)).data?.[0] as any)?.deleted_at ?? null
    : null;

  console.log(`\n결제-무결과 판별  (삭제로그 ${logAvailable ? "사용가능" : "❌미생성(마이그레이션 전)"})`);
  if (logAvailable && logStart) console.log(`감사로그 최초기록: ${kst(logStart)} — 이전 결제는 삭제 소급불가`);

  // 딥다이브: 특정 유저
  if (arg && UUID_RE.test(arg)) {
    const s = await statFor(arg);
    const v = verdict(s, logAvailable, logStart);
    console.log(`\n[딥다이브] ${s.nickname ?? "?"} ${arg}`);
    console.log(`  spend ${s.spends} | 정상 ${s.delivered} · 미완 ${s.pending} · 에러 ${s.errored} · 환불 ${s.refunds} · 삭제로그 ${s.deletions}`);
    console.log(`  판정 ${v.tag}${v.gap ? ` (gap ${v.gap})` : ""}  ${v.note}`);
    return;
  }

  // 최근 N일 동안 spend 한 유저 전수
  const days = arg === "--days" ? Number(process.argv[3] || 7) : 7;
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const { data: spends } = await sb.from("coin_transactions").select("user_id").eq("type", "spend").gte("created_at", since);
  const userIds = [...new Set((spends ?? []).map((s: any) => s.user_id).filter(Boolean))];
  console.log(`최근 ${days}일 결제 유저 ${userIds.length}명 검사\n`);

  const stats = await Promise.all(userIds.map(statFor));
  const flagged = stats
    .map((s) => ({ s, v: verdict(s, logAvailable, logStart) }))
    .filter((x) => x.v.gap > 0)
    .sort((a, b) => b.v.gap - a.v.gap);

  if (!logAvailable) {
    console.log(`⚠️ 삭제로그(result_deletions) 미생성 — 아래 gap은 전부 "판별보류(참고용)".`);
    console.log(`   마이그레이션 적용 후 재실행하면 삭제분은 자동으로 설명됩니다.\n`);
  }

  if (flagged.length === 0) {
    console.log("✅ 결제-무결과 gap 있는 유저 없음. 모두 결과 전달됨.");
  } else {
    console.log(`gap 있는 유저 ${flagged.length}명:\n`);
    console.log(`  판정          닉네임        spend  정상 미완 에러 환불 삭제  gap  비고`);
    console.log(`  ─────────────────────────────────────────────────────────────────────────────`);
    for (const { s, v } of flagged) {
      console.log(
        `  ${v.tag.padEnd(11)} ${(s.nickname ?? "?").padEnd(10)}  ${String(s.spends).padStart(4)}  ${String(s.delivered).padStart(3)} ${String(s.pending).padStart(3)} ${String(s.errored).padStart(3)} ${String(s.refunds).padStart(3)} ${String(s.deletions).padStart(3)}  ${String(v.gap).padStart(3)}  ${v.note}`,
      );
    }
    const actionable = flagged.filter((x) => x.v.actionable).length;
    const hold = flagged.length - actionable;
    console.log(`\n🟠 확인대상(미설명) ${actionable}명 · 보류(로그없음/로그이전) ${hold}명.`);
    if (actionable === 0 && !logAvailable) {
      console.log(`   → 지금은 로그가 없어 전부 보류. 손실 단정 불가(대부분 삭제/reuse로 추정).`);
    }
  }
}

main().catch((e) => {
  console.error("❌", e?.message || e);
  process.exit(1);
});
