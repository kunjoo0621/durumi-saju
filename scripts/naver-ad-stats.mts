/**
 * 네이버 검색광고 실적 조회 — 광고비가 어디까지 새는지 한 줄로 본다.
 *
 * 왜 만들었나: 2026-08-03 "광고 클릭은 나오는데 가입 0" 조사에서 광고 실적을 운영자가
 * CSV 로 내려받아 전달해야 했고, 그 CSV 가 캠페인 하나만 담고 있어 광고그룹별 문제를
 * 놓쳤다(실제로 광고그룹 2개가 노출 0 인 채 예산만 잡고 있었다).
 *
 * 인증: .env.local 의 NAVER_SEARCHAD_{ACCESS_LICENSE,SECRET_KEY,CUSTOMER_ID}
 *   발급: ads.naver.com → 광고계정 → 도구 > API 사용 관리
 *   ★CUSTOMER_ID 는 URL 의 ad-accounts/<번호> 가 **아니다**(그건 새 광고주센터의 계정 ID).
 *     API 사용 관리 화면에 표시된 CUSTOMER_ID 를 써야 한다 — 틀리면 403 auth-failed.
 * 서명: base64(HMAC-SHA256(secret, `${timestamp}.${METHOD}.${uri}`)) — 공식 python-sample 과 동일.
 *
 * 실행: npx tsx scripts/naver-ad-stats.mts [시작 YYYY-MM-DD] [종료 YYYY-MM-DD]
 */
import crypto from "crypto";
import { readFileSync } from "fs";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const KEY = env.NAVER_SEARCHAD_ACCESS_LICENSE;
const SECRET = env.NAVER_SEARCHAD_SECRET_KEY;
const CUSTOMER = env.NAVER_SEARCHAD_CUSTOMER_ID;
if (!KEY || !SECRET || !CUSTOMER) {
  console.error("NAVER_SEARCHAD_ACCESS_LICENSE / SECRET_KEY / CUSTOMER_ID 가 .env.local 에 있어야 한다.");
  process.exit(1);
}

async function api(uri: string, qs = ""): Promise<any> {
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", SECRET).update(`${ts}.GET.${uri}`).digest("base64");
  const res = await fetch(`https://api.searchad.naver.com${uri}${qs}`, {
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Timestamp": String(ts),
      "X-API-KEY": KEY,
      "X-Customer": CUSTOMER,
      "X-Signature": sig,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${uri} → HTTP ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const pad = (s: string | number, n: number) => String(s).padStart(n);

async function stats(id: string, since: string, until: string) {
  const fields = encodeURIComponent(JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt"]));
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  const r = await api("/stats", `?id=${id}&fields=${fields}&timeRange=${tr}&timeIncrement=1`);
  return (r?.data ?? []) as Array<{ dateStart: string; impCnt: number; clkCnt: number; salesAmt: number; ccnt: number }>;
}

async function main() {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST
  const since = process.argv[2] ?? new Date(Date.now() + 9 * 3600 * 1000 - 7 * 86400_000).toISOString().slice(0, 10);
  const until = process.argv[3] ?? today;

  console.log(`\n네이버 검색광고 실적  ${since} ~ ${until}\n${"─".repeat(64)}`);

  const campaigns = await api("/ncc/campaigns");
  for (const c of campaigns) {
    console.log(`\n■ 캠페인: ${c.name}  [${c.campaignTp}]  ${c.userLock ? "★중지" : "운영"}`);

    const rows = await stats(c.nccCampaignId, since, until);
    if (rows.length) {
      console.log(`  ${pad("날짜", 10)} ${pad("노출", 8)} ${pad("클릭", 6)} ${pad("CTR", 7)} ${pad("비용", 10)} ${pad("전환", 5)}`);
      let ti = 0, tc = 0, ts2 = 0;
      for (const r of rows) {
        ti += r.impCnt; tc += r.clkCnt; ts2 += r.salesAmt;
        const ctr = r.impCnt ? ((r.clkCnt / r.impCnt) * 100).toFixed(2) + "%" : "—";
        console.log(`  ${pad(r.dateStart, 10)} ${pad(r.impCnt.toLocaleString(), 8)} ${pad(r.clkCnt, 6)} ${pad(ctr, 7)} ${pad(won(r.salesAmt), 10)} ${pad(r.ccnt ?? 0, 5)}`);
      }
      console.log(`  ${pad("합계", 10)} ${pad(ti.toLocaleString(), 8)} ${pad(tc, 6)} ${pad(ti ? ((tc / ti) * 100).toFixed(2) + "%" : "—", 7)} ${pad(won(ts2), 10)}`);
      if (tc > 0) console.log(`  → 클릭당 ${won(ts2 / tc)}`);
    }

    // 광고그룹별 — ★노출 0 인 그룹을 드러내는 게 이 블록의 목적이다.
    const groups = await api("/ncc/adgroups", `?nccCampaignId=${c.nccCampaignId}`);
    console.log(`\n  광고그룹 ${groups.length}개`);
    for (const g of groups) {
      const gr = await stats(g.nccAdgroupId, since, until);
      const imp = gr.reduce((a, r) => a + r.impCnt, 0);
      const clk = gr.reduce((a, r) => a + r.clkCnt, 0);
      const amt = gr.reduce((a, r) => a + r.salesAmt, 0);
      const flag = imp === 0 ? "  ★노출 0 — 예산만 묶여 있다(입찰가·키워드 점검)" : "";
      console.log(`   - ${g.name.padEnd(16)} 일예산 ${pad(won(g.dailyBudget ?? 0), 9)}  노출 ${pad(imp.toLocaleString(), 8)}  클릭 ${pad(clk, 5)}  비용 ${pad(won(amt), 9)}${flag}`);
    }

    // 소재별 랜딩 URL — utm 누락 소재를 잡는다(유입 분석이 통째로 깨진다)
    for (const g of groups) {
      const ads = await api("/ncc/ads", `?nccAdgroupId=${g.nccAdgroupId}`).catch(() => []);
      for (const a of ads) {
        const land = a.ad?.mobile?.final ?? a.ad?.pc?.final ?? "";
        if (land && !land.includes("utm_source")) {
          console.log(`   ⚠ [${g.name}] 소재 랜딩에 utm 없음 → 유입 추적 불가: ${land}`);
        }
      }
    }
  }
  console.log(`\n${"─".repeat(64)}`);
  console.log("※ 전환수는 네이버 전환추적 스크립트가 설치돼야 채워진다(현재 미설치 → 항상 0).");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
