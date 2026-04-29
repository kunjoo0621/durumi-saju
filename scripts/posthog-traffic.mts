import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}

const HOST = envVars.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "");
const KEY = envVars.POSTHOG_PERSONAL_API_KEY;

if (!HOST || !KEY) {
  console.error("env 누락: NEXT_PUBLIC_POSTHOG_HOST 또는 POSTHOG_PERSONAL_API_KEY");
  process.exit(1);
}

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  brand: "\x1b[38;5;203m",
};

async function api(path: string, method = "GET", body?: any) {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`API ${method} ${path} failed:`, JSON.stringify(data).slice(0, 300));
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
}

function bar(value: number, max: number, width = 24, color = c.green) {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return color + "█".repeat(filled) + c.gray + "·".repeat(Math.max(0, width - filled)) + c.reset;
}

function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7a3)) w += 2;
    else w += 1;
  }
  return w;
}
function padR(s: string, n: number) { return s + " ".repeat(Math.max(0, n - visualWidth(s))); }

async function main() {
  // 1. project 조회 (projects endpoint 우선)
  let pid: number;
  let pname: string;
  try {
    const ps = await api("/api/projects/");
    if (ps?.results?.length) {
      const p = ps.results.find((p: any) => p.name?.toLowerCase().includes("durumi") || p.name?.includes("두루미") || p.name?.toLowerCase().includes("saju")) ?? ps.results[0];
      pid = p.id;
      pname = p.name;
    } else {
      throw new Error("no projects");
    }
  } catch (e) {
    // fallback: try @current
    const p = await api("/api/projects/@current/");
    pid = p.id;
    pname = p.name;
  }

  console.log(`\n${c.bold}${c.brand}🌐 PostHog 유입 분석${c.reset}`);
  console.log(`${c.dim}프로젝트: ${pname} (id=${pid})${c.reset}`);

  // 2. HogQL 쿼리: 7일간 referring_domain 분포
  async function hogql(query: string) {
    const result = await api(`/api/projects/${pid}/query/`, "POST", {
      query: { kind: "HogQLQuery", query },
    });
    return result?.results ?? [];
  }

  // === referring_domain 분포 ===
  console.log(`\n${c.bold}${c.cyan}📍 유입 도메인 (최근 7일)${c.reset}`);
  console.log(c.gray + "─".repeat(60) + c.reset);
  const refResults = await hogql(`
    SELECT
      coalesce(properties.$referring_domain, '(direct)') as domain,
      count() as views,
      count(distinct distinct_id) as unique_visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 7 day
    GROUP BY domain
    ORDER BY views DESC
    LIMIT 15
  `);
  if (refResults.length === 0) {
    console.log(c.dim + "  데이터 없음" + c.reset);
  } else {
    const maxViews = Math.max(...refResults.map((r: any) => r[1]));
    console.log(`  ${c.dim}${"도메인".padEnd(28)}  방문수   고유 방문자${c.reset}`);
    for (const row of refResults) {
      const [domain, views, unique] = row;
      console.log(`  ${padR(domain.slice(0, 26), 26)}  ${String(views).padStart(5)}    ${String(unique).padStart(5)}     ${bar(views, maxViews, 20)}`);
    }
  }

  // === UTM source 분포 ===
  console.log(`\n${c.bold}${c.cyan}🏷  UTM Source (최근 7일)${c.reset}`);
  console.log(c.gray + "─".repeat(60) + c.reset);
  const utmResults = await hogql(`
    SELECT
      coalesce(properties.utm_source, '(없음)') as src,
      coalesce(properties.utm_medium, '-') as medium,
      coalesce(properties.utm_campaign, '-') as campaign,
      count() as views,
      count(distinct distinct_id) as unique_visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 7 day
    GROUP BY src, medium, campaign
    ORDER BY views DESC
    LIMIT 10
  `);
  if (utmResults.length === 0) {
    console.log(c.dim + "  데이터 없음" + c.reset);
  } else {
    console.log(`  ${c.dim}${"source".padEnd(14)} ${"medium".padEnd(14)} ${"campaign".padEnd(20)}  views  unique${c.reset}`);
    for (const row of utmResults) {
      const [src, medium, campaign, views, unique] = row;
      console.log(`  ${padR(src.slice(0, 12), 14)} ${padR(medium.slice(0, 12), 14)} ${padR(campaign.slice(0, 18), 20)}  ${String(views).padStart(5)}  ${String(unique).padStart(5)}`);
    }
  }

  // === 디바이스/브라우저 ===
  console.log(`\n${c.bold}${c.cyan}📱 디바이스 (최근 7일)${c.reset}`);
  console.log(c.gray + "─".repeat(60) + c.reset);
  const devResults = await hogql(`
    SELECT
      coalesce(properties.$device_type, '(unknown)') as device,
      count(distinct distinct_id) as visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 7 day
    GROUP BY device
    ORDER BY visitors DESC
  `);
  const maxDev = Math.max(...devResults.map((r: any) => r[1]));
  for (const [device, visitors] of devResults) {
    console.log(`  ${padR(device, 15)} ${String(visitors).padStart(5)}명  ${bar(visitors, maxDev, 24)}`);
  }

  // === 전체 트래픽 요약 ===
  console.log(`\n${c.bold}${c.cyan}📊 전체 트래픽 요약${c.reset}`);
  console.log(c.gray + "─".repeat(60) + c.reset);
  const summary = await hogql(`
    SELECT
      count() as total_pageviews,
      count(distinct distinct_id) as unique_visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 7 day
  `);
  if (summary.length > 0) {
    const [pv, uv] = summary[0];
    console.log(`  ${c.dim}전체 페이지뷰:${c.reset}     ${c.bold}${c.green}${pv.toLocaleString()}${c.reset}`);
    console.log(`  ${c.dim}고유 방문자:${c.reset}       ${c.bold}${c.green}${uv.toLocaleString()}${c.reset}`);
  }

  // === 시간대별 (24h) ===
  console.log(`\n${c.bold}${c.cyan}⏰ 최근 24h 시간대별 페이지뷰${c.reset}`);
  console.log(c.gray + "─".repeat(60) + c.reset);
  const hourResults = await hogql(`
    SELECT
      toHour(timestamp + interval 9 hour) as hour,
      count() as views
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 24 hour
    GROUP BY hour
    ORDER BY hour
  `);
  const maxHour = Math.max(...hourResults.map((r: any) => r[1]), 1);
  const hourMap = new Map(hourResults.map((r: any) => [r[0], r[1]]));
  for (let h = 0; h < 24; h++) {
    const v = (hourMap.get(h) ?? 0) as number;
    if (v === 0) console.log(`  ${c.dim}${String(h).padStart(2, "0")}시  ${"·".repeat(20)}${c.reset}`);
    else console.log(`  ${String(h).padStart(2, "0")}시  ${c.green}${"█".repeat(Math.round((v / maxHour) * 20))}${c.gray}${".".repeat(Math.max(0, 20 - Math.round((v / maxHour) * 20)))}${c.reset}  ${v}`);
  }

  console.log("");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
