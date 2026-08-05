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
//
// 2026-08-04까지 null로 방치돼 있어서 이 도구가 **구조적으로 아무것도 못 잡았다** —
// 라우트는 7/23에 배포됐는데(PR #92) 판정은 전부 "⚪ 보류"로 떨어져 🔴 확인대상이 늘 0이었다.
// 2026-08-05 실측으로 로그가 살아 있는 걸 확인하고(8/4 김민지 건, was_delivered=true) 값을 채운다.
// 기준 = PR #92 머지 시각(2026-07-23 10:01 KST).
const AUDIT_LIVE_AT: string | null = "2026-07-23T10:01:18+09:00";

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
  /** 조회가 한 건이라도 실패했으면 true — 이 통계로는 손실을 단정할 수 없다. */
  unreliable: boolean;
};

// ★조회 실패를 조용히 넘기면 "결과 없음"으로 둔갑한다.
// 2026-08-05 실측: 스윕이 유저 전원을 동시 조회하다 일부가 실패했고, 그게 전부 유령 gap 이 돼
// 같은 데이터에서 🔴 이 16명→4명→1명으로 매번 달라졌다(딥다이브는 🟢). 재시도 후에도 실패하면
// 그 유저는 통계를 못 믿는 것으로 표시하고 절대 🔴 로 올리지 않는다.
async function sel<T = any>(table: string, cols: string, userId: string): Promise<{ rows: T[]; failed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await sb.from(table).select(cols).eq("user_id", userId);
    if (!error) return { rows: (data ?? []) as T[], failed: false };
    // 표 자체가 없는 건 실패가 아니라 "해당 상품 없음"이다.
    if (/PGRST205|does not exist|schema cache/i.test(error.message)) return { rows: [], failed: false };
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    else return { rows: [], failed: true };
  }
  return { rows: [], failed: true };
}

// spend 는 상품 종류를 가리지 않는다. 그래서 결과 쪽도 **전 상품**을 세야 짝이 맞는다.
// 2026-08-05까지 saju_results 하나만 세고 있어서, 올해운세·오늘운세·유료리포트·배틀을 산 사람이
// 전부 유령 gap 으로 잡혔다(실측: 손지민 gap 2 = 어제 산 커리어·결혼 리포트 2건).
const RESULT_TABLES = ["saju_results", "yearly_results", "today_results"] as const;
const REPORT_TABLES = ["marriage_results", "career_results", "wealth_results", "pet_results"] as const;

async function statFor(userId: string, logAvailable: boolean): Promise<Stat> {
  const [{ data: u }, { count: spendC }, spendFirst, { count: refundC }] = await Promise.all([
    sb.from("users").select("nickname").eq("id", userId).maybeSingle(),
    sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "spend"),
    sb.from("coin_transactions").select("created_at").eq("user_id", userId).eq("type", "spend").order("created_at").limit(1),
    sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "refund"),
  ]);

  const rs: { full_json: any }[] = [];
  let unreliable = false;
  for (const t of RESULT_TABLES) {
    const { rows, failed } = await sel<{ full_json: any }>(t, "full_json", userId);
    unreliable ||= failed;
    rs.push(...rows);
  }
  // 유료 리포트는 언락(full_json 존재)된 것만 결과 제공 단위다. 티저 row 는 결제도 제공도 아니다.
  for (const t of REPORT_TABLES) {
    const { rows, failed } = await sel<{ full_json: any }>(t, "full_json", userId);
    unreliable ||= failed;
    for (const r of rows) if (r.full_json) rs.push(r);
  }
  // 배틀은 저장된 row 자체가 결과 제공 단위(실패 row 를 남기지 않는 구조).
  {
    const { rows, failed } = await sel<{ id: string }>("saju_battles", "id", userId);
    unreliable ||= failed;
    for (const _ of rows) rs.push({ full_json: {} });
  }
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
    unreliable,
  };
}

// spend 가 (정상+환불+삭제+미완) 로 다 설명되는가? 미설명 gap 은 로깅 라이브 이후 결제일 때만
// 🔴(손실/reuse 확인要)로 올린다. 그 외엔 보류(손실 단정 금지).
function verdict(s: Stat, logAvailable: boolean) {
  const accounted = s.delivered + s.refunds + s.deletions + s.pending;
  const gap = s.spends - accounted;
  if (gap <= 0) return { tag: "🟢 설명됨", gap: 0, actionable: false, note: "" };
  if (s.unreliable) return { tag: "⚪ 조회실패", gap, actionable: false, note: "결과 조회가 실패한 유저 — gap 을 손실로 읽지 말 것" };
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
  // ★Supabase select 는 기본 1000행에서 말없이 잘린다 → 페이지네이션 필수.
  //  안 하면 검사 대상 유저가 통째로 빠져 "gap 없음"이 조용한 오판이 된다.
  const spends: { user_id: string }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await sb
      .from("coin_transactions").select("user_id").eq("type", "spend").gte("created_at", since)
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`spend 조회 실패: ${error.message}`);
    spends.push(...((data ?? []) as any[]));
    if (!data || data.length < 1000) break;
  }
  const userIds = [...new Set(spends.map((s: any) => s.user_id).filter(Boolean))];
  console.log(`최근 ${days}일 결제 유저 ${userIds.length}명 검사\n`);

  // 전원 동시 조회는 DB 부하 사고 전력이 있다(2026-08-02 Supabase 다운) → 소량 배치로 나눈다.
  const stats: Stat[] = [];
  const BATCH = 5;
  for (let i = 0; i < userIds.length; i += BATCH) {
    stats.push(...(await Promise.all(userIds.slice(i, i + BATCH).map((id) => statFor(id, logAvailable)))));
  }
  const flagged = stats.map((s) => ({ s, v: verdict(s, logAvailable) })).filter((x) => x.v.gap > 0).sort((a, b) => b.v.gap - a.v.gap);

  if (!logAvailable || !AUDIT_LIVE_AT) {
    console.log(`⚠️ 삭제로그가 아직 ${!logAvailable ? "미생성" : "라이브 전"} — 아래 gap 은 전부 "보류(참고용)". 손실 단정 불가.`);
    console.log(`   (표 생성 + 라우트 배포 + AUDIT_LIVE_AT 세팅 후 재실행하면 삭제분 자동설명·진짜 손실만 🔴)\n`);
  }

  if (flagged.length === 0) {
    console.log("✅ 결제-무결과 gap 있는 유저 없음.");
  } else {
    console.log(`gap 있는 유저 ${flagged.length}명:\n`);
    console.log(`  판정          닉네임      계정      spend  정상 미완 에러 환불 삭제  gap  비고`);
    console.log(`  ─────────────────────────────────────────────────────────────────────────────`);
    for (const { s, v } of flagged) {
      console.log(
        `  ${v.tag.padEnd(11)} ${(s.nickname ?? "?").padEnd(8)}  ${s.userId.slice(0, 8)}  ${String(s.spends).padStart(4)}  ${String(s.delivered).padStart(3)} ${String(s.pending).padStart(3)} ${String(s.errored).padStart(3)} ${String(s.refunds).padStart(3)} ${String(s.deletions).padStart(3)}  ${String(v.gap).padStart(3)}  ${v.note}`,
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
