/**
 * 유입 채널별 실제 성과(결제율·매출) 집계.
 *
 * ★왜 — 네이버 검색광고에 주 6만원대를 쓰는데, 그 클릭이 가입·결제로 이어지는지
 * 대시보드로는 안 갈렸다. 대시보드의 "유입 채널"은 가입자 **수**만 세고 매출을 안 붙인다.
 * 여기서 가입 코호트별로 그들이 실제로 낸 돈을 세서 채널당 가입/결제율/매출을 낸다.
 *
 * ★코호트 정의 — "가입일이 창 안"인 사용자의 **전체 결제**(가입 이후 언제든)를 합산한다.
 * 결제일 기준이 아니다. 광고비는 사람을 데려오는 값이므로 그 사람이 낸 총액과 대야 맞다.
 * 짧은 창(7일)은 아직 안 낸 돈이 빠져 LTV 를 과소평가한다 — 그래서 7/14/30일을 같이 낸다.
 *
 * ★Supabase 기본 1000행 잘림 — 집계는 반드시 페이지네이션.
 *   (실측 사고: 페이지네이션 없이 세다가 10배를 오판한 적이 있다)
 *
 * 실행: npx tsx scripts/channel-roi.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// live-dashboard.mts 와 같은 방식으로 .env.local 을 직접 읽는다(dotenv 의존 없음).
const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(".env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", gray: "\x1b[90m",
};

/** Supabase 1000행 상한을 넘겨 전부 가져온다. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/** 대시보드 classifyChannel 과 동일 규칙 — 라벨이 갈리면 두 화면을 못 대조한다. */
function classifyChannel(referrer: string | null, utm_source: string | null): string {
  if (utm_source) return `캠페인 (${utm_source})`;
  if (!referrer) return "추적 전/직접입력";
  const r = referrer.toLowerCase();
  if (r.includes("search.naver")) return "네이버 검색";
  if (r.includes("ad.search.naver")) return "네이버 검색광고(ref)";
  if (r.includes("naver")) return "네이버 기타";
  if (r.includes("google")) return "구글 검색";
  if (r.includes("kakao")) return "카카오톡";
  if (r.includes("daum")) return "다음";
  if (r.includes("bing")) return "빙";
  if (r.includes("instagram")) return "인스타그램";
  if (r.includes("t.co") || r.includes("twitter") || r.includes("x.com")) return "X(트위터)";
  if (r.includes("chatgpt")) return "ChatGPT";
  return referrer.slice(0, 24);
}

type UserRow = { id: string; created_at: string; referrer: string | null; utm_source: string | null };
type PayRow = { user_id: string | null; amount: number | null };

async function run() {
  const now = Date.now();
  const WINDOWS = [7, 14, 30];

  // 결제는 한 번만 읽어 user_id 로 합산해두고 창마다 재사용한다.
  const pays = await fetchAll<PayRow>((from, to) =>
    sb.from("payment_transactions").select("user_id, amount").eq("status", "success").range(from, to)
  );
  const paidByUser = new Map<string, { count: number; sum: number }>();
  for (const p of pays) {
    if (!p.user_id) continue;
    const cur = paidByUser.get(p.user_id) || { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += p.amount || 0;
    paidByUser.set(p.user_id, cur);
  }

  console.log(`\n${c.bold}${c.cyan}유입 채널별 성과${c.reset}  ${c.dim}가입 코호트 기준 · 그들의 전체 결제 합산${c.reset}`);
  console.log(`${c.dim}실행 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST · 결제 원장 ${pays.length.toLocaleString()}건${c.reset}`);

  for (const days of WINDOWS) {
    const since = new Date(now - days * 86400_000).toISOString();
    const users = await fetchAll<UserRow>((from, to) =>
      sb.from("users").select("id, created_at, referrer, utm_source").gte("created_at", since).range(from, to)
    );

    type Agg = { signups: number; payers: number; orders: number; revenue: number };
    const byCh = new Map<string, Agg>();
    for (const u of users) {
      const ch = classifyChannel(u.referrer, u.utm_source);
      const a = byCh.get(ch) || { signups: 0, payers: 0, orders: 0, revenue: 0 };
      a.signups += 1;
      const p = paidByUser.get(u.id);
      if (p) { a.payers += 1; a.orders += p.count; a.revenue += p.sum; }
      byCh.set(ch, a);
    }

    const rows = [...byCh.entries()].sort((x, y) => y[1].revenue - x[1].revenue || y[1].signups - x[1].signups);
    const tot = rows.reduce((s, [, a]) => ({
      signups: s.signups + a.signups, payers: s.payers + a.payers,
      orders: s.orders + a.orders, revenue: s.revenue + a.revenue,
    }), { signups: 0, payers: 0, orders: 0, revenue: 0 });

    console.log(`\n${c.bold}── 최근 ${days}일 가입 코호트 ──${c.reset}`);
    console.log(`${c.dim}채널                     가입  결제자  결제율  결제건       매출  가입당매출  객단가${c.reset}`);
    console.log(`${c.dim}${"─".repeat(88)}${c.reset}`);
    for (const [ch, a] of rows) {
      if (a.signups === 0) continue;
      const rate = (a.payers / a.signups) * 100;
      const perSignup = a.revenue / a.signups;
      const aov = a.orders ? a.revenue / a.orders : 0;
      const hi = ch.startsWith("캠페인") ? c.yellow : "";
      console.log(
        `  ${hi}${ch.padEnd(22)}${c.reset}` +
        `${String(a.signups).padStart(5)}` +
        `${String(a.payers).padStart(7)}` +
        `${(rate.toFixed(0) + "%").padStart(8)}` +
        `${String(a.orders).padStart(7)}` +
        `${(a.revenue.toLocaleString() + "원").padStart(11)}` +
        `${(Math.round(perSignup).toLocaleString() + "원").padStart(11)}` +
        `${(Math.round(aov).toLocaleString() + "원").padStart(9)}`
      );
    }
    console.log(`${c.dim}${"─".repeat(88)}${c.reset}`);
    console.log(
      `  ${c.bold}${"합계".padEnd(21)}${c.reset}` +
      `${String(tot.signups).padStart(5)}` +
      `${String(tot.payers).padStart(7)}` +
      `${((tot.payers / (tot.signups || 1)) * 100).toFixed(0).padStart(7)}%` +
      `${String(tot.orders).padStart(7)}` +
      `${(tot.revenue.toLocaleString() + "원").padStart(11)}` +
      `${(Math.round(tot.revenue / (tot.signups || 1)).toLocaleString() + "원").padStart(11)}`
    );
  }

  console.log(
    `\n${c.dim}※ 코호트가 짧을수록 "아직 안 낸 돈"이 빠져 가입당매출이 낮게 나온다. 30일 값을 기준으로 볼 것.\n` +
    `※ 광고비 대조는 scripts/naver-ad-stats.mts 의 같은 기간 비용과 "캠페인 (naver)" 행을 대면 된다.${c.reset}\n`
  );
}

run().catch((e) => { console.error(e); process.exit(1); });
