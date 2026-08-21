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
      console.log(`   - ${g.name.padEnd(16)} 일예산 ${pad(won(g.dailyBudget ?? 0), 9)}  노출 ${pad(imp.toLocaleString(), 8)}  클릭 ${pad(clk, 5)}  비용 ${pad(won(amt), 9)}`);
      // ★노출 0 이면 원인을 추측하지 말고 실제로 조회해서 짚는다.
      //   (2026-08-10: "입찰가·키워드 점검"이라 추측했는데 실제 원인은 소재·키워드가 0개였다)
      if (imp === 0) {
        const ads = await api("/ncc/ads", `?nccAdgroupId=${g.nccAdgroupId}`).catch(() => []);
        const kws = await api("/ncc/keywords", `?nccAdgroupId=${g.nccAdgroupId}`).catch(() => []);
        const causes: string[] = [];
        if (!ads.length) causes.push("소재 0개");
        if (!kws.length) causes.push("키워드 0개");
        if (g.userLock) causes.push("그룹 중지됨");
        if (!causes.length) causes.push(`소재 ${ads.length}·키워드 ${kws.length} 있음 → 입찰가(${g.bidAmt}원) 또는 검수 상태 확인`);
        console.log(`     ★노출 0 — ${causes.join(" / ")}  (비용은 0원이라 손실은 아니다)`);
      }
    }

    // ── 소재 목록 ────────────────────────────────────────────
    // ★2026-08-21 두 가지를 고쳤다.
    //  ① a.ad.headline 만 읽어 반응형 소재(RSA_AD)를 "빈 소재"로 오독했다.
    //     RSA 는 문구가 a.assets[] 에 linkType=HEADLINE/DESCRIPTION 으로 들어간다.
    //     그걸 "정리하자"고 제안할 뻔했는데 실제로는 제목 13개짜리 주력 소재였다.
    //  ② "utm 없음" 경고가 오탐이었다. 4개 중 3개엔 utm 이 붙어 있었는데
    //     경고 문구만 보고 "utm 을 붙이자"고 판단했다.
    //     ★애초에 네이버 검색광고는 랜딩 쿼리스트링을 NaPm 으로 통째로 바꿔치기해서
    //       utm 은 도착 시점에 사라진다(lib/naver-ad-params.ts 참조). 경고 자체가 무의미하다.
    //       유입 추적은 middleware 의 NaPm 파싱이 담당한다.
    for (const g of groups) {
      const ads = await api("/ncc/ads", `?nccAdgroupId=${g.nccAdgroupId}`).catch(() => []);
      if (!ads.length) continue;
      console.log(`\n   ▸ [${g.name}] 소재 ${ads.length}개`);
      for (const a of ads) {
        const land = (a.ad?.mobile?.final ?? a.ad?.pc?.final ?? "").split("?")[0];
        const on = a.userLock === true ? "정지" : (a.status ?? "-");
        if (a.type === "RSA_AD") {
          const g2: Record<string, string[]> = {};
          for (const s of (a.assets ?? [])) (g2[s.linkType] ??= []).push(s.assetData?.text ?? "");
          const heads = g2.HEADLINE ?? [], descs = g2.DESCRIPTION ?? [];
          console.log(`     [반응형·${on}] 제목 ${heads.length}개 · 설명 ${descs.length}개 → ${land}`);
          heads.slice(0, 3).forEach(t => console.log(`        · ${t}`));
          if (heads.length > 3) console.log(`        · … 외 ${heads.length - 3}개`);
        } else {
          console.log(`     [단일·${on}] ${a.ad?.headline ?? "(제목없음)"} → ${land}`);
          console.log(`        ${a.ad?.description ?? "(설명없음)"}`);
        }
      }
    }
  }
  console.log(`\n${"─".repeat(64)}`);
  console.log("※ 전환수는 네이버 전환추적 스크립트가 설치돼야 채워진다(현재 미설치 → 항상 0).");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
