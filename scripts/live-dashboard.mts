import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";

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

async function countSince(table: string, since: string, internalColumn: "id" | "user_id" | null = "user_id") {
  let q = sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  if (internalColumn) q = q.not(internalColumn, "in", INTERNAL_ID_LIST);
  const { count } = await q;
  return count ?? 0;
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
    { label: "24시간", since: H24 },
    { label: "7일", since: D7 },
  ];

  // 정산 가능 결제 식별 기준 (memory/feedback_durumi_dashboard.md 참조)
  // - method=KAKAOPAY (mock/egg 제외)
  // - user_id not null (비회원 제외)
  // - user_id != 운영자 본인 (신건주)
  // - created_at >= 2026-04-01 (3월 이전 비회원 시기 제외) — period.since가 이미 4월 이후라 자동 만족
  const isPayable = (x: { method?: string; user_id?: string | null }) =>
    x.method === "KAKAOPAY" && !!x.user_id && !INTERNAL_USER_IDS.has(x.user_id);

  type Row = { period: string; users: number; results: number; yearly: number; battles: number; pays: number; revenue: number };
  const rows: Row[] = [];
  for (const p of periods) {
    const [users, results, yearly, battles, payments] = await Promise.all([
      countSince("users", p.since, "id"),
      countSince("saju_results", p.since),
      countSince("yearly_results", p.since),
      countSince("saju_battles", p.since),
      sb.from("payment_transactions").select("amount, method, user_id").gte("created_at", p.since).eq("status", "success"),
    ]);
    const kakaoPaid = (payments.data ?? []).filter(isPayable);
    rows.push({
      period: p.label,
      users,
      results,
      yearly,
      battles,
      pays: kakaoPaid.length,
      revenue: kakaoPaid.reduce((s, x) => s + (x.amount ?? 0), 0),
    });
  }

  section("📊  핵심 지표");
  const header = `${padR("기간", 12)} ${padL("가입", 6)} ${padL("개인", 6)} ${padL("올해", 6)} ${padL("배틀", 6)} ${padL("결제", 6)} ${padL("매출", 12)}`;
  console.log("  " + c.dim + header + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(header)) + c.reset);
  for (const r of rows) {
    const color = r.users > 0 || r.pays > 0 ? c.green : c.dim;
    const rev = r.revenue > 0 ? `${r.revenue.toLocaleString()}원` : "—";
    console.log(
      `  ${padR(r.period, 12)} ${color}${padL(String(r.users || "—"), 6)}${c.reset} ${padL(String(r.results || "—"), 6)} ${padL(String(r.yearly || "—"), 6)} ${padL(String(r.battles || "—"), 6)} ${padL(String(r.pays || "—"), 6)} ${padL(rev, 12)}`,
    );
  }

  // ── 1-1. 운영 요약 ──────────────────────────
  const h1 = rows[0];
  const d1 = rows[1];
  const d7row = rows[2];
  const signupToAnalysis = pct(d1.results, d1.users);
  const signupToPay = pct(d1.pays, d1.users);
  const avgPay = d1.pays > 0 ? Math.round(d1.revenue / d1.pays) : 0;
  const avgRevenuePerSignup = d1.users > 0 ? Math.round(d1.revenue / d1.users) : 0;

  section("🧭  운영 요약");
  console.log(`  지금 1시간   가입 ${c.green}${h1.users}${c.reset} · 개인 ${c.cyan}${h1.results}${c.reset} · 결제 ${c.yellow}${h1.pays}${c.reset} · 매출 ${c.yellow}${h1.revenue.toLocaleString()}원${c.reset}`);
  console.log(`  24시간 비율  개인/가입 ${c.bold}${signupToAnalysis}%${c.reset}${c.dim}(반복 포함)${c.reset}  결제/가입 ${c.bold}${signupToPay}%${c.reset}  객단가 ${c.bold}${avgPay.toLocaleString()}원${c.reset}  가입당매출 ${c.bold}${avgRevenuePerSignup.toLocaleString()}원${c.reset}`);
  console.log(`  7일 규모     가입 ${c.green}${d7row.users}명${c.reset} · 개인 ${c.cyan}${d7row.results}건${c.reset} · 결제 ${c.yellow}${d7row.pays}건${c.reset} · 매출 ${c.yellow}${d7row.revenue.toLocaleString()}원${c.reset}`);
  console.log(`  올해 운세    실사용 ${d1.yearly > 0 ? c.yellow + d1.yearly + c.reset : c.dim + "0" + c.reset}건 ${c.dim}(운영자 테스트 제외)${c.reset}`);

  // ── 1-1-1. 어제 요약 ──────────────────────────
  const [yUsers, yPersonal, yYearly, yBattles, yPayments, yChannels, yGrades] = await Promise.all([
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
  console.log(`  가입 ${c.green}${yUsers.count ?? 0}명${c.reset} · 개인 ${c.cyan}${yPersonal.count ?? 0}건${c.reset} · 올해 ${c.yellow}${yYearly.count ?? 0}건${c.reset} · 배틀 ${c.magenta}${yBattles.count ?? 0}건${c.reset} · 결제 ${c.yellow}${yPaid.length}건${c.reset} · 매출 ${c.yellow}${yRevenue.toLocaleString()}원${c.reset}`);
  console.log(`  유입 TOP   ${yTopChannels}`);
  console.log(`  등급 분포  ${yGradeLine}`);

  // ── 1-2. 오늘 분석 로그를 상단에 노출 ─────────────
  const [recentPersonalRes, recentYearlyRes, recentBattleRes] = await Promise.all([
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
      .from("saju_battles")
      .select("player_a_name, player_b_name, player_a_grade, player_b_grade, wins_a, wins_b, draws, relationship_type, user_id, created_at")
      .gte("created_at", TODAY_START)
      .not("user_id", "in", INTERNAL_ID_LIST)
      .order("created_at", { ascending: false }),
  ]);

  type RecentAnalysis = {
    created_at: string;
    user_id: string | null;
    kind: "개인" | "배틀" | "올해";
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
      const kindColor = r.kind === "개인" ? c.cyan : r.kind === "배틀" ? c.magenta : c.yellow;
      console.log(
        `  ${padR(fmtHM(r.created_at), 14)} ${padR(nick, 12)} ${padR(clip(r.grade, 6), 6)} ${padL(r.score, 6)} ${member}  ${padR(clip(name, 16), 16)} ${padR(r.birthDate ?? "—", 12)} ${gender}  ${c.dim}${padR(clip(r.region ?? "—", 6), 6)}${c.reset} ${ch.color}${padR(ch.short, 10)}${c.reset} ${c.dim}${padR(landing, 14)}${c.reset} ${kindColor}${padR(r.kind, 6)}${c.reset}`,
      );
    }
  }

  // ── 2. 추이 ────────────────────────────────
  const prev7Users = (await countSince("users", D14, "id")) - (await countSince("users", D7, "id"));
  const last7Users = rows[2].users;
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

  const hourBuckets = new Map<string, { signups: number; analyses: number; yearly: number }>();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 3600_000);
    const k = new Date(t.getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    hourBuckets.set(k, { signups: 0, analyses: 0, yearly: 0 });
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
  const hMax = Math.max(...[...hourBuckets.values()].map((v) => Math.max(v.signups, v.analyses, v.yearly)), 1);
  section("⏱   시간대별 추이  " + c.dim + "(최근 24h, KST)" + c.reset);
  const hHead = `${padR("시각", 12)} ${padL("가입", 4)} ${padL("개인", 4)} ${padL("올해", 4)}  추이 (■가입 / ▣개인 / ◆올해)`;
  console.log("  " + c.dim + hHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(hHead)) + c.reset);
  for (const [k, v] of hourBuckets) {
    const sBar = "■".repeat(Math.round((v.signups / hMax) * 20));
    const aBar = "▣".repeat(Math.round((v.analyses / hMax) * 20));
    const yBar = "◆".repeat(Math.round((v.yearly / hMax) * 20));
    const sCnt = v.signups > 0 ? `${c.green}${padL(String(v.signups), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const aCnt = v.analyses > 0 ? `${c.cyan}${padL(String(v.analyses), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const yCnt = v.yearly > 0 ? `${c.yellow}${padL(String(v.yearly), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    console.log(`  ${padR(k, 12)} ${sCnt} ${aCnt} ${yCnt}  ${c.green}${sBar}${c.reset}${c.cyan}${aBar}${c.reset}${c.yellow}${yBar}${c.reset}`);
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
  const { data: p14d } = await sb
    .from("payment_transactions")
    .select("amount, method, user_id, created_at")
    .gte("created_at", D14)
    .eq("status", "success")
    .eq("method", "KAKAOPAY");

  const dayBuckets = new Map<string, { signups: number; analyses: number; yearly: number; pays: number; revenue: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600_000);
    const k = new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    dayBuckets.set(k, { signups: 0, analyses: 0, yearly: 0, pays: 0, revenue: 0 });
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
  const dHead = `${padR("날짜", 14)} ${padL("가입", 4)} ${padL("개인", 4)} ${padL("올해", 4)} ${padL("결제", 4)} ${padL("매출", 9)}  가입 추이`;
  console.log("  " + c.dim + dHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(dHead)) + c.reset);
  for (const [k, v] of dayBuckets) {
    const dow = dayNames[new Date(k + "T00:00:00Z").getUTCDay()];
    const dowColor = dow === "토" || dow === "일" ? c.red : c.dim;
    const bar = "█".repeat(Math.round((v.signups / dMax) * 30));
    const sCnt = v.signups > 0 ? `${c.green}${padL(String(v.signups), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const aCnt = v.analyses > 0 ? `${c.cyan}${padL(String(v.analyses), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const yCnt = v.yearly > 0 ? `${c.yellow}${padL(String(v.yearly), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const pCnt = v.pays > 0 ? `${c.yellow}${padL(String(v.pays), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const rev = v.revenue > 0 ? `${v.revenue.toLocaleString()}원` : "—";
    const revColored = v.revenue > 0 ? `${c.yellow}${padL(rev, 9)}${c.reset}` : `${c.dim}${padL(rev, 9)}${c.reset}`;
    console.log(`  ${padR(k + " " + dowColor + "(" + dow + ")" + c.reset, 14 + dowColor.length + c.reset.length)} ${sCnt} ${aCnt} ${yCnt} ${pCnt} ${revColored}  ${c.green}${bar}${c.reset}`);
  }

  // ── 3. 이벤트 보너스 ─────────────────────────
  const { count: bonusAll } = await sb
    .from("coin_transactions").select("*", { count: "exact", head: true })
    .eq("reference_id", "signup_bonus")
    .not("user_id", "in", INTERNAL_ID_LIST);
  const { count: bonus24h } = await sb
    .from("coin_transactions").select("*", { count: "exact", head: true })
    .eq("reference_id", "signup_bonus")
    .gte("created_at", H24)
    .not("user_id", "in", INTERNAL_ID_LIST);
  section("🎁  가입 보너스 10알 이벤트");
  console.log(`  누적 지급   ${c.bold}${c.yellow}${bonusAll ?? 0}건${c.reset}  ${c.dim}(${((bonusAll ?? 0) * 10).toLocaleString()}알)${c.reset}`);
  console.log(`  최근 24h    ${c.bold}${c.yellow}${bonus24h ?? 0}건${c.reset}`);

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

  // 헤더에 표시할 24h 실제 총 가입 수 (목록은 최근 15명만, 카운트는 전체)
  const { count: signup24hTotal } = await sb
    .from("users")
    .select("id", { count: "exact", head: true })
    .gte("created_at", H24)
    .not("id", "in", INTERNAL_ID_LIST);

  const userIds = (newUsers ?? []).map((u) => u.id);
  let analysisByUser = new Map<string, { personal: number; yearly: number }>();
  if (userIds.length > 0) {
    const [personalRes, yearlyRes] = await Promise.all([
      sb.from("saju_results").select("user_id").in("user_id", userIds),
      sb.from("yearly_results").select("user_id").in("user_id", userIds),
    ]);
    const analyses = personalRes.data ?? [];
    for (const a of analyses ?? []) {
      if (!a.user_id) continue;
      const cur = analysisByUser.get(a.user_id) ?? { personal: 0, yearly: 0 };
      cur.personal++;
      analysisByUser.set(a.user_id, cur);
    }
    for (const y of yearlyRes.data ?? []) {
      if (!y.user_id) continue;
      const cur = analysisByUser.get(y.user_id) ?? { personal: 0, yearly: 0 };
      cur.yearly++;
      analysisByUser.set(y.user_id, cur);
    }
  }

  section(`👥  오늘 신규 가입자  ${c.dim}(24h 총 ${signup24hTotal ?? 0}명 · 아래 최근 ${newUsers?.length ?? 0}명 표시)${c.reset}`);
  if (!newUsers || newUsers.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const head = `${padR("시각", 12)} ${padR("닉네임", 14)} ${padR("채널", 14)} ${padR("랜딩", 16)} ${padL("개인", 4)} ${padL("올해", 4)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    for (const u of newUsers) {
      const nick = (u.nickname ?? "—").slice(0, 12);
      const ch = classifyChannel(u.referrer, u.utm_source);
      const n = analysisByUser.get(u.id) ?? { personal: 0, yearly: 0 };
      const analyzed = n.personal > 0 ? `${c.green}${n.personal}${c.reset}` : `${c.dim}—${c.reset}`;
      const yearlyCnt = n.yearly > 0 ? `${c.yellow}${n.yearly}${c.reset}` : `${c.dim}—${c.reset}`;
      const land = (u.landing_path ?? "—").slice(0, 14);
      console.log(
        `  ${padR(fmtHM(u.created_at), 12)} ${padR(nick, 14)} ${ch.color}${padR(ch.short, 14)}${c.reset} ${c.dim}${padR(land, 16)}${c.reset} ${padL(analyzed, 4 + (n.personal > 0 ? c.green.length + c.reset.length : c.dim.length + c.reset.length))} ${padL(yearlyCnt, 4 + (n.yearly > 0 ? c.yellow.length + c.reset.length : c.dim.length + c.reset.length))}`,
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
  if (rows[0].users >= 3 || rows[0].pays > 0) {
    console.log("");
    console.log(`  ${c.bgPink}${c.white} 🔥 최근 1시간 활발 — 모니터링 유지 권장 ${c.reset}`);
  }

  writeFileSync(LAST_RUN_FILE, new Date(now).toISOString(), "utf-8");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
