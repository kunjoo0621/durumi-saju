import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

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

const RULE = c.gray + "─".repeat(64) + c.reset;
const HR = c.gray + "━".repeat(64) + c.reset;

const now = Date.now();
const H1 = new Date(now - 1 * 3600_000).toISOString();
const H24 = new Date(now - 24 * 3600_000).toISOString();
const D7 = new Date(now - 7 * 24 * 3600_000).toISOString();
const D14 = new Date(now - 14 * 24 * 3600_000).toISOString();

const fmtHM = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(5, 16).replace("T", " ");
};

function section(title: string) {
  console.log("");
  console.log(HR);
  console.log(`  ${c.bold}${c.cyan}${title}${c.reset}`);
  console.log(HR);
}

async function countSince(table: string, since: string) {
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
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
  const INTERNAL_USER_IDS = new Set(["b1fa9eba-2953-45d1-975b-fdf8a5d9b44f"]);
  const isPayable = (x: { method?: string; user_id?: string | null }) =>
    x.method === "KAKAOPAY" && !!x.user_id && !INTERNAL_USER_IDS.has(x.user_id);

  type Row = { period: string; users: number; results: number; battles: number; pays: number; revenue: number };
  const rows: Row[] = [];
  for (const p of periods) {
    const [users, results, battles, payments] = await Promise.all([
      countSince("users", p.since),
      countSince("saju_results", p.since),
      countSince("saju_battles", p.since),
      sb.from("payment_transactions").select("amount, method, user_id").gte("created_at", p.since).eq("status", "success"),
    ]);
    const kakaoPaid = (payments.data ?? []).filter(isPayable);
    rows.push({
      period: p.label,
      users,
      results,
      battles,
      pays: kakaoPaid.length,
      revenue: kakaoPaid.reduce((s, x) => s + (x.amount ?? 0), 0),
    });
  }

  section("📊  핵심 지표");
  const header = `${padR("기간", 12)} ${padL("가입", 6)} ${padL("분석", 6)} ${padL("배틀", 6)} ${padL("결제", 6)} ${padL("매출", 12)}`;
  console.log("  " + c.dim + header + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(header)) + c.reset);
  for (const r of rows) {
    const color = r.users > 0 || r.pays > 0 ? c.green : c.dim;
    const rev = r.revenue > 0 ? `${r.revenue.toLocaleString()}원` : "—";
    console.log(
      `  ${padR(r.period, 12)} ${color}${padL(String(r.users || "—"), 6)}${c.reset} ${padL(String(r.results || "—"), 6)} ${padL(String(r.battles || "—"), 6)} ${padL(String(r.pays || "—"), 6)} ${padL(rev, 12)}`,
    );
  }

  // ── 2. 추이 ────────────────────────────────
  const prev7Users = (await countSince("users", D14)) - (await countSince("users", D7));
  const last7Users = rows[2].users;
  const delta = last7Users - prev7Users;
  const trend = delta > 0 ? `${c.green}+${delta}명 📈${c.reset}` : delta < 0 ? `${c.red}${delta}명 📉${c.reset}` : `${c.dim}변화없음${c.reset}`;
  section("📈  이번 주 추이");
  console.log(`  이번 7일   ${c.bold}${c.green}${last7Users}명${c.reset}`);
  console.log(`  지난 7일   ${c.dim}${prev7Users}명${c.reset}`);
  console.log(`  증감       ${trend}`);

  // ── 3. 이벤트 보너스 ─────────────────────────
  const { count: bonusAll } = await sb
    .from("coin_transactions").select("*", { count: "exact", head: true })
    .eq("reference_id", "signup_bonus");
  const { count: bonus24h } = await sb
    .from("coin_transactions").select("*", { count: "exact", head: true })
    .eq("reference_id", "signup_bonus")
    .gte("created_at", H24);
  section("🎁  가입 보너스 10알 이벤트");
  console.log(`  누적 지급   ${c.bold}${c.yellow}${bonusAll ?? 0}건${c.reset}  ${c.dim}(${((bonusAll ?? 0) * 10).toLocaleString()}알)${c.reset}`);
  console.log(`  최근 24h    ${c.bold}${c.yellow}${bonus24h ?? 0}건${c.reset}`);

  // ── 4. 신규 가입자 (24h) ──────────────────────
  const { data: newUsers } = await sb
    .from("users")
    .select("id, kakao_id, nickname, email, created_at")
    .gte("created_at", H24)
    .order("created_at", { ascending: false })
    .limit(15);

  const userIds = (newUsers ?? []).map((u) => u.id);
  let analysisByUser = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: analyses } = await sb
      .from("saju_results")
      .select("user_id")
      .in("user_id", userIds);
    for (const a of analyses ?? []) {
      if (a.user_id) analysisByUser.set(a.user_id, (analysisByUser.get(a.user_id) ?? 0) + 1);
    }
  }

  section(`👥  오늘 신규 가입자  ${c.dim}(${newUsers?.length ?? 0}명, 최근 24h)${c.reset}`);
  if (!newUsers || newUsers.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const head = `${padR("시각", 14)} ${padR("닉네임", 14)} ${padR("카카오ID", 14)} ${padL("분석", 6)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    for (const u of newUsers) {
      const nick = u.nickname ?? "—";
      const nickColored = nick === "—" ? c.dim + "—" + c.reset : c.bold + c.white + nick + c.reset;
      const n = analysisByUser.get(u.id) ?? 0;
      const analyzed = n > 0 ? `${c.green}${n}건${c.reset}` : `${c.dim}—${c.reset}`;
      // padR with visible string length (strip color codes manually)
      const nickPad = nick === "—" ? padR(c.dim + "—" + c.reset, 14 + c.dim.length + c.reset.length) : padR(c.bold + c.white + nick + c.reset, 14 + (c.bold + c.white + c.reset).length);
      const kid = (u.kakao_id ?? "?").slice(0, 14);
      console.log(
        `  ${padR(fmtHM(u.created_at), 14)} ${nickPad} ${padR(kid, 14)} ${padL(analyzed, 6 + (n > 0 ? c.green.length + c.reset.length : c.dim.length + c.reset.length))}`,
      );
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

  // ── 6. 분석 로그 (24h, 최근 8건) ─────────────
  const { data: recentResults } = await sb
    .from("saju_results")
    .select("name, birth_date, gender, region, user_id, created_at")
    .gte("created_at", H24)
    .order("created_at", { ascending: false })
    .limit(8);

  section(`🔮  사주 분석 로그  ${c.dim}(최근 ${recentResults?.length ?? 0}건)${c.reset}`);
  if (!recentResults || recentResults.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    for (const r of recentResults) {
      const member = r.user_id ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
      const name = r.name ?? "—";
      const gender = r.gender === "남성" ? `${c.blue}♂${c.reset}` : r.gender === "여성" ? `${c.magenta}♀${c.reset}` : "·";
      console.log(
        `  ${padR(fmtHM(r.created_at), 14)} ${member}  ${padR(name, 10)} ${padR(r.birth_date ?? "—", 12)} ${gender}  ${c.dim}${r.region ?? "—"}${c.reset}`,
      );
    }
  }

  // ── 최근 활동 감지 ──────────────────────
  if (rows[0].users >= 3 || rows[0].pays > 0) {
    console.log("");
    console.log(`  ${c.bgPink}${c.white} 🔥 최근 1시간 활발 — 모니터링 유지 권장 ${c.reset}`);
  }

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
