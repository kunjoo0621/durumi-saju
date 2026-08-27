/**
 * Vercel Web Analytics 전체 조회 (스크린샷 불필요)
 *
 * 사용: npx tsx scripts/vercel-analytics.mts [since=YYYY-MM-DD] [until=YYYY-MM-DD]
 *
 * ⚠️ 주의
 *  - 계측 시작일 = 2026-08-07 (그 이전은 데이터가 영영 없음. 0을 "트래픽 절벽"으로 읽지 말 것)
 *  - API 는 since/until 을 **UTC 달력일**로 스냅한다. KST 창(15:00Z 기준)을 넣어도 무시된다.
 *    → 여기 나오는 "일자"는 전부 UTC 일. UTC 8/17 = KST 8/17 09:00 ~ 8/18 09:00.
 *  - utmSource/Medium/Campaign 그룹핑은 402 (Enterprise / Web Analytics Plus 전용). 현재 플랜 불가.
 *  - referrer 없음("(direct)")에는 **네이버 검색광고(NaPm)** 가 섞여 있다. 채널 판별 1차 근거는 우리 DB.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);

const TOKEN = env.VERCEL_TOKEN;
const TEAM_ID = "team_vAzcyTR70YtfOyj7teSIntug";
const PROJECT_ID = "prj_Y068sAb6SPkmB92au0PpTJHZcxQy";
const BASE = "https://api.vercel.com/v1/query/web-analytics";

const argSince = process.argv.find((a) => a.startsWith("since="))?.slice(6);
const argUntil = process.argv.find((a) => a.startsWith("until="))?.slice(6);

const SINCE = `${argSince ?? "2026-08-07"}T00:00:00.000Z`;
const todayUTC = new Date().toISOString().slice(0, 10);
const untilDay = argUntil ?? todayUTC;
const UNTIL = `${new Date(Date.parse(`${untilDay}T00:00:00Z`) + 86400_000)
  .toISOString()
  .slice(0, 10)}T00:00:00.000Z`;

async function q(endpoint: string, params: Record<string, string | string[]>, win?: [string, string]) {
  const u = new URL(`${BASE}/${endpoint}`);
  u.searchParams.set("teamId", TEAM_ID);
  u.searchParams.set("projectId", PROJECT_ID);
  u.searchParams.set("since", win?.[0] ?? SINCE);
  u.searchParams.set("until", win?.[1] ?? UNTIL);
  for (const [k, v] of Object.entries(params)) {
    for (const item of Array.isArray(v) ? v : [v]) u.searchParams.append(k, item);
  }
  const res = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const json: any = await res.json();
  if (json.error) throw new Error(`${endpoint} ${JSON.stringify(params)} → ${json.error.code}: ${json.error.message}`);
  return json.data;
}

const pct = (n: number, total: number) => (total ? ((n / total) * 100).toFixed(1) : "0.0");

function table(rows: { key: string; visitors: number; pageviews: number }[], total: number, top = 25) {
  const w = Math.max(6, ...rows.slice(0, top).map((r) => [...r.key].length + (r.key.match(/[가-힣]/g)?.length ?? 0)));
  const lines = [`  ${"항목".padEnd(w)}  방문자   비중     PV`];
  for (const r of rows.slice(0, top)) {
    const pad = w - ([...r.key].length + (r.key.match(/[가-힣]/g)?.length ?? 0));
    lines.push(
      `  ${r.key}${" ".repeat(Math.max(0, pad))}  ${String(r.visitors).padStart(6)}  ${pct(r.visitors, total).padStart(5)}%  ${String(r.pageviews).padStart(6)}`
    );
  }
  if (rows.length > top) lines.push(`  … 외 ${rows.length - top}개`);
  return lines.join("\n");
}

const norm = (d: any[], key: string) =>
  d
    .map((r) => ({ key: String(r[key] ?? "").trim() || "(direct/none)", visitors: r.visitors, pageviews: r.pageviews }))
    .sort((a, b) => b.visitors - a.visitors);

async function main() {
  console.log(`# Vercel Web Analytics — durumisaju`);
  console.log(`조회 구간(UTC일 기준): ${SINCE.slice(0, 10)} ~ ${untilDay}`);
  console.log(`실행 시각: KST ${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ")}\n`);

  const total = await q("visits/count", {});
  console.log(`## 합계\n  방문자 ${total.visitors}  ·  페이지뷰 ${total.pageviews}  ·  1인당 ${(total.pageviews / total.visitors).toFixed(2)}PV\n`);

  const daily = await q("visits/aggregate", { by: "day", limit: "100" });
  console.log("## 일자별 (UTC일)");
  console.log("  일자          방문자      PV   PV/방문");
  for (const d of daily) {
    console.log(
      `  ${d.timestamp.slice(0, 10)}  ${String(d.visitors).padStart(6)}  ${String(d.pageviews).padStart(6)}   ${d.visitors ? (d.pageviews / d.visitors).toFixed(2) : "-"}`
    );
  }
  console.log();

  const dims: [string, string, number][] = [
    ["referrerHostname", "유입처 (referrer)", 25],
    ["requestPath", "페이지 (실제 경로)", 30],
    ["route", "라우트 (템플릿)", 25],
    ["deviceType", "디바이스", 10],
    ["osName", "OS", 10],
    ["browserName", "브라우저", 12],
    ["country", "국가", 15],
  ];
  for (const [dim, title, top] of dims) {
    const rows = norm(await q("visits/aggregate", { by: dim, limit: "100" }), dim);
    console.log(`## ${title}`);
    console.log(table(rows, total.visitors, top));
    console.log();
  }

  // 시간별은 100행 제한 때문에 하루씩 끊어서 받는다(하루 24행)
  const byKstHour = new Array(24).fill(0);
  for (const d of daily) {
    const s = d.timestamp.slice(0, 10);
    const e = new Date(Date.parse(`${s}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
    const hourly = await q("visits/aggregate", { by: "hour", limit: "100" }, [`${s}T00:00:00.000Z`, `${e}T00:00:00.000Z`]);
    for (const h of hourly) {
      const kst = (new Date(h.timestamp).getUTCHours() + 9) % 24;
      byKstHour[kst] += h.visitors;
    }
  }
  console.log("## 시간대별 방문자 (KST, 전 구간 합)");
  const maxH = Math.max(...byKstHour);
  byKstHour.forEach((v, i) =>
    console.log(`  ${String(i).padStart(2, "0")}시  ${String(v).padStart(5)}  ${"█".repeat(Math.round((v / maxH) * 40))}`)
  );
  console.log();

  for (const dim of ["utmSource", "utmMedium", "utmCampaign"]) {
    try {
      const rows = norm(await q("visits/aggregate", { by: dim, limit: "100" }), dim);
      console.log(`## ${dim}`);
      console.log(table(rows, total.visitors, 20));
      console.log();
    } catch (e: any) {
      console.log(`## ${dim} — 조회 불가: ${e.message.split("→")[1]?.trim() ?? e.message}\n`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
