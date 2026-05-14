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

  // ── 2-1. 시간대별 가입 (최근 24h, 1h 단위) ──────────────
  const { data: u24h } = await sb
    .from("users")
    .select("created_at")
    .gte("created_at", H24)
    .order("created_at", { ascending: true });
  const { data: r24h } = await sb
    .from("saju_results")
    .select("created_at")
    .gte("created_at", H24);

  const hourBuckets = new Map<string, { signups: number; analyses: number }>();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 3600_000);
    const k = new Date(t.getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    hourBuckets.set(k, { signups: 0, analyses: 0 });
  }
  for (const u of u24h ?? []) {
    const k = new Date(new Date(u.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.signups++;
  }
  for (const r of r24h ?? []) {
    const k = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 13).replace("T", " ") + "h";
    if (hourBuckets.has(k)) hourBuckets.get(k)!.analyses++;
  }
  const hMax = Math.max(...[...hourBuckets.values()].map((v) => Math.max(v.signups, v.analyses)), 1);
  section("⏱   시간대별 추이  " + c.dim + "(최근 24h, KST)" + c.reset);
  const hHead = `${padR("시각", 12)} ${padL("가입", 4)} ${padL("분석", 4)}  추이 (■가입 / ▣분석)`;
  console.log("  " + c.dim + hHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(hHead)) + c.reset);
  for (const [k, v] of hourBuckets) {
    const sBar = "■".repeat(Math.round((v.signups / hMax) * 20));
    const aBar = "▣".repeat(Math.round((v.analyses / hMax) * 20));
    const sCnt = v.signups > 0 ? `${c.green}${padL(String(v.signups), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const aCnt = v.analyses > 0 ? `${c.cyan}${padL(String(v.analyses), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    console.log(`  ${padR(k, 12)} ${sCnt} ${aCnt}  ${c.green}${sBar}${c.reset}${c.cyan}${aBar}${c.reset}`);
  }

  // ── 2-2. 일자별 추이 (최근 14일) ──────────────
  const { data: u14d } = await sb
    .from("users")
    .select("created_at")
    .gte("created_at", D14)
    .order("created_at", { ascending: true });
  const { data: r14d } = await sb
    .from("saju_results")
    .select("created_at")
    .gte("created_at", D14);
  const { data: p14d } = await sb
    .from("payment_transactions")
    .select("amount, method, user_id, created_at")
    .gte("created_at", D14)
    .eq("status", "success")
    .eq("method", "KAKAOPAY");

  const dayBuckets = new Map<string, { signups: number; analyses: number; pays: number; revenue: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600_000);
    const k = new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    dayBuckets.set(k, { signups: 0, analyses: 0, pays: 0, revenue: 0 });
  }
  for (const u of u14d ?? []) {
    const k = new Date(new Date(u.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.signups++;
  }
  for (const r of r14d ?? []) {
    const k = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (dayBuckets.has(k)) dayBuckets.get(k)!.analyses++;
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
  const dHead = `${padR("날짜", 14)} ${padL("가입", 4)} ${padL("분석", 4)} ${padL("결제", 4)} ${padL("매출", 9)}  가입 추이`;
  console.log("  " + c.dim + dHead + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(dHead)) + c.reset);
  for (const [k, v] of dayBuckets) {
    const dow = dayNames[new Date(k + "T00:00:00Z").getUTCDay()];
    const dowColor = dow === "토" || dow === "일" ? c.red : c.dim;
    const bar = "█".repeat(Math.round((v.signups / dMax) * 30));
    const sCnt = v.signups > 0 ? `${c.green}${padL(String(v.signups), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const aCnt = v.analyses > 0 ? `${c.cyan}${padL(String(v.analyses), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const pCnt = v.pays > 0 ? `${c.yellow}${padL(String(v.pays), 4)}${c.reset}` : `${c.dim}${padL("—", 4)}${c.reset}`;
    const rev = v.revenue > 0 ? `${v.revenue.toLocaleString()}원` : "—";
    const revColored = v.revenue > 0 ? `${c.yellow}${padL(rev, 9)}${c.reset}` : `${c.dim}${padL(rev, 9)}${c.reset}`;
    console.log(`  ${padR(k + " " + dowColor + "(" + dow + ")" + c.reset, 14 + dowColor.length + c.reset.length)} ${sCnt} ${aCnt} ${pCnt} ${revColored}  ${c.green}${bar}${c.reset}`);
  }

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
    const head = `${padR("시각", 12)} ${padR("닉네임", 14)} ${padR("채널", 14)} ${padR("랜딩", 16)} ${padL("분석", 4)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    for (const u of newUsers) {
      const nick = (u.nickname ?? "—").slice(0, 12);
      const ch = classifyChannel(u.referrer, u.utm_source);
      const n = analysisByUser.get(u.id) ?? 0;
      const analyzed = n > 0 ? `${c.green}${n}${c.reset}` : `${c.dim}—${c.reset}`;
      const land = (u.landing_path ?? "—").slice(0, 14);
      console.log(
        `  ${padR(fmtHM(u.created_at), 12)} ${padR(nick, 14)} ${ch.color}${padR(ch.short, 14)}${c.reset} ${c.dim}${padR(land, 16)}${c.reset} ${padL(analyzed, 4 + (n > 0 ? c.green.length + c.reset.length : c.dim.length + c.reset.length))}`,
      );
    }
  }

  // ── 4-2. 채널 집계 (7일) ────────────────────
  const { data: ch7d } = await sb
    .from("users")
    .select("referrer, utm_source")
    .gte("created_at", D7);

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

  // ── 6. 분석 로그 (24h, 최근 8건) ─────────────
  const { data: recentResults } = await sb
    .from("saju_results")
    .select("name, birth_date, gender, region, user_id, created_at, full_json")
    .gte("created_at", H24)
    .order("created_at", { ascending: false })
    .limit(8);

  const recentResultUserIds = [...new Set((recentResults ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const resultUserMap = new Map<string, { referrer: string | null; utm_source: string | null; landing_path: string | null }>();
  if (recentResultUserIds.length > 0) {
    const { data: resultUsers } = await sb
      .from("users")
      .select("id, referrer, utm_source, landing_path")
      .in("id", recentResultUserIds);
    for (const u of resultUsers ?? []) {
      resultUserMap.set(u.id, {
        referrer: u.referrer,
        utm_source: u.utm_source,
        landing_path: u.landing_path,
      });
    }
  }

  section(`🔮  사주 분석 로그  ${c.dim}(최근 ${recentResults?.length ?? 0}건)${c.reset}`);
  if (!recentResults || recentResults.length === 0) {
    console.log("  " + c.dim + "(아직 없음)" + c.reset);
  } else {
    const head = `${padR("시각", 14)} ${padR("등급", 5)} ${padR("점수", 5)} ${padR("이름", 10)} ${padR("생년월일", 12)} ${padR("성", 4)} ${padR("지역", 6)} ${padR("유입", 10)} ${padR("랜딩", 14)}`;
    console.log("  " + c.dim + head + c.reset);
    console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);
    for (const r of recentResults) {
      const member = r.user_id ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
      const name = r.name ?? "—";
      const gender = r.gender === "남성" ? `${c.blue}♂${c.reset}` : r.gender === "여성" ? `${c.magenta}♀${c.reset}` : "·";
      const u = r.user_id ? resultUserMap.get(r.user_id) : null;
      const ch = classifyChannel(u?.referrer ?? null, u?.utm_source ?? null);
      const landing = (u?.landing_path ?? "—").slice(0, 12);
      const fj = r.full_json as any;
      const grade = fj?._error ? "ERR" : fj?.tier?.grade ?? (!fj ? "..." : "—");
      const score = fj?._error || !fj ? "—" : typeof fj?.tier?.composite === "number" ? String(fj.tier.composite) : "—";
      console.log(
        `  ${padR(fmtHM(r.created_at), 14)} ${padR(grade, 5)} ${padL(score, 5)} ${member}  ${padR(name, 10)} ${padR(r.birth_date ?? "—", 12)} ${gender}  ${c.dim}${padR(r.region ?? "—", 6)}${c.reset} ${ch.color}${padR(ch.short, 10)}${c.reset} ${c.dim}${padR(landing, 14)}${c.reset}`,
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
