/**
 * 결제-무결과 판별 도구 (읽기 전용).
 *
 * "결제(spend)했는데 현재 정상 결과가 부족한" 유저를 뽑아 분류한다.
 * 핵심 원칙: **삭제 감사 로그가 있어야만** 삭제를 확정할 수 있다. 로그가 없거나
 * 로깅 라이브 이전 결제는 손실로 단정하지 않고 "보류"로 남긴다(삭제/reuse/손실 구분 불가).
 *
 * 판정 재료:
 *   - 정상결과 : saju_results.full_json 정상        - 미완 : full_json = null
 *   - 에러     : full_json._error                    - 환불 : coin_transactions.refund
 *   - 삭제     : result_deletions (감사 로그, 20260722 마이그레이션 + 라우트 배포 이후만)
 *
 * 사용법:
 *   npx tsx scripts/triage-paid-no-result.mts            # 최근 7일 스윕
 *   npx tsx scripts/triage-paid-no-result.mts --days 14
 *   npx tsx scripts/triage-paid-no-result.mts <user_id>  # 특정 유저 딥다이브(삭제기록 타임라인 포함)
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

// 삭제 감사 로깅이 프로덕션에 라이브된 시각(ISO). 배포 완료 후 이 값을 배포 시각으로 세팅한다.
// null 이면 아직 로깅 전 → 모든 미설명 gap 은 "보류"(손실 단정 불가).
const AUDIT_LIVE_AT: string | null = null;

const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// result_deletions 표 존재 여부(head:true 는 없는 표 PGRST205 를 못 잡으므로 실 select).
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

async function statFor(userId: string, logAvailable: boolean): Promise<Stat> {
  const [{ data: u }, { count: spendC }, spendFirst, { data: rs }, { count: refundC }] = await Promise.all([
    sb.from("users").select("nickname").eq("id", userId).maybeSingle(),
    sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "spend"),
    sb.from("coin_transactions").select("created_at").eq("user_id", userId).eq("type", "spend").order("created_at").limit(1),
    sb.from("saju_results").select("full_json").eq("user_id", userId),
    sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "refund"),
  ]);
  let deletions = 0;
  if (logAvailable) {
    const { count } = await sb.from("result_deletions").select("id", { count: "exact", head: true }).eq("user_id", userId);
    deletions = count ?? 0;
  }
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
    deletions,
  };
}

// spend 가 (정상+환불+삭제+미완) 로 다 설명되는가? 미설명 gap 은 로깅 라이브 이후 결제일 때만
// 🔴(손실/reuse 확인要)로 올린다. 그 외엔 보류(손실 단정 금지).
function verdict(s: Stat, logAvailable: boolean) {
  const accounted = s.delivered + s.refunds + s.deletions + s.pending;
  const gap = s.spends - accounted;
  if (gap <= 0) return { tag: "🟢 설명됨", gap: 0, actionable: false, note: "" };
  if (!logAvailable) return { tag: "⚪ 보류", gap, actionable: false, note: "삭제로그 표 미생성" };
  if (!AUDIT_LIVE_AT) return { tag: "⚪ 보류", gap, actionable: false, note: "로깅 라이브 전 → 삭제 소급불가" };
  const allAfterLive = s.firstSpend && new Date(s.firstSpend) >= new Date(AUDIT_LIVE_AT);
  if (!allAfterLive) return { tag: "🟤 로그이전포함", gap, actionable: false, note: "라이브 전 결제 포함 → 개별확인" };
  return { tag: "🔴 미설명", gap, actionable: true, note: "로깅후 결제인데 삭제·환불·미완 없음 → 손실 or reuse중복, 확인要" };
}

async function deepDive(userId: string, logAvailable: boolean) {
  const s = await statFor(userId, logAvailable);
  const v = verdict(s, logAvailable);
  console.log(`\n[딥다이브] ${s.nickname ?? "?"} ${userId}`);
  console.log(`  spend ${s.spends} | 정상 ${s.delivered} · 미완 ${s.pending} · 에러 ${s.errored} · 환불 ${s.refunds} · 삭제로그 ${s.deletions}`);
  console.log(`  판정 ${v.tag}${v.gap ? ` (gap ${v.gap})` : ""}  ${v.note}`);
  if (logAvailable) {
    const { data: dels } = await sb
      .from("result_deletions")
      .select("deleted_at, name, birth_date, was_delivered, result_id")
      .eq("user_id", userId)
      .order("deleted_at");
    console.log(`\n  삭제 기록 ${dels?.length ?? 0}건:`);
    for (const d of dels ?? []) {
      const dd = d as any;
      console.log(`    ${kst(dd.deleted_at)}  ${dd.name ?? "?"} ${dd.birth_date ?? ""}  ${dd.was_delivered ? "정상결과였음" : "미완/에러상태"}  result=${String(dd.result_id).slice(0, 8)}`);
    }
  } else {
    console.log(`\n  (삭제로그 표 미생성 — 삭제 기록 조회 불가)`);
  }
}

async function main() {
  const arg = process.argv[2];
  const logAvailable = await deletionLogAvailable();

  console.log(`\n결제-무결과 판별  (삭제로그 ${logAvailable ? "사용가능" : "❌미생성(마이그레이션 전)"}${AUDIT_LIVE_AT ? ` · 로깅라이브 ${kst(AUDIT_LIVE_AT)}` : " · 로깅 라이브 전"})`);

  if (arg && UUID_RE.test(arg)) {
    await deepDive(arg, logAvailable);
    return;
  }

  const days = arg === "--days" ? Number(process.argv[3] || 7) : 7;
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const { data: spends } = await sb.from("coin_transactions").select("user_id").eq("type", "spend").gte("created_at", since);
  const userIds = [...new Set((spends ?? []).map((s: any) => s.user_id).filter(Boolean))];
  console.log(`최근 ${days}일 결제 유저 ${userIds.length}명 검사\n`);

  const stats = await Promise.all(userIds.map((id) => statFor(id, logAvailable)));
  const flagged = stats.map((s) => ({ s, v: verdict(s, logAvailable) })).filter((x) => x.v.gap > 0).sort((a, b) => b.v.gap - a.v.gap);

  if (!logAvailable || !AUDIT_LIVE_AT) {
    console.log(`⚠️ 삭제로그가 아직 ${!logAvailable ? "미생성" : "라이브 전"} — 아래 gap 은 전부 "보류(참고용)". 손실 단정 불가.`);
    console.log(`   (표 생성 + 라우트 배포 + AUDIT_LIVE_AT 세팅 후 재실행하면 삭제분 자동설명·진짜 손실만 🔴)\n`);
  }

  if (flagged.length === 0) {
    console.log("✅ 결제-무결과 gap 있는 유저 없음.");
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
    console.log(`\n🔴 확인대상(손실/reuse 의심) ${actionable}명 · 보류 ${flagged.length - actionable}명.`);
  }
}

main().catch((e) => {
  console.error("❌", e?.message || e);
  process.exit(1);
});
