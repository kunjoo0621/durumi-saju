import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";

// ── 동시 실행 잠금 ────────────────────────────────
// 2026-08-02, 이 대시보드를 두 개 동시에 돌린 직후 Supabase가 522로 77분간 죽었다.
// 무료 nano(램 512MB)에 무거운 집계를 겹쳐 던지면 인스턴스가 넘어간다.
// 실수로 두 번 띄우는 것 자체를 막는다. 스테일 락은 PID 생존 + 10분 경과로 자동 해제.
const LOCK_FILE = "/tmp/durumi-live-dashboard.lock";
const LOCK_STALE_MS = 10 * 60_000;
function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    try {
      const [pidStr, startedAt] = readFileSync(LOCK_FILE, "utf-8").split("\n");
      const pid = Number(pidStr);
      const age = Date.now() - Number(startedAt || 0);
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }
      if (alive && age < LOCK_STALE_MS) {
        console.error(
          `\n  대시보드가 이미 실행 중입니다 (PID ${pid}, ${Math.round(age / 1000)}초 경과).\n` +
          `  동시 실행은 DB(무료 nano)를 넘어뜨릴 수 있어 막습니다. 끝난 뒤 다시 실행하세요.\n` +
          `  강제 해제: rm ${LOCK_FILE}\n`,
        );
        process.exit(1);
      }
    } catch { /* 손상된 락은 무시하고 덮어쓴다 */ }
  }
  writeFileSync(LOCK_FILE, `${process.pid}\n${Date.now()}`);
  const release = () => { try { unlinkSync(LOCK_FILE); } catch {} };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(sig, () => { release(); process.exit(130); });
  }
}
acquireLock();

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const LAST_RUN_FILE = "/tmp/durumi-live-dashboard-last-run.txt";

// ── ANSI ──────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgPink: "\x1b[48;5;211m",
  brand: "\x1b[38;5;203m",
};

// 한글 포함 문자열 시각적 폭 계산
function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK, Hangul, full-width
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xa960 && code <= 0xa97f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60)
    ) w += 2;
    else w += 1;
  }
  return w;
}

function padR(s: string, width: number): string {
  const pad = Math.max(0, width - visualWidth(s));
  return s + " ".repeat(pad);
}
function padL(s: string, width: number): string {
  const pad = Math.max(0, width - visualWidth(s));
  return " ".repeat(pad) + s;
}
function clip(s: string, width: number): string {
  let out = "";
  let w = 0;
  for (const ch of s) {
    const cw = visualWidth(ch);
    if (w + cw > width) break;
    out += ch;
    w += cw;
  }
  return out;
}

const RULE = c.gray + "─".repeat(64) + c.reset;
const HR = c.gray + "━".repeat(64) + c.reset;

const now = Date.now();
const previousDashboardRunIso = existsSync(LAST_RUN_FILE)
  ? readFileSync(LAST_RUN_FILE, "utf-8").trim()
  : "";
const previousDashboardRunAt = previousDashboardRunIso ? +new Date(previousDashboardRunIso) : 0;
const H1 = new Date(now - 1 * 3600_000).toISOString();
const H24 = new Date(now - 24 * 3600_000).toISOString();
const D7 = new Date(now - 7 * 24 * 3600_000).toISOString();
const D14 = new Date(now - 14 * 24 * 3600_000).toISOString();
const TODAY_KST = new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
const TODAY_START = new Date(`${TODAY_KST}T00:00:00+09:00`).toISOString();
const YESTERDAY_KST = new Date(now + 9 * 3600_000 - 24 * 3600_000).toISOString().slice(0, 10);
const YESTERDAY_START = new Date(`${YESTERDAY_KST}T00:00:00+09:00`).toISOString();
const YESTERDAY_END = TODAY_START;

// 운영자/내부 테스트 계정은 실사용 대시보드 집계에서 제외한다.
const INTERNAL_USER_IDS = new Set([
  "b1fa9eba-2953-45d1-975b-fdf8a5d9b44f",
  "f39ccecb-fc39-4ef9-a262-d8ab2b85c317", // 신건주
]);
const INTERNAL_ID_LIST = `(${[...INTERNAL_USER_IDS].join(",")})`;

const fmtHM = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(5, 16).replace("T", " ");
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

function section(title: string) {
  console.log("");
  console.log(HR);
  console.log(`  ${c.bold}${c.cyan}${title}${c.reset}`);
  console.log(HR);
}

async function countSince(table: string, since: string, internalColumn: "id" | "user_id" | null = "user_id", until?: string) {
  let q = sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  if (until) q = q.lt("created_at", until);
  if (internalColumn) q = q.not(internalColumn, "in", INTERNAL_ID_LIST);
  const { count } = await q;
  return count ?? 0;
}

// ── 유료 심층 리포트 4종 ────────────────────────────
// 대시보드가 이 4종을 통째로 빼먹어서 "결제는 있는데 분석이 없다"로 잘못 읽히고 있었다
// (결혼운은 최근 7일 23건으로 개인사주 다음가는 2위 상품).
//
// ★언락 판정 기준: full_json IS NOT NULL. row는 티저 단계에서 먼저 생기고, 결제 언락 시에
// 본문(full_json)이 채워진다. unlocked_at은 `default now()`라 row 생성만으로도 박히므로
// 결제 증거가 못 된다(2026-08-02 실측 — 이 컬럼을 믿었다가 티저를 결제로 오집계했다).
// 검증: marriage/career/wealth 115행 전수 대조에서 full_json 유무 ⟺ *_result_unlocks 기록 유무가
// 불일치 0으로 일치(60/60, 16/16, 24/24).
// 펫은 full_result가 NOT NULL 제약이라 row 자체가 언락 단위다.
const REPORT_KINDS = [
  { table: "marriage_results", kind: "결혼", gradeCol: "marriage_grade", color: c.magenta },
  { table: "career_results", kind: "커리어", gradeCol: "career_grade", color: c.blue },
  { table: "wealth_results", kind: "재물", gradeCol: "wealth_grade", color: c.yellow },
] as const;

type ReportRow = {
  kind: string;
  user_id: string | null;
  created_at: string;
  name: string | null;
  birth_date: string | null;
  gender: string | null;
  region: string | null;
  grade: string | null;
  full_json: any;
  /** 결제 언락 완료(본문 존재). false면 티저만 보고 이탈한 row다 — 매출·결과 집계에 넣으면 안 된다. */
  unlocked: boolean;
};

// 4종을 한 번에 긁어온다. 펫 궁합은 스키마가 달라(full_result·pet_id, 인적사항 없음) 등급·집계만 채운다.
// ── "결제했는데 결과 없음" 판정 ──────────────────────────────────────────────
// 이 지표는 창(그날 00:00~24:00) 안에서만 결과를 찾아서, 사고가 아닌 것 셋을 계속 빨갛게 띄웠다.
// 2026-08-05 실측: 8/4에 뜬 1건은 손실이 아니라 **본인이 5분 뒤 삭제**한 건이었다.
// 그래서 아래 셋을 먼저 설명하고, 설명 안 되는 것만 진짜 경고로 남긴다.
//   ① 본인삭제 — result_deletions 에 was_delivered=true 로 남음
//   ② 창밖완료 — 자정 직전에 결제하고 결과는 다음 날 새벽에 떨어진 경우
//   ③ 재사용   — 차감은 됐는데 새 결과가 없고 예전 결과만 있는 경우(=이중과금 쪽 이슈, 손실과 구분해야 한다)
const NO_RESULT_GRACE_MS = 3 * 3600_000;
const DELIVERY_TABLES = [
  { table: "saju_results", hasJson: true },
  { table: "yearly_results", hasJson: true },
  { table: "today_results", hasJson: true },
  { table: "marriage_results", hasJson: true },
  { table: "career_results", hasJson: true },
  { table: "wealth_results", hasJson: true },
  { table: "pet_results", hasJson: true },
  { table: "saju_battles", hasJson: false }, // 배틀은 row 자체가 제공 단위(실패 row 를 안 남긴다)
] as const;

async function explainNoDelivery(userIds: string[], startIso: string, endIso: string) {
  const explained = new Map<string, string>();
  if (userIds.length === 0) return { unexplained: [] as string[], explained };
  const graceEnd = new Date(+new Date(endIso) + NO_RESULT_GRACE_MS).toISOString();

  // ① 본인 삭제
  {
    const { data, error } = await sb
      .from("result_deletions")
      .select("user_id, was_delivered, deleted_at")
      .in("user_id", userIds)
      .gte("deleted_at", startIso)
      .lt("deleted_at", graceEnd);
    if (!error) for (const d of (data ?? []) as any[]) if (d.was_delivered && d.user_id) explained.set(d.user_id, "본인삭제");
  }

  const remain = () => userIds.filter((id) => !explained.has(id));

  // ② 창 경계를 넘겨 완료된 결과
  for (const spec of DELIVERY_TABLES) {
    const ids = remain();
    if (ids.length === 0) break;
    const cols = spec.hasJson ? "user_id, full_json" : "user_id";
    const { data, error } = await sb.from(spec.table).select(cols).in("user_id", ids).gte("created_at", endIso).lt("created_at", graceEnd);
    if (error) continue;
    for (const r of (data ?? []) as any[]) {
      if (!r.user_id) continue;
      if (spec.hasJson && (!r.full_json || (r.full_json as any)._error)) continue;
      explained.set(r.user_id, "창밖완료");
    }
  }

  // ③ 창 이전의 옛 결과만 있는 경우(재사용 의심)
  for (const spec of DELIVERY_TABLES) {
    const ids = remain();
    if (ids.length === 0) break;
    const cols = spec.hasJson ? "user_id, full_json" : "user_id";
    const { data, error } = await sb.from(spec.table).select(cols).in("user_id", ids).lt("created_at", startIso);
    if (error) continue;
    for (const r of (data ?? []) as any[]) {
      if (!r.user_id) continue;
      if (spec.hasJson && (!r.full_json || (r.full_json as any)._error)) continue;
      explained.set(r.user_id, "재사용의심");
    }
  }

  return { unexplained: remain(), explained };
}

async function loadReportRows(startIso: string, endIso?: string): Promise<ReportRow[]> {
  const out: ReportRow[] = [];
  for (const r of REPORT_KINDS) {
    let q = sb
      .from(r.table)
      .select(`user_id, created_at, name, birth_date, gender, region, ${r.gradeCol}, full_json`)
      .gte("created_at", startIso)
      .not("user_id", "in", INTERNAL_ID_LIST);
    if (endIso) q = q.lt("created_at", endIso);
    const { data, error } = await q;
    if (error) continue;
    for (const row of (data ?? []) as any[]) {
      out.push({
        kind: r.kind,
        user_id: row.user_id ?? null,
        created_at: row.created_at,
        name: row.name ?? null,
        birth_date: row.birth_date ?? null,
        gender: row.gender ?? null,
        region: row.region ?? null,
        grade: row[r.gradeCol] ?? null,
        full_json: row.full_json,
        unlocked: !!row.full_json,
      });
    }
  }
  let pq = sb
    .from("pet_compat_results")
    .select("user_id, created_at, label_grade, full_result")
    .gte("created_at", startIso)
    .not("user_id", "in", INTERNAL_ID_LIST);
  if (endIso) pq = pq.lt("created_at", endIso);
  const { data: pets, error: petErr } = await pq;
  if (!petErr) {
    for (const row of (pets ?? []) as any[]) {
      out.push({
        kind: "펫",
        user_id: row.user_id ?? null,
        created_at: row.created_at,
        name: null,
        birth_date: null,
        gender: null,
        region: null,
        grade: row.label_grade ?? null,
        full_json: row.full_result,
        unlocked: !!row.full_result,
      });
    }
  }
  return out;
}

// 언락된 리포트 중 본문이 실패(_error)로 채워진 것 = 돈 받고 결과 못 준 진짜 사고
const reportFailed = (r: ReportRow) => r.unlocked && !!r.full_json?._error;

/**
 * 현행 SCORING_VERSION을 산식 모듈에서 직접 읽는다.
 * ★하드코딩하지 말 것. 2026-08-06, 이 모니터가 v18을 하드코딩한 채 코호트를 `v >= 18`로
 *   묶는 바람에 v18(249건)과 v19(88건)가 한 칸에 합쳐져 표시됐고, 두 버전의 분포가
 *   서로 반대 방향(v18 SS 5.6% / v19 SS 18.2%)이라 어느 쪽 신호도 안 보였다.
 *   버전은 단일 출처(saju-scoring)에서만 온다.
 */
async function currentScoringVersion(): Promise<number | null> {
  try {
    const m: any = await import("@/lib/utils/saju-scoring");
    const v = Number(m.SCORING_VERSION ?? m.default?.SCORING_VERSION);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null; // 임포트 실패 시 데이터에서 관측된 최대 버전으로 폴백
  }
}

async function gradeVersionMonitor() {
  const CUR = await currentScoringVersion();
  section("🎯  등급 산식 버전별 모니터링  " + c.dim + "(버전마다 따로 · 합치지 않는다)" + c.reset);
  const DISP: Record<string, string> = { S: "SS", A: "S", B: "A", C: "B", D: "C" };
  // ★full_json 통째로 받지 말 것. 2,900행 × 9KB ≈ 26MB를 매 실행마다 끌어와
  // nano 인스턴스(램 512MB)를 압박한다. 실제로 필요한 건 스칼라 3개뿐이므로
  // PostgREST JSON 경로 투영으로 DB에서 뽑아 온다(전송량 100분의 1 이하).
  // 2026-08-02 DB 다운(522, 77분) 재발 방지. → memory/project_durumi_supabase_outage
  let all: any[] = [], from = 0;
  while (true) {
    const { data, error } = await sb
      .from("saju_results")
      .select("grade:full_json->tier->>grade,composite:full_json->tier->>composite,ver:full_json->>scoringVersion,err:full_json->>_error")
      .not("full_json", "is", null)
      .range(from, from + 999);
    if (error) { console.log(`  ${c.red}등급 집계 조회 실패${c.reset} ${error.message}`); return; }
    if (!data || !data.length) break;
    all.push(...data); from += 1000; if (data.length < 1000) break;
  }
  const valid = all.filter((r: any) => r.err == null && Number.isFinite(Number(r.composite)));
  if (!valid.length) { console.log(`  ${c.dim}집계할 결과 없음${c.reset}`); return; }

  const cohort = (rows: any[]) => {
    const d: Record<string, number> = { SS: 0, S: 0, A: 0, B: 0, C: 0 };
    for (const r of rows) { const g = DISP[r.grade] ?? r.grade; if (d[g] !== undefined) d[g]++; }
    const cs = rows.map((r: any) => Number(r.composite)).sort((a, b) => a - b);
    return { n: rows.length, d, med: cs[Math.floor((cs.length - 1) / 2)] };
  };
  const byVer = new Map<number, any[]>();
  for (const r of valid) {
    const v = Number(r.ver) || 0;
    if (!byVer.has(v)) byVer.set(v, []);
    byVer.get(v)!.push(r);
  }
  const versions = [...byVer.keys()].sort((a, b) => b - a);
  const cur = CUR ?? versions[0] ?? 0;

  const line = (label: string, co: ReturnType<typeof cohort>, hi = false) => {
    const parts = ["SS", "S", "A", "B", "C"].map((g) => {
      const p = ((co.d[g] / co.n) * 100).toFixed(1);
      const col = g === "C" ? c.red : c.reset;
      return `${col}${g} ${p}%${c.reset}`;
    }).join("  ");
    const lab = hi ? `${c.bold}${padR(label, 16)}${c.reset}` : padR(label, 16);
    console.log(`  ${lab} ${c.dim}n=${String(co.n).padStart(4)}${c.reset}  ${parts}  ${c.dim}중앙 comp ${String(co.med).padStart(2)}${c.reset}`);
  };

  console.log(`  ${c.dim}표시등급(SS=내부 S=composite≥85). 버전이 다르면 산식이 다르므로 절대 합치지 않는다.${c.reset}`);
  if (CUR == null) console.log(`  ${c.yellow}※ SCORING_VERSION 임포트 실패 — 데이터 관측 최대값 v${cur}을 현행으로 간주${c.reset}`);

  // 최근 3개 버전은 개별로, 그 이전은 한 덩어리로.
  const SHOW = 3;
  for (const v of versions.slice(0, SHOW)) {
    const isCur = v === cur;
    line(`v${v}${isCur ? " (현행)" : ""}`, cohort(byVer.get(v)!), isCur);
  }
  const rest = versions.slice(SHOW);
  if (rest.length) {
    const rows = rest.flatMap((v) => byVer.get(v)!);
    line(`v${rest[0]}이하 (과거)`, cohort(rows));
  }

  // 감시 대상은 현행 버전 하나뿐. 이전 버전은 grandfather로 동결돼 움직이지 않는다.
  const curRows = byVer.get(cur);
  if (!curRows?.length) {
    console.log(`  ${c.dim}※ v${cur} 신규 결과가 쌓이면 여기서 분포 이동을 감시.${c.reset}`);
    return;
  }
  const co = cohort(curRows);
  const cPct = (co.d.C / co.n) * 100;
  const base = versions.find((v) => v !== cur && byVer.get(v)!.length >= 100);
  const baseCo = base != null ? cohort(byVer.get(base)!) : null;
  const cmp = baseCo ? ` ${c.dim}(직전 대량버전 v${base}: ${((baseCo.d.C / baseCo.n) * 100).toFixed(1)}%)${c.reset}` : "";
  const flag = cPct > 14 ? `${c.red}⚠ 확인 필요${c.reset}` : `${c.green}정상 범위${c.reset}`;
  console.log(`  ${c.bold}v${cur} 최하 C: ${cPct.toFixed(1)}%${c.reset}  ${flag}${cmp}`);
  if (co.n < 150) {
    console.log(`  ${c.dim}※ n=${co.n}은 표본이 작다. 상·하위 등급 비율은 몇 건 차이로 크게 흔들리니 단독 판단 금지.${c.reset}`);
  }
  console.log(`  ${c.dim}※ 버전 간 분포 차이는 산식 변경만이 아니라 그 기간에 누가 분석했는지(코호트)로도 생긴다.${c.reset}`);
  console.log(`  ${c.dim}  산식 탓인지 가리려면 옛 코호트를 현행 엔진으로 재채점해 비교할 것.${c.reset}`);
}

async function main() {
  const nowKst = new Date(now + 9 * 3600_000).toISOString().slice(0, 19).replace("T", " ");

  // 헤더
  console.log("");
  console.log(`  ${c.bold}${c.brand}🥚 사주보는 두루미${c.reset}  ${c.dim}실시간 대시보드${c.reset}`);
  console.log(`  ${c.dim}${nowKst} KST${c.reset}`);

  // ── 1. 핵심 지표 테이블 ──────────────────────────
  const periods = [
    { label: "1시간", since: H1 },
    { label: "오늘", since: TODAY_START },
    { label: "어제", since: YESTERDAY_START, until: YESTERDAY_END },
    { label: "7일", since: D7 },
  ];

  // 정산 가능 결제 식별 기준 (memory/feedback_durumi_dashboard.md 참조)
  // - method=KAKAOPAY (mock/egg 제외)
  // - user_id not null (비회원 제외)
  // - user_id != 운영자 본인 (신건주)
  // - created_at >= 2026-04-01 (3월 이전 비회원 시기 제외) — period.since가 이미 4월 이후라 자동 만족
  const isPayable = (x: { method?: string; user_id?: string | null }) =>
    x.method === "KAKAOPAY" && !!x.user_id && !INTERNAL_USER_IDS.has(x.user_id);

  type Row = {
    period: string; users: number; results: number; yearly: number; today: number; battles: number;
    reports: number; reportByKind: Record<string, number>; pays: number; revenue: number;
  };
  const rows: Row[] = [];
  for (const p of periods) {
    const until = (p as { until?: string }).until;
    let payQ = sb.from("payment_transactions").select("amount, method, user_id").gte("created_at", p.since).eq("status", "success");
    if (until) payQ = payQ.lt("created_at", until);
    const [users, results, yearly, today, battles, payments, reportRows] = await Promise.all([
      countSince("users", p.since, "id", until),
      countSince("saju_results", p.since, "user_id", until),
      countSince("yearly_results", p.since, "user_id", until),
      countSince("today_results", p.since, "user_id", until),
      countSince("saju_battles", p.since, "user_id", until),
      payQ,
      loadReportRows(p.since, until),
    ]);
    const kakaoPaid = (payments.data ?? []).filter(isPayable);
    // 언락된 리포트만 집계한다. 티저 row는 결제도 결과 제공도 아니다.
    const unlockedReports = reportRows.filter((r) => r.unlocked);
    const reportByKind: Record<string, number> = {};
    for (const r of unlockedReports) reportByKind[r.kind] = (reportByKind[r.kind] ?? 0) + 1;
    rows.push({
      period: p.label,
      users,
      results,
      yearly,
      today,
      battles,
      reports: unlockedReports.length,
      reportByKind,
      pays: kakaoPaid.length,
      revenue: kakaoPaid.reduce((s, x) => s + (x.amount ?? 0), 0),
    });
  }

  async function loadRiskSnapshot(startIso: string, endIso: string, label: string) {
    const [paysRes, personalRes, yearlyRes, todayRes, battleRes, reportRows] = await Promise.all([
      sb
        .from("payment_transactions")
        .select("amount, method, user_id, created_at")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .eq("status", "success")
        .order("created_at", { ascending: false }),
      sb
        .from("saju_results")
        .select("user_id, created_at, name, full_json")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      sb
        .from("yearly_results")
        .select("user_id, created_at, name, full_json")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      sb
        .from("today_results")
        .select("user_id, created_at, name, full_json")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      sb
        .from("saju_battles")
        .select("user_id, created_at")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      loadReportRows(startIso, endIso),
    ]);

    const resultRows = [
      ...((personalRes.data ?? []) as any[]).map((r) => ({ ...r, kind: "개인" })),
      ...((yearlyRes.data ?? []) as any[]).map((r) => ({ ...r, kind: "올해" })),
      ...((todayRes.data ?? []) as any[]).map((r) => ({ ...r, kind: "오늘" })),
      // 언락된 유료 리포트도 결과 제공 단위다. 빠져 있으면 리포트만 산 사용자가 "결제했는데 결과 없음"으로 오탐된다.
      // 티저 row(미언락)는 제외 — 결제하지 않았으므로 제공 의무가 없다.
      ...reportRows.filter((r) => r.unlocked),
    ];
    const errRows = resultRows
      .filter((r) => (r.full_json as any)?._error)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const deliveredUserIds = new Set<string>();
    for (const r of resultRows) {
      if (r.user_id && !(r.full_json as any)?._error) deliveredUserIds.add(r.user_id);
    }
    for (const r of battleRes.data ?? []) if (r.user_id) deliveredUserIds.add(r.user_id);

    const paidUserIds = new Set(
      ((paysRes.data ?? []) as any[])
        .filter(isPayable)
        .map((p) => p.user_id)
        .filter(Boolean),
    );
    const candidates = [...paidUserIds].filter((id) => !deliveredUserIds.has(id));
    // 창 안에서 결과를 못 찾았다고 바로 경고하지 않는다 — 본인삭제·창밖완료·재사용을 먼저 설명한다.
    const { unexplained: paidNoDelivered, explained } = await explainNoDelivery(candidates, startIso, endIso);
    const profiles = new Map<string, any>();
    if (paidNoDelivered.length > 0) {
      const { data } = await sb
        .from("users")
        .select("id, nickname, created_at, referrer, utm_source, landing_path")
        .in("id", paidNoDelivered);
      for (const u of data ?? []) profiles.set(u.id, u);
    }

    return {
      label,
      errRows,
      paidNoDelivered: paidNoDelivered.map((id) => profiles.get(id) ?? { id }),
      explained,
    };
  }

  const tomorrowKstForRisk = new Date(now + 9 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10);
  const TOMORROW_START_FOR_RISK = new Date(`${tomorrowKstForRisk}T00:00:00+09:00`).toISOString();
  const [todayRisk, yesterdayRisk] = await Promise.all([
    loadRiskSnapshot(TODAY_START, TOMORROW_START_FOR_RISK, "오늘"),
    loadRiskSnapshot(YESTERDAY_START, YESTERDAY_END, "어제"),
  ]);

  const isUnseen = (iso: string | null | undefined) =>
    previousDashboardRunAt <= 0 || (!!iso && +new Date(iso) > previousDashboardRunAt);
  const todayUnseenErrRows = todayRisk.errRows.filter((r) => isUnseen(r.created_at));
  const yesterdayUnseenErrRows = yesterdayRisk.errRows.filter((r) => isUnseen(r.created_at));
  const todayUnseenPaidNoDelivered = todayRisk.paidNoDelivered.filter((u) => isUnseen(u.created_at));
  const yesterdayUnseenPaidNoDelivered = yesterdayRisk.paidNoDelivered.filter((u) => isUnseen(u.created_at));

  if (
    todayUnseenErrRows.length > 0 ||
    yesterdayUnseenErrRows.length > 0 ||
    todayUnseenPaidNoDelivered.length > 0 ||
    yesterdayUnseenPaidNoDelivered.length > 0
  ) {
    section("🚨  미확인 결과 제공 경고");
    if (previousDashboardRunAt > 0) {
      console.log(`  ${c.dim}기준: 이전 대시보드 실행 ${fmtHM(previousDashboardRunIso)} KST 이후 새로 발생한 건만 표시${c.reset}`);
    }
    console.log(
      `  오늘 새 ERR ${c.red}${todayUnseenErrRows.length}${c.reset}건 · 새 결과미제공 ${c.red}${todayUnseenPaidNoDelivered.length}${c.reset}명 / ` +
      `어제 새 ERR ${c.red}${yesterdayUnseenErrRows.length}${c.reset}건 · 새 결과미제공 ${c.red}${yesterdayUnseenPaidNoDelivered.length}${c.reset}명`,
    );
    const topErrs = [...todayUnseenErrRows, ...yesterdayUnseenErrRows]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5);
    if (topErrs.length > 0) {
      console.log(`  ${c.red}미확인 실패 최근:${c.reset}`);
      for (const r of topErrs) console.log(`    - ${fmtHM(r.created_at)} ${r.kind} / ${r.name ?? "—"}`);
    }
    const unseenPaidNoDelivered = [...todayUnseenPaidNoDelivered, ...yesterdayUnseenPaidNoDelivered]
      .sort((a, b) => +(new Date(b.created_at ?? 0)) - +(new Date(a.created_at ?? 0)))
      .slice(0, 5);
    if (unseenPaidNoDelivered.length > 0) {
      console.log(`  ${c.red}미확인 결제했지만 성공 결과 없는 사용자:${c.reset}`);
      for (const u of unseenPaidNoDelivered) {
        const ch = classifyChannel(u.referrer ?? null, u.utm_source ?? null);
        console.log(`    - ${fmtHM(u.created_at)} ${u.nickname ?? String(u.id).slice(0, 8)} / ${ch.short} / ${u.landing_path ?? "—"}`);
      }
    }
  }

  section("📊  핵심 지표");
  const header = `${padR("기간", 12)} ${padL("가입", 6)} ${padL("개인", 6)} ${padL("올해", 6)} ${padL("오늘", 6)} ${padL("배틀", 6)} ${padL("리포트", 7)} ${padL("결제", 6)} ${padL("매출", 12)}`;
  console.log("  " + c.dim + header + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(header)) + c.reset);
  for (const r of rows) {
    const color = r.users > 0 || r.pays > 0 ? c.green : c.dim;
    const rev = r.revenue > 0 ? `${r.revenue.toLocaleString()}원` : "—";
    console.log(
      `  ${padR(r.period, 12)} ${color}${padL(String(r.users || "—"), 6)}${c.reset} ${padL(String(r.results || "—"), 6)} ${padL(String(r.yearly || "—"), 6)} ${padL(String(r.today || "—"), 6)} ${padL(String(r.battles || "—"), 6)} ${r.reports > 0 ? c.magenta : c.dim}${padL(String(r.reports || "—"), 7)}${c.reset} ${padL(String(r.pays || "—"), 6)} ${padL(rev, 12)}`,
    );
  }

  // ── 1-1. 운영 요약 ──────────────────────────
  const h1 = rows[0];
  const todayRow = rows[1];
  const d7row = rows[3];
  const signupToAnalysis = pct(todayRow.results, todayRow.users);
  const signupToPay = pct(todayRow.pays, todayRow.users);
  const avgPay = todayRow.pays > 0 ? Math.round(todayRow.revenue / todayRow.pays) : 0;
  const avgRevenuePerSignup = todayRow.users > 0 ? Math.round(todayRow.revenue / todayRow.users) : 0;

  section("🧭  운영 요약");
  console.log(`  지금 1시간   가입 ${c.green}${h1.users}${c.reset} · 개인 ${c.cyan}${h1.results}${c.reset} · 결제 ${c.yellow}${h1.pays}${c.reset} · 매출 ${c.yellow}${h1.revenue.toLocaleString()}원${c.reset}`);
  // 분자가 '건수'라 100%를 넘을 수 있다(1인이 여러 번 결제). 결제'자' 비율은 아래 유료 전환 퍼널의 결제율을 봐야 한다.
  console.log(`  오늘 비율    개인/가입 ${c.bold}${signupToAnalysis}%${c.reset}${c.dim}(반복 포함)${c.reset}  결제건/가입 ${c.bold}${signupToPay}%${c.reset}${c.dim}(건수 기준)${c.reset}  객단가 ${c.bold}${avgPay.toLocaleString()}원${c.reset}  가입당매출 ${c.bold}${avgRevenuePerSignup.toLocaleString()}원${c.reset}`);
  console.log(`  7일 규모     가입 ${c.green}${d7row.users}명${c.reset} · 개인 ${c.cyan}${d7row.results}건${c.reset} · 올해 ${c.yellow}${d7row.yearly}건${c.reset} · 오늘 ${c.magenta}${d7row.today}건${c.reset} · 결제 ${c.yellow}${d7row.pays}건${c.reset} · 매출 ${c.yellow}${d7row.revenue.toLocaleString()}원${c.reset}`);
  console.log(`  운세 상품    올해 ${todayRow.yearly > 0 ? c.yellow + todayRow.yearly + c.reset : c.dim + "0" + c.reset}건 · 오늘 ${todayRow.today > 0 ? c.magenta + todayRow.today + c.reset : c.dim + "0" + c.reset}건 ${c.dim}(운영자 테스트 제외)${c.reset}`);

  // ── 1-1-1. 어제 요약 ──────────────────────────
  const [yUsers, yPersonal, yYearly, yToday, yBattles, yPayments, yChannels, yGrades] = await Promise.all([
    sb
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("id", "in", INTERNAL_ID_LIST),
    sb
      .from("saju_results")
      .select("id", { count: "exact", head: true })
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("user_id", "in", INTERNAL_ID_LIST),
    sb
      .from("yearly_results")
      .select("id", { count: "exact", head: true })
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("user_id", "in", INTERNAL_ID_LIST),
    sb
      .from("today_results")
      .select("id", { count: "exact", head: true })
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("user_id", "in", INTERNAL_ID_LIST),
    sb
      .from("saju_battles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("user_id", "in", INTERNAL_ID_LIST),
    sb
      .from("payment_transactions")
      .select("amount, method, user_id")
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .eq("status", "success"),
    sb
      .from("users")
      .select("referrer, utm_source")
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("id", "in", INTERNAL_ID_LIST),
    sb
      .from("saju_results")
      .select("full_json")
      .gte("created_at", YESTERDAY_START)
      .lt("created_at", YESTERDAY_END)
      .not("user_id", "in", INTERNAL_ID_LIST),
  ]);
  const yPaid = (yPayments.data ?? []).filter(isPayable);
  const yRevenue = yPaid.reduce((s, x) => s + (x.amount ?? 0), 0);
  const yChannelCounts = new Map<string, { short: string; count: number; color: string }>();
  for (const u of yChannels.data ?? []) {
    const ch = classifyChannel(u.referrer, u.utm_source);
    const cur = yChannelCounts.get(ch.short) ?? { short: ch.short, count: 0, color: ch.color };
    cur.count++;
    yChannelCounts.set(ch.short, cur);
  }
  const yTopChannels = [...yChannelCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((x) => `${x.color}${x.short} ${x.count}${c.reset}`)
    .join(" / ") || `${c.dim}없음${c.reset}`;
  const gradeCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, ERR: 0 };
  for (const row of yGrades.data ?? []) {
    const fj = row.full_json as any;
    const g = fj?._error ? "ERR" : fj?.tier?.grade;
    if (typeof g === "string" && g in gradeCounts) gradeCounts[g]++;
  }
  const yGradeLine = `S ${gradeCounts.S} · A ${gradeCounts.A} · B ${gradeCounts.B} · C ${gradeCounts.C} · D ${gradeCounts.D}${gradeCounts.ERR ? ` · ERR ${gradeCounts.ERR}` : ""}`;

  section(`📌  어제 요약  ${c.dim}(${YESTERDAY_KST}, KST)${c.reset}`);
  const yReportRow = rows[2];
  const yReportBreak = Object.entries(yReportRow.reportByKind).map(([k, v]) => `${k} ${v}`).join(" · ");
  console.log(`  가입 ${c.green}${yUsers.count ?? 0}명${c.reset} · 개인 ${c.cyan}${yPersonal.count ?? 0}건${c.reset} · 올해 ${c.yellow}${yYearly.count ?? 0}건${c.reset} · 오늘 ${c.magenta}${yToday.count ?? 0}건${c.reset} · 배틀 ${c.magenta}${yBattles.count ?? 0}건${c.reset} · 리포트 ${c.brand}${yReportRow.reports}건${c.reset} · 결제 ${c.yellow}${yPaid.length}건${c.reset} · 매출 ${c.yellow}${yRevenue.toLocaleString()}원${c.reset}`);
  if (yReportRow.reports > 0) console.log(`  리포트 내역 ${c.dim}${yReportBreak}${c.reset}`);
  console.log(`  유입 TOP   ${yTopChannels}`);
  console.log(`  등급 분포  ${yGradeLine}`);

  // ── 1-1-2. 무료 코인 제거 후 핵심 퍼널 ──────────────────────────
  // 무료 코인 지급이 없어지면 "가입→무료 분석"보다 "가입→결제→분석"이 핵심이다.
  async function loadPaidFunnel(startIso: string, endIso: string, label: string) {
    const [usersRes, paysRes, personalRes, yearlyRes, todayRes, battleRes, reportRows] = await Promise.all([
      sb
        .from("users")
        .select("id, nickname, created_at, referrer, utm_source, landing_path")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("id", "in", INTERNAL_ID_LIST)
        .order("created_at", { ascending: false }),
      sb
        .from("payment_transactions")
        .select("amount, method, user_id, created_at")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .eq("status", "success")
        .order("created_at", { ascending: false }),
      sb
        .from("saju_results")
        .select("user_id, created_at, full_json")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      sb
        .from("yearly_results")
        .select("user_id, created_at, full_json")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      sb
        .from("today_results")
        .select("user_id, created_at, full_json")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      sb
        .from("saju_battles")
        .select("user_id, created_at")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("user_id", "in", INTERNAL_ID_LIST),
      loadReportRows(startIso, endIso),
    ]);

    const users = usersRes.data ?? [];
    const paid = (paysRes.data ?? []).filter(isPayable);
    const paidUserIds = new Set(paid.map((p) => p.user_id).filter(Boolean) as string[]);
    const deliveredUserIds = new Set<string>();
    const failedUserIds = new Set<string>();
    let failedResults = 0;
    const addResultState = (row: any) => {
      if (!row.user_id) return;
      if ((row.full_json as any)?._error) {
        failedResults++;
        failedUserIds.add(row.user_id);
      } else {
        deliveredUserIds.add(row.user_id);
      }
    };
    for (const row of personalRes.data ?? []) addResultState(row);
    for (const row of yearlyRes.data ?? []) addResultState(row);
    for (const row of todayRes.data ?? []) addResultState(row);
    // 유료 리포트 4종(결혼·커리어·재물·펫) — 언락된 것만 결과 제공 단위
    for (const row of reportRows.filter((r) => r.unlocked)) addResultState(row);
    // 배틀은 저장된 row가 결과 제공 단위다. 실패 row는 별도 테이블에 남기지 않는 구조.
    for (const row of battleRes.data ?? []) if (row.user_id) deliveredUserIds.add(row.user_id);

    const signupUserIds = new Set(users.map((u) => u.id));
    const signupPaid = users.filter((u) => paidUserIds.has(u.id)).length;
    const signupDelivered = users.filter((u) => deliveredUserIds.has(u.id)).length;
    const signupNoPay = users.filter((u) => !paidUserIds.has(u.id));
    const paidNoDeliveredRaw = [...paidUserIds].filter((id) => !deliveredUserIds.has(id));
    // 창 안에서 결과를 못 찾았다고 바로 경고하지 않는다 — 본인삭제·창밖완료·재사용을 먼저 설명한다.
    const { unexplained: paidNoDelivered, explained: noDeliveryReasons } =
      await explainNoDelivery(paidNoDeliveredRaw, startIso, endIso);
    const revenue = paid.reduce((sum, p) => sum + (p.amount ?? 0), 0);

    return {
      label,
      users,
      signups: users.length,
      signupPaid,
      signupDelivered,
      payCount: paid.length,
      paidUsers: paidUserIds.size,
      revenue,
      deliveredUsers: deliveredUserIds.size,
      failedUsers: failedUserIds.size,
      failedResults,
      signupNoPay,
      paidNoDelivered,
      noDeliveryReasons,
      signupUserIds,
    };
  }

  const tomorrowKst = new Date(now + 9 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10);
  const TOMORROW_START = new Date(`${tomorrowKst}T00:00:00+09:00`).toISOString();
  const [todayFunnel, yesterdayFunnel] = await Promise.all([
    loadPaidFunnel(TODAY_START, TOMORROW_START, "오늘"),
    loadPaidFunnel(YESTERDAY_START, YESTERDAY_END, "어제"),
  ]);

  section("💰  유료 전환 퍼널  " + c.dim + "(무료 코인 제거 후 핵심)" + c.reset);
  const fHead = `${padR("구간", 6)} ${padL("가입", 5)} ${padL("결제자", 6)} ${padL("결제율", 6)} ${padL("결제건", 6)} ${padL("매출", 10)} ${padL("성공자", 6)} ${padL("가입→성공", 9)} ${padL("ERR", 5)} ${padL("미결제", 6)} ${padL("결과미제공", 10)}`;
  console.log("  " + c.dim + fHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(fHead)) + c.reset);
  for (const f of [todayFunnel, yesterdayFunnel]) {
    const payRate = `${pct(f.signupPaid, f.signups)}%`;
    const deliveredRate = `${pct(f.signupDelivered, f.signups)}%`;
    const noPayCount = f.signupNoPay.length;
    const paidNoDeliveredCount = f.paidNoDelivered.length;
    const failedColor = f.failedResults > 0 ? c.red : c.dim;
    const paidNoDeliveredColor = paidNoDeliveredCount > 0 ? c.red : c.dim;
    console.log(
      `  ${padR(f.label, 6)} ${padL(String(f.signups), 5)} ${padL(String(f.paidUsers), 6)} ${padL(payRate, 6)} ${padL(String(f.payCount), 6)} ${c.yellow}${padL(`${f.revenue.toLocaleString()}원`, 10)}${c.reset} ${padL(String(f.deliveredUsers), 6)} ${padL(deliveredRate, 9)} ${failedColor}${padL(String(f.failedResults), 5)}${c.reset} ${padL(String(noPayCount), 6)} ${paidNoDeliveredColor}${padL(String(paidNoDeliveredCount), 10)}${c.reset}`,
    );
    if (f.noDeliveryReasons.size > 0) {
      const tally: Record<string, number> = {};
      for (const why of f.noDeliveryReasons.values()) tally[why] = (tally[why] ?? 0) + 1;
      const detail = Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ");
      console.log(`  ${c.dim}       └ 창 안에 결과가 없지만 설명된 ${f.noDeliveryReasons.size}명: ${detail}${c.reset}`);
    }
  }

  const paidNoAnalysisUsers = new Map<string, { nickname: string | null; created_at: string; referrer: string | null; utm_source: string | null; landing_path: string | null }>();
  if (todayFunnel.paidNoDelivered.length > 0) {
    const { data: paidNoAnalysisProfiles } = await sb
      .from("users")
      .select("id, nickname, created_at, referrer, utm_source, landing_path")
      .in("id", todayFunnel.paidNoDelivered);
    for (const u of paidNoAnalysisProfiles ?? []) paidNoAnalysisUsers.set(u.id, u);
  }
  if (todayFunnel.paidNoDelivered.length > 0) {
    console.log(`  ${c.red}주의${c.reset} 오늘 결제했지만 성공 결과가 없는 사용자:`);
    for (const id of todayFunnel.paidNoDelivered.slice(0, 8)) {
      const u = paidNoAnalysisUsers.get(id);
      const ch = classifyChannel(u?.referrer ?? null, u?.utm_source ?? null);
      console.log(`    - ${fmtHM(u?.created_at)} ${u?.nickname ?? id.slice(0, 8)} / ${ch.short} / ${u?.landing_path ?? "—"}`);
    }
  }
  const recentNoPay = todayFunnel.signupNoPay.slice(0, 6);
  if (recentNoPay.length > 0) {
    console.log(`  ${c.dim}최근 미결제 가입자:${c.reset}`);
    for (const u of recentNoPay) {
      const ch = classifyChannel(u.referrer, u.utm_source);
      console.log(`    - ${fmtHM(u.created_at)} ${u.nickname ?? "—"} / ${ch.short} / ${u.landing_path ?? "—"}`);
    }
  }

  // ── 1-2. 오늘 분석 로그를 상단에 노출 ─────────────
  const [recentPersonalRes, recentYearlyRes, recentTodayRes, recentBattleRes, recentReportRows] = await Promise.all([
    sb
    .from("saju_results")
    .select("name, birth_date, gender, region, user_id, created_at, full_json")
      .gte("created_at", TODAY_START)
    .not("user_id", "in", INTERNAL_ID_LIST)
      .order("created_at", { ascending: false }),
    sb
      .from("yearly_results")
      .select("name, birth_date, gender, region, user_id, created_at, target_year, full_json")
      .gte("created_at", TODAY_START)
      .not("user_id", "in", INTERNAL_ID_LIST)
      .order("created_at", { ascending: false }),
    sb
      .from("today_results")
      .select("name, birth_date, gender, region, user_id, created_at, target_date, full_json")
      .gte("created_at", TODAY_START)
      .not("user_id", "in", INTERNAL_ID_LIST)
      .order("created_at", { ascending: false }),
    sb
      .from("saju_battles")
      .select("player_a_name, player_b_name, player_a_grade, player_b_grade, wins_a, wins_b, draws, relationship_type, user_id, created_at")
      .gte("created_at", TODAY_START)
      .not("user_id", "in", INTERNAL_ID_LIST)
      .order("created_at", { ascending: false }),
    loadReportRows(TODAY_START),
  ]);

  type RecentAnalysis = {
    created_at: string;
    user_id: string | null;
    kind: "개인" | "배틀" | "올해" | "오늘" | "결혼" | "커리어" | "재물" | "펫";
    name: string;
    birthDate: string | null;
    gender: string | null;
    region: string | null;
    grade: string;
    score: string;
  };

  const recentAnalyses: RecentAnalysis[] = [];
  for (const r of recentPersonalRes.data ?? []) {
    const fj = r.full_json as any;
    recentAnalyses.push({
      created_at: r.created_at,
      user_id: r.user_id,
      kind: "개인",
      name: r.name ?? "—",
      birthDate: r.birth_date ?? null,
      gender: r.gender ?? null,
      region: r.region ?? null,
      grade: fj?._error ? "ERR" : fj?.tier?.grade ?? (!fj ? "..." : "—"),
      score: fj?._error || !fj ? "—" : typeof fj?.tier?.composite === "number" ? String(fj.tier.composite) : "—",
    });
  }
  for (const r of recentYearlyRes.data ?? []) {
    const fj = r.full_json as any;
    recentAnalyses.push({
      created_at: r.created_at,
      user_id: r.user_id,
      kind: "올해",
      name: r.name ?? "—",
      birthDate: r.birth_date ?? null,
      gender: r.gender ?? null,
      region: r.region ?? null,
      grade: fj?._error ? "ERR" : fj?.tier?.grade ?? (!fj ? "..." : "—"),
      score: fj?._error || !fj ? "—" : typeof fj?.tier?.composite === "number" ? String(Math.round(fj.tier.composite)) : "—",
    });
  }
  for (const r of recentTodayRes.data ?? []) {
    const fj = r.full_json as any;
    recentAnalyses.push({
      created_at: r.created_at,
      user_id: r.user_id,
      kind: "오늘",
      name: r.name ?? "—",
      birthDate: r.birth_date ?? null,
      gender: r.gender ?? null,
      region: r.region ?? null,
      grade: fj?._error ? "ERR" : fj?.tier?.grade ?? (!fj ? "..." : "—"),
      score: fj?._error || !fj ? "—" : typeof fj?.tier?.composite === "number" ? String(Math.round(fj.tier.composite)) : "—",
    });
  }
  for (const r of recentBattleRes.data ?? []) {
    recentAnalyses.push({
      created_at: r.created_at,
      user_id: r.user_id,
      kind: "배틀",
      name: `${r.player_a_name ?? "—"}×${r.player_b_name ?? "—"}`,
      birthDate: null,
      gender: null,
      region: null,
      grade: `${r.player_a_grade ?? "—"}/${r.player_b_grade ?? "—"}`,
      score: `${r.wins_a ?? 0}:${r.wins_b ?? 0}${r.draws ? `:${r.draws}` : ""}`,
    });
  }
  // 언락된 리포트만 '분석'으로 센다(티저 열람은 분석이 아니다)
  for (const r of recentReportRows.filter((x) => x.unlocked)) {
    recentAnalyses.push({
      created_at: r.created_at,
      user_id: r.user_id,
      kind: r.kind as RecentAnalysis["kind"],
      name: r.name ?? "—",
      birthDate: r.birth_date,
      gender: r.gender,
      region: r.region,
      // 리포트는 개인사주와 다른 자체 등급 체계(marriage_grade 등)를 쓴다. 점수 개념은 없다.
      grade: reportFailed(r) ? "ERR" : r.grade ?? "—",
      score: "—",
    });
  }
  recentAnalyses.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const recentAnalysisUserIds = [...new Set(recentAnalyses.map((r) => r.user_id).filter(Boolean))] as string[];
  const resultUserMapTop = new Map<string, { nickname: string | null; referrer: string | null; utm_source: string | null; landing_path: string | null }>();
  if (recentAnalysisUserIds.length > 0) {
    const { data: resultUsersTop } = await sb
      .from("users")
      .select("id, nickname, referrer, utm_source, landing_path")
      .in("id", recentAnalysisUserIds);
    for (const u of resultUsersTop ?? []) {
      resultUserMapTop.set(u.id, {
        nickname: u.nickname,
        referrer: u.referrer,
        utm_source: u.utm_source,
        landing_path: u.landing_path,
      });
    }
  }

  section(`🔮  오늘 분석  ${c.dim}(${TODAY_KST} 00:00 이후, ${recentAnalyses.length}건)${c.reset}`);
  if (previousDashboardRunAt > 0) {
    console.log(`  ${c.dim}이전 대시보드 실행: ${fmtHM(previousDashboardRunIso)} KST · 이 이후 생성된 분석은 위쪽에 표시${c.reset}`);
  }
  if (recentAnalyses.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const head = `${padR("시각", 14)} ${padR("카카오닉", 12)} ${padR("등급", 6)} ${padR("점수", 6)} ${padR("이름", 16)} ${padR("생년월일", 12)} ${padR("성", 4)} ${padR("지역", 6)} ${padR("유입", 10)} ${padR("랜딩", 14)} ${padR("종류", 6)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    let separatorPrinted = false;
    let newRowsPrinted = false;
    const hasNewRows = previousDashboardRunAt > 0 && recentAnalyses.some((r) => +new Date(r.created_at) > previousDashboardRunAt);
    for (const r of recentAnalyses.slice(0, 30)) {
      const isNewSinceLastRun = previousDashboardRunAt > 0 && +new Date(r.created_at) > previousDashboardRunAt;
      if (isNewSinceLastRun) newRowsPrinted = true;
      if (hasNewRows && newRowsPrinted && !isNewSinceLastRun && !separatorPrinted) {
        console.log("  " + c.yellow + "─".repeat(visualWidth(head)) + c.reset);
        console.log(`  ${c.yellow}↑ 이전 대시보드 이후 새로 추가 / ↓ 기존 오늘 분석${c.reset}`);
        console.log("  " + c.yellow + "─".repeat(visualWidth(head)) + c.reset);
        separatorPrinted = true;
      }
      const member = r.user_id ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
      const name = r.name ?? "—";
      const gender = r.gender === "남성" ? `${c.blue}♂${c.reset}` : r.gender === "여성" ? `${c.magenta}♀${c.reset}` : "·";
      const u = r.user_id ? resultUserMapTop.get(r.user_id) : null;
      const nick = clip(u?.nickname ?? "—", 12);
      const ch = classifyChannel(u?.referrer ?? null, u?.utm_source ?? null);
      const landing = (u?.landing_path ?? "—").slice(0, 12);
      const kindColor =
        r.kind === "개인" ? c.cyan :
        r.kind === "배틀" ? c.magenta :
        r.kind === "오늘" ? c.blue :
        r.kind === "결혼" || r.kind === "커리어" || r.kind === "재물" || r.kind === "펫" ? c.brand :
        c.yellow;
      console.log(
        `  ${padR(fmtHM(r.created_at), 14)} ${padR(nick, 12)} ${padR(clip(r.grade, 6), 6)} ${padL(r.score, 6)} ${member}  ${padR(clip(name, 16), 16)} ${padR(r.birthDate ?? "—", 12)} ${gender}  ${c.dim}${padR(clip(r.region ?? "—", 6), 6)}${c.reset} ${ch.color}${padR(ch.short, 10)}${c.reset} ${c.dim}${padR(landing, 14)}${c.reset} ${kindColor}${padR(r.kind, 6)}${c.reset}`,
      );
    }
  }

  // ── 2. 추이 ────────────────────────────────
  const prev7Users = (await countSince("users", D14, "id")) - (await countSince("users", D7, "id"));
  const last7Users = rows[3].users;
  const delta = last7Users - prev7Users;
  const trend = delta > 0 ? `${c.green}+${delta}명 📈${c.reset}` : delta < 0 ? `${c.red}${delta}명 📉${c.reset}` : `${c.dim}변화없음${c.reset}`;
  section("📈  이번 주 추이");
  console.log(`  이번 7일   ${c.bold}${c.green}${last7Users}명${c.reset}`);
  console.log(`  지난 7일   ${c.dim}${prev7Users}명${c.reset}`);
  console.log(`  증감       ${trend}`);

  // ── 2-1. 시간대별 가입 (최근 24h, 1h 단위) ──────────────
  const { data: u24h } = await sb
    .from("users")
    .select("created_at")
    .gte("created_at", H24)
    .not("id", "in", INTERNAL_ID_LIST)
    .order("created_at", { ascending: true });
  const { data: r24h } = await sb
    .from("saju_results")
    .select("created_at")
    .gte("created_at", H24)
    .not("user_id", "in", INTERNAL_ID_LIST);
  const { data: y24h } = await sb
    .from("yearly_results")
    .select("created_at")
    .gte("created_at", H24)
    .not("user_id", "in", INTERNAL_ID_LIST);
  const { data: t24h } = await sb
    .from("today_results")
    .select("created_at")
    .gte("created_at", H24)
    .not("user_id", "in", INTERNAL_ID_LIST);

  const rep24h = await loadReportRows(H24);

  const hourBuckets = new Map<string, { signups: number; analyses: number; yearly: number; today: number; reports: number }>();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 3600_000);
    const k = new Date(t.getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    hourBuckets.set(k, { signups: 0, analyses: 0, yearly: 0, today: 0, reports: 0 });
  }
  for (const r of rep24h.filter((x) => x.unlocked)) {
    const k = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.reports++;
  }
  for (const u of u24h ?? []) {
    const k = new Date(new Date(u.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.signups++;
  }
  for (const r of r24h ?? []) {
    const k = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.analyses++;
  }
  for (const y of y24h ?? []) {
    const k = new Date(new Date(y.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.yearly++;
  }
  for (const t of t24h ?? []) {
    const k = new Date(new Date(t.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.today++;
  }
  const hMax = Math.max(...[...hourBuckets.values()].map((v) => Math.max(v.signups, v.analyses, v.yearly, v.today, v.reports)), 1);
  section("⏱   시간대별 추이  " + c.dim + "(최근 24h, KST)" + c.reset);
  const hHead = `${padR("시각", 12)} ${padL("가입", 4)} ${padL("개인", 4)} ${padL("올해", 4)} ${padL("오늘", 4)} ${padL("리포트", 6)}  추이 (■가입 / ▣개인 / ◆올해 / ◇오늘 / ◈리포트)`;
  console.log("  " + c.dim + hHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(hHead)) + c.reset);
  for (const [k, v] of hourBuckets) {
    const sBar = "■".repeat(Math.round((v.signups / hMax) * 20));
    const aBar = "▣".repeat(Math.round((v.analyses / hMax) * 20));
    const yBar = "◆".repeat(Math.round((v.yearly / hMax) * 20));
    const tBar = "◇".repeat(Math.round((v.today / hMax) * 20));
    const sCnt = v.signups > 0 ? `${c.green}${padL(String(v.signups), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const aCnt = v.analyses > 0 ? `${c.cyan}${padL(String(v.analyses), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const yCnt = v.yearly > 0 ? `${c.yellow}${padL(String(v.yearly), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const tCnt = v.today > 0 ? `${c.blue}${padL(String(v.today), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const rBar = "◈".repeat(Math.round((v.reports / hMax) * 20));
    const rCnt = v.reports > 0 ? `${c.brand}${padL(String(v.reports), 6)}${c.reset}` : `${c.dim}${padL("—", 6)}${c.reset}`;
    console.log(`  ${padR(k, 12)} ${sCnt} ${aCnt} ${yCnt} ${tCnt} ${rCnt}  ${c.green}${sBar}${c.reset}${c.cyan}${aBar}${c.reset}${c.yellow}${yBar}${c.reset}${c.blue}${tBar}${c.reset}${c.brand}${rBar}${c.reset}`);
  }

  // ── 2-2. 일자별 추이 (최근 14일) ──────────────
  const { data: u14d } = await sb
    .from("users")
    .select("created_at")
    .gte("created_at", D14)
    .not("id", "in", INTERNAL_ID_LIST)
    .order("created_at", { ascending: true });
  const { data: r14d } = await sb
    .from("saju_results")
    .select("created_at")
    .gte("created_at", D14)
    .not("user_id", "in", INTERNAL_ID_LIST);
  const { data: y14d } = await sb
    .from("yearly_results")
    .select("created_at")
    .gte("created_at", D14)
    .not("user_id", "in", INTERNAL_ID_LIST);
  const { data: t14d } = await sb
    .from("today_results")
    .select("created_at")
    .gte("created_at", D14)
    .not("user_id", "in", INTERNAL_ID_LIST);
  const { data: p14d } = await sb
    .from("payment_transactions")
    .select("amount, method, user_id, created_at")
    .gte("created_at", D14)
    .eq("status", "success")
    .eq("method", "KAKAOPAY");
  const rep14d = await loadReportRows(D14);

  const dayBuckets = new Map<string, { signups: number; analyses: number; yearly: number; today: number; reports: number; pays: number; revenue: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600_000);
    const k = new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    dayBuckets.set(k, { signups: 0, analyses: 0, yearly: 0, today: 0, reports: 0, pays: 0, revenue: 0 });
  }
  for (const r of rep14d.filter((x) => x.unlocked)) {
    const k = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.reports++;
  }
  for (const u of u14d ?? []) {
    const k = new Date(new Date(u.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.signups++;
  }
  for (const r of r14d ?? []) {
    const k = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.analyses++;
  }
  for (const y of y14d ?? []) {
    const k = new Date(new Date(y.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.yearly++;
  }
  for (const t of t14d ?? []) {
    const k = new Date(new Date(t.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.today++;
  }
  for (const p of (p14d ?? []).filter(isPayable)) {
    const k = new Date(new Date(p.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) {
      dayBuckets.get(k)!.pays++;
      dayBuckets.get(k)!.revenue += p.amount ?? 0;
    }
  }
  const dMax = Math.max(...[...dayBuckets.values()].map((v) => v.signups), 1);
  section("📅  일자별 추이  " + c.dim + "(최근 14일, KST)" + c.reset);
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dHead = `${padR("날짜", 14)} ${padL("가입", 4)} ${padL("개인", 4)} ${padL("올해", 4)} ${padL("오늘", 4)} ${padL("리포트", 6)} ${padL("결제", 4)} ${padL("매출", 9)}  가입 추이`;
  console.log("  " + c.dim + dHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(dHead)) + c.reset);
  for (const [k, v] of dayBuckets) {
    const dow = dayNames[new Date(k + "T00:00:00Z").getUTCDay()];
    const dowColor = dow === "토" || dow === "일" ? c.red : c.dim;
    const bar = "█".repeat(Math.round((v.signups / dMax) * 30));
    const sCnt = v.signups > 0 ? `${c.green}${padL(String(v.signups), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const aCnt = v.analyses > 0 ? `${c.cyan}${padL(String(v.analyses), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const yCnt = v.yearly > 0 ? `${c.yellow}${padL(String(v.yearly), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const tCnt = v.today > 0 ? `${c.blue}${padL(String(v.today), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const rCnt = v.reports > 0 ? `${c.brand}${padL(String(v.reports), 6)}${c.reset}` : `${c.dim}${padL("—", 6)}${c.reset}`;
    const pCnt = v.pays > 0 ? `${c.yellow}${padL(String(v.pays), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const rev = v.revenue > 0 ? `${v.revenue.toLocaleString()}원` : "—";
    const revColored = v.revenue > 0 ? `${c.yellow}${padL(rev, 9)}${c.reset}` : `${c.dim}${padL(rev, 9)}${c.reset}`;
    console.log(`  ${padR(k + " " + dowColor + "(" + dow + ")" + c.reset, 14 + dowColor.length + c.reset.length)} ${sCnt} ${aCnt} ${yCnt} ${tCnt} ${rCnt} ${pCnt} ${revColored}  ${c.green}${bar}${c.reset}`);
  }

  // ── 3. 유료 심층 리포트 현황 ─────────────────────────
  // 가입 보너스 자리를 대체한다. 이벤트는 2026-06-21 종료됐고 그 뒤 signup_bonus 지급이 0건이라
  // 상시 표시할 값어치가 없다. 대신 회귀 감시만 남겨(아래) 다시 지급되면 그때만 경고한다.
  const rNow = rows[1];      // 오늘
  const rYesterday = rows[2]; // 어제
  const rWeek = rows[3];      // 7일
  const weekReportRows = await loadReportRows(D7);
  const cumulative: Record<string, number> = {};
  for (const r of REPORT_KINDS) {
    const { count } = await sb.from(r.table).select("*", { count: "exact", head: true })
      .not("full_json", "is", null)
      .not("user_id", "in", INTERNAL_ID_LIST);
    cumulative[r.kind] = count ?? 0;
  }
  {
    const { count } = await sb.from("pet_compat_results").select("*", { count: "exact", head: true }).not("user_id", "in", INTERNAL_ID_LIST);
    cumulative["펫"] = count ?? 0;
  }

  section("💎  유료 심층 리포트  " + c.dim + "(언락=결제 완료. 티저는 결제 전 미리보기)" + c.reset);
  const kindOrder = ["결혼", "커리어", "재물", "펫"];
  const rHead = `${padR("상품", 10)} ${padL("오늘", 5)} ${padL("어제", 5)} ${padL("7일", 5)} ${padL("누적", 6)} ${padL("티저이탈", 8)} ${padL("언락률", 6)} ${padL("실패", 5)}`;
  console.log("  " + c.dim + rHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(rHead)) + c.reset);
  let weekTotal = 0, teaserTotal = 0, failedTotal = 0;
  for (const kind of kindOrder) {
    const wk = weekReportRows.filter((x) => x.kind === kind);
    const unlocked = wk.filter((x) => x.unlocked);
    const teaserOnly = wk.length - unlocked.length;
    const failed = wk.filter(reportFailed).length;
    weekTotal += unlocked.length;
    teaserTotal += teaserOnly;
    failedTotal += failed;
    const col = unlocked.length > 0 ? c.brand : c.dim;
    const rate = wk.length > 0 ? `${pct(unlocked.length, wk.length)}%` : "—";
    console.log(
      `  ${padR(kind, 10)} ${padL(String(rNow.reportByKind[kind] ?? 0), 5)} ${padL(String(rYesterday.reportByKind[kind] ?? 0), 5)} ${col}${padL(String(unlocked.length), 5)}${c.reset} ${padL(String(cumulative[kind] ?? 0), 6)} ${teaserOnly > 0 ? c.yellow : c.dim}${padL(String(teaserOnly), 8)}${c.reset} ${padL(rate, 6)} ${failed > 0 ? c.red : c.dim}${padL(String(failed), 5)}${c.reset}`,
    );
  }
  console.log("  " + c.dim + "─".repeat(visualWidth(rHead)) + c.reset);
  const totalRows = weekTotal + teaserTotal;
  console.log(
    `  ${padR("합계", 10)} ${padL(String(rNow.reports), 5)} ${padL(String(rYesterday.reports), 5)} ${c.bold}${padL(String(weekTotal), 5)}${c.reset} ${padL(String(Object.values(cumulative).reduce((a, b) => a + b, 0)), 6)} ${teaserTotal > 0 ? c.yellow : c.dim}${padL(String(teaserTotal), 8)}${c.reset} ${padL(totalRows > 0 ? `${pct(weekTotal, totalRows)}%` : "—", 6)} ${failedTotal > 0 ? c.red : c.dim}${padL(String(failedTotal), 5)}${c.reset}`,
  );
  const personalWeek = rWeek.results;
  if (weekTotal > 0) {
    console.log(`  ${c.dim}7일 기준 개인사주 ${personalWeek}건 대비 리포트 ${weekTotal}건 (${pct(weekTotal, personalWeek + weekTotal)}%가 심층 리포트)${c.reset}`);
  }
  console.log(`  ${c.dim}티저이탈 = 미리보기만 보고 결제 안 함(정상 이탈, 손실 아님). 실패 = 결제 후 본문 _error = 진짜 사고.${c.reset}`);
  if (failedTotal > 0) {
    console.log(`  ${c.red}주의${c.reset} 결제 후 본문 실패 ${failedTotal}건 — 환불·재생성 확인 필요.`);
  }

  // ── 3-1. 가입 보너스 회귀 감시 (평소엔 침묵) ─────────────
  // 이벤트는 2026-06-21 종료. 이후 지급이 다시 잡히면 그건 버그다.
  const { count: bonusToday } = await sb
    .from("coin_transactions").select("*", { count: "exact", head: true })
    .eq("reference_id", "signup_bonus")
    .gte("created_at", TODAY_START)
    .not("user_id", "in", INTERNAL_ID_LIST);
  if ((bonusToday ?? 0) > 0) {
    section("🎁  가입 보너스 회귀 경고");
    console.log(`  ${c.red}주의${c.reset} 이벤트 종료(2026-06-21) 후인데 오늘 signup_bonus가 ${c.red}${bonusToday}건${c.reset} 지급됨. 보너스 로직/배포 상태 확인 필요.`);
  }

  // ── 채널 분류 헬퍼 ──────────────────────────────────
  // referrer/utm 값으로 사람이 읽을 수 있는 채널 라벨 + 색상 반환
  function classifyChannel(referrer: string | null, utm_source: string | null): { label: string; short: string; color: string } {
    if (utm_source) return { label: `📣 캠페인 (${utm_source})`, short: `utm:${utm_source}`, color: c.yellow };
    if (!referrer) return { label: "❓ 추적 전 또는 직접입력", short: "(unknown)", color: c.gray };
    const r = referrer.toLowerCase();
    if (r.includes("kakaotalk")) return { label: "💬 카카오톡 인앱", short: "카톡", color: c.yellow };
    if (r.includes("naver_inapp") || r.includes("naver(") || r === "naver_inapp") return { label: "🟢 네이버 앱", short: "네이버앱", color: c.green };
    if (r.includes("instagram")) return { label: "📸 인스타그램", short: "인스타", color: c.magenta };
    if (r.includes("facebook") || r.includes("fban")) return { label: "📘 페이스북", short: "페북", color: c.blue };
    if (r.includes("line")) return { label: "💚 라인", short: "라인", color: c.green };
    if (r.includes("daum")) return { label: "🟠 다음 앱", short: "다음앱", color: c.yellow };
    if (r.includes("twitter") || r.includes("x.com")) return { label: "🐦 X/트위터", short: "X", color: c.cyan };
    if (r.includes("threads")) return { label: "🧵 스레드", short: "스레드", color: c.cyan };
    if (r.includes("tiktok")) return { label: "🎵 틱톡", short: "틱톡", color: c.magenta };
    if (r.includes("google")) return { label: "🔍 구글 검색", short: "구글", color: c.cyan };
    if (r.includes("naver")) return { label: "🟢 네이버 검색", short: "네이버", color: c.green };
    if (r.includes("bing")) return { label: "🔍 빙 검색", short: "빙", color: c.cyan };
    return { label: `🌐 ${referrer.slice(0, 20)}`, short: referrer.slice(0, 12), color: c.white };
  }

  // ── 4. 신규 가입자 (24h) ──────────────────────
  const { data: newUsers } = await sb
    .from("users")
    .select("id, kakao_id, nickname, email, created_at, referrer, utm_source, utm_medium, landing_path")
    .gte("created_at", H24)
    .not("id", "in", INTERNAL_ID_LIST)
    .order("created_at", { ascending: false })
    .limit(15);

  const userIds = (newUsers ?? []).map((u) => u.id);
  let analysisByUser = new Map<string, { personal: number; yearly: number; today: number }>();
  if (userIds.length > 0) {
    const [personalRes, yearlyRes, todayRes] = await Promise.all([
      sb.from("saju_results").select("user_id").in("user_id", userIds),
      sb.from("yearly_results").select("user_id").in("user_id", userIds),
      sb.from("today_results").select("user_id").in("user_id", userIds),
    ]);
    const analyses = personalRes.data ?? [];
    for (const a of analyses ?? []) {
      if (!a.user_id) continue;
      const cur = analysisByUser.get(a.user_id) ?? { personal: 0, yearly: 0, today: 0 };
      cur.personal++;
      analysisByUser.set(a.user_id, cur);
    }
    for (const y of yearlyRes.data ?? []) {
      if (!y.user_id) continue;
      const cur = analysisByUser.get(y.user_id) ?? { personal: 0, yearly: 0, today: 0 };
      cur.yearly++;
      analysisByUser.set(y.user_id, cur);
    }
    for (const t of todayRes.data ?? []) {
      if (!t.user_id) continue;
      const cur = analysisByUser.get(t.user_id) ?? { personal: 0, yearly: 0, today: 0 };
      cur.today++;
      analysisByUser.set(t.user_id, cur);
    }
  }

  section(`👥  오늘 신규 가입자  ${c.dim}(${newUsers?.length ?? 0}명, 최근 24h)${c.reset}`);
  if (!newUsers || newUsers.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const head = `${padR("시각", 12)} ${padR("닉네임", 14)} ${padR("채널", 14)} ${padR("랜딩", 16)} ${padL("개인", 4)} ${padL("올해", 4)} ${padL("오늘", 4)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    for (const u of newUsers) {
      const nick = (u.nickname ?? "—").slice(0, 12);
      const ch = classifyChannel(u.referrer, u.utm_source);
      const n = analysisByUser.get(u.id) ?? { personal: 0, yearly: 0, today: 0 };
      const analyzed = n.personal > 0 ? `${c.green}${n.personal}${c.reset}` : `${c.dim}—${c.reset}`;
      const yearlyCnt = n.yearly > 0 ? `${c.yellow}${n.yearly}${c.reset}` : `${c.dim}—${c.reset}`;
      const todayCnt = n.today > 0 ? `${c.blue}${n.today}${c.reset}` : `${c.dim}—${c.reset}`;
      const land = (u.landing_path ?? "—").slice(0, 14);
      console.log(
        `  ${padR(fmtHM(u.created_at), 12)} ${padR(nick, 14)} ${ch.color}${padR(ch.short, 14)}${c.reset} ${c.dim}${padR(land, 16)}${c.reset} ${padL(analyzed, 4 + (n.personal > 0 ? c.green.length + c.reset.length : c.dim.length + c.reset.length))} ${padL(yearlyCnt, 4 + (n.yearly > 0 ? c.yellow.length + c.reset.length : c.dim.length + c.reset.length))} ${padL(todayCnt, 4 + (n.today > 0 ? c.blue.length + c.reset.length : c.dim.length + c.reset.length))}`,
      );
    }
  }

  // ── 4-2. 채널 집계 (7일) ────────────────────
  const { data: ch7d } = await sb
    .from("users")
    .select("referrer, utm_source")
    .gte("created_at", D7)
    .not("id", "in", INTERNAL_ID_LIST);

  section(`🌍  유입 채널  ${c.dim}(최근 7일, ${ch7d?.length ?? 0}명)${c.reset}`);
  if (!ch7d || ch7d.length === 0) {
    console.log("  " + c.dim + "(데이터 없음)" + c.reset);
  } else {
    const counts = new Map<string, { count: number; color: string; label: string }>();
    for (const u of ch7d) {
      const ch = classifyChannel(u.referrer, u.utm_source);
      const cur = counts.get(ch.label) ?? { count: 0, color: ch.color, label: ch.label };
      cur.count++;
      counts.set(ch.label, cur);
    }
    const total = ch7d.length;
    const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
    for (const x of sorted) {
      const pct = ((x.count / total) * 100).toFixed(0);
      const bar = "█".repeat(Math.min(x.count, 30));
      console.log(`  ${x.color}${padR(x.label, 28)}${c.reset} ${padL(String(x.count), 4)}명 ${c.dim}(${pct}%)${c.reset}  ${x.color}${bar}${c.reset}`);
    }
    const tracked = ch7d.filter((u) => u.referrer || u.utm_source).length;
    const untracked = total - tracked;
    if (untracked > 0) {
      console.log(`  ${c.dim}※ ${untracked}명은 추적 시스템 배포(2026-04-28) 전이거나 referrer/UA 모두 없음${c.reset}`);
    }
  }

  // ── 5. 결제 내역 (24h, 정산 가능 결제만) ─────────────────────
  const { data: recentPayRaw } = await sb
    .from("payment_transactions")
    .select("amount, method, user_id, created_at, order_id")
    .gte("created_at", H24)
    .eq("status", "success")
    .eq("method", "KAKAOPAY")
    .order("created_at", { ascending: false });
  const recentPay = (recentPayRaw ?? []).filter(isPayable);

  section(`💳  결제 내역  ${c.dim}(24h, 정산 가능)${c.reset}`);
  if (recentPay.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const userIdsPay = [...new Set(recentPay.map((p) => p.user_id).filter(Boolean))] as string[];
    const { data: payUsers } = await sb.from("users").select("id, nickname, kakao_id").in("id", userIdsPay);
    const userMap = new Map((payUsers ?? []).map((u) => [u.id, u]));
    for (const p of recentPay) {
      const u = p.user_id ? userMap.get(p.user_id) : null;
      const who = u ? `${u.nickname ?? "—"}` : "—";
      console.log(
        `  ${padR(fmtHM(p.created_at), 14)} ${c.bold}${c.green}${padL(p.amount.toLocaleString() + "원", 8)}${c.reset}  ${who}`,
      );
    }
  }

  // ── 6-0. 올해의 운세 로그 (24h, 최근 8건) ─────────────
  const { data: recentYearly } = await sb
    .from("yearly_results")
    .select("name, birth_date, gender, region, user_id, created_at, target_year, yearly_pillar, full_json")
    .gte("created_at", H24)
    .not("user_id", "in", INTERNAL_ID_LIST)
    .order("created_at", { ascending: false })
    .limit(8);

  const recentYearlyUserIds = [...new Set((recentYearly ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const yearlyUserMap = new Map<string, { referrer: string | null; utm_source: string | null; landing_path: string | null }>();
  if (recentYearlyUserIds.length > 0) {
    const { data: yearlyUsers } = await sb
      .from("users")
      .select("id, referrer, utm_source, landing_path")
      .in("id", recentYearlyUserIds);
    for (const u of yearlyUsers ?? []) {
      yearlyUserMap.set(u.id, {
        referrer: u.referrer,
        utm_source: u.utm_source,
        landing_path: u.landing_path,
      });
    }
  }

  section(`🗓  올해의 운세 로그  ${c.dim}(최근 ${recentYearly?.length ?? 0}건)${c.reset}`);
  if (!recentYearly || recentYearly.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const head = `${padR("시각", 14)} ${padR("연도", 5)} ${padR("등급", 5)} ${padR("점수", 5)} ${padR("이름", 10)} ${padR("생년월일", 12)} ${padR("성", 4)} ${padR("지역", 6)} ${padR("유입", 10)} ${padR("세운", 6)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    for (const r of recentYearly) {
      const member = r.user_id ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
      const name = r.name ?? "—";
      const gender = r.gender === "남성" ? `${c.blue}♂${c.reset}` : r.gender === "여성" ? `${c.magenta}♀${c.reset}` : "·";
      const u = r.user_id ? yearlyUserMap.get(r.user_id) : null;
      const ch = classifyChannel(u?.referrer ?? null, u?.utm_source ?? null);
      const fj = r.full_json as any;
      const grade = fj?._error ? "ERR" : fj?.tier?.grade ?? (!fj ? "..." : "—");
      const score = fj?._error || !fj ? "—" : typeof fj?.tier?.composite === "number" ? String(Math.round(fj.tier.composite)) : "—";
      console.log(
        `  ${padR(fmtHM(r.created_at), 14)} ${padL(String(r.target_year ?? "—"), 5)} ${padR(grade, 5)} ${padL(score, 5)} ${member}  ${padR(name, 10)} ${padR(r.birth_date ?? "—", 12)} ${gender}  ${c.dim}${padR(r.region ?? "—", 6)}${c.reset} ${ch.color}${padR(ch.short, 10)}${c.reset} ${padR(r.yearly_pillar ?? "—", 6)}`,
      );
    }
  }

  // ── 최근 활동 감지 ──────────────────────
  if (rows[0].users >= 5 || rows[0].pays > 0) {
    console.log("");
    console.log(`  ${c.bgPink}${c.white} 🔥 최근 1시간 활발 — 모니터링 유지 권장 ${c.reset}`);
  }

  await gradeVersionMonitor();

  writeFileSync(LAST_RUN_FILE, new Date(now).toISOString(), "utf-8");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
