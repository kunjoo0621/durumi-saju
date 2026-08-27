/**
 * 네이버 검색광고 **키워드별** 실적 + 브랜드 키워드 검색량 조회.
 *
 * 왜: naver-ad-stats.mts 는 광고그룹까지만 본다. 그런데 돈이 새는 단위는 키워드다.
 *     (2026-08-18 '오늘의운세' 키워드 하나가 광고비 90% 를 먹고 있던 걸 뒤늦게 발견)
 *     어떤 키워드가 노출만 먹고 클릭이 안 되는지, 클릭은 되는데 비싼지 키워드 단위로 본다.
 *
 * 같이 보는 것: 브랜드 키워드(두루미사주 등) 실검색량 — 브랜드 캠페인을 새로 깔 값어치가
 *     있는지는 "그 이름으로 검색하는 사람이 실제로 있는가"로 갈린다.
 *
 * 실행: npx tsx scripts/naver-kw-stats.mts [시작 YYYY-MM-DD] [종료 YYYY-MM-DD]
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
  console.error("NAVER_SEARCHAD_* 가 .env.local 에 있어야 한다.");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(uri: string, qs = ""): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
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
    if (res.ok) return JSON.parse(text);
    // keywordstool 은 429 가 잦다.
    if (res.status === 429 && attempt < 2) { await sleep(5000); continue; }
    throw new Error(`${uri} → HTTP ${res.status} ${text.slice(0, 160)}`);
  }
}

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const L = (s: string | number, n: number) => String(s).padEnd(n);
const R = (s: string | number, n: number) => String(s).padStart(n);
/** keywordstool 은 10 미만을 "< 10" 문자열로 준다. */
const num = (v: any) =>
  typeof v === "string" ? (v.includes("<") ? 5 : parseInt(v.replace(/[^0-9]/g, "")) || 0) : v || 0;

async function main() {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST
  const since = process.argv[2] ?? new Date(Date.now() + 9 * 3600 * 1000 - 30 * 86400_000).toISOString().slice(0, 10);
  const until = process.argv[3] ?? today;

  console.log(`\n네이버 검색광고 — 키워드별 실적  ${since} ~ ${until}\n${"─".repeat(78)}`);

  const campaigns = await api("/ncc/campaigns");
  for (const camp of campaigns) {
    const groups = await api("/ncc/adgroups", `?nccCampaignId=${camp.nccCampaignId}`);
    for (const g of groups) {
      const kws = await api("/ncc/keywords", `?nccAdgroupId=${g.nccAdgroupId}`);
      if (!kws?.length) continue;

      const ids = kws.map((k: any) => k.nccKeywordId);
      const fields = encodeURIComponent(JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt", "avgRnk"]));
      const tr = encodeURIComponent(JSON.stringify({ since, until }));
      // ★/stats 는 JSON 배열 형태의 ids 를 거부한다(11001 유효하지 않은 ID 형식).
      //   `ids=x&ids=y` 반복 파라미터만 받는다. 그것도 실패하면 id 단건으로 떨어진다.
      const rows: any[] = [];
      for (let i = 0; i < ids.length; i += 20) {
        const chunk = ids.slice(i, i + 20);
        const q = chunk.map((id: string) => `ids=${encodeURIComponent(id)}`).join("&");
        try {
          const r = await api("/stats", `?${q}&fields=${fields}&timeRange=${tr}`);
          rows.push(...(r?.data ?? []));
        } catch {
          for (const id of chunk) {
            const r = await api("/stats", `?id=${encodeURIComponent(id)}&fields=${fields}&timeRange=${tr}`);
            rows.push(...(r?.data ?? []));
            await sleep(150);
          }
        }
        await sleep(300);
      }
      const byId = new Map(rows.map((r: any) => [r.id, r]));

      const merged = kws
        .map((k: any) => {
          const s = byId.get(k.nccKeywordId) || {};
          return {
            kw: k.keyword,
            on: k.userLock !== true && k.status !== "PAUSED",
            bid: k.bidAmt ?? null,
            imp: s.impCnt || 0,
            clk: s.clkCnt || 0,
            cost: s.salesAmt || 0,
            rnk: s.avgRnk || 0,
          };
        })
        .sort((a: any, b: any) => b.cost - a.cost || b.imp - a.imp);

      const tc = merged.reduce((s: number, m: any) => s + m.cost, 0);
      console.log(`\n■ [${camp.name}] ${g.name}  ${g.userLock ? "(그룹 정지)" : ""}  키워드 ${merged.length}개 · 30일 ${won(tc)}`);
      console.log(`  ${L("키워드", 22)}${R("상태", 5)}${R("노출", 9)}${R("클릭", 7)}${R("CTR", 8)}${R("비용", 11)}${R("CPC", 8)}${R("비중", 7)}`);
      console.log(`  ${"─".repeat(76)}`);
      for (const m of merged) {
        if (m.imp === 0 && m.cost === 0) continue;
        const ctr = m.imp ? ((m.clk / m.imp) * 100).toFixed(2) + "%" : "—";
        const cpc = m.clk ? Math.round(m.cost / m.clk) + "원" : "—";
        const share = tc ? ((m.cost / tc) * 100).toFixed(0) + "%" : "—";
        console.log(
          `  ${L(m.kw, 22)}${R(m.on ? "ON" : "OFF", 5)}${R(m.imp.toLocaleString(), 9)}${R(m.clk, 7)}${R(ctr, 8)}${R(won(m.cost), 11)}${R(cpc, 8)}${R(share, 7)}`
        );
      }
      const zero = merged.filter((m: any) => m.imp === 0 && m.cost === 0);
      if (zero.length) console.log(`  ${zero.length}개는 30일 노출 0 (생략)`);
    }
  }

  // ── 브랜드 키워드 실검색량 ────────────────────────────────
  console.log(`\n${"─".repeat(78)}\n브랜드 키워드 월간 검색량 (네이버 실측)\n`);
  const BRAND = ["두루미사주", "사주보는두루미", "두루미 사주", "사주두루미", "durumisaju"];
  try {
    const r = await api("/keywordstool", `?hintKeywords=${encodeURIComponent(BRAND.join(","))}&showDetail=1`);
    const list = (r?.keywordList ?? []).filter((k: any) =>
      BRAND.some((b) => k.relKeyword.replace(/\s/g, "") === b.replace(/\s/g, ""))
    );
    if (!list.length) {
      console.log("  exact match 없음 — 검색량이 집계 하한(월 10회) 미만이라는 뜻.");
    } else {
      console.log(`  ${L("키워드", 20)}${R("PC", 8)}${R("모바일", 8)}${R("합계", 8)}${R("경쟁도", 8)}`);
      console.log(`  ${"─".repeat(52)}`);
      for (const k of list) {
        const pc = num(k.monthlyPcQcCnt), mo = num(k.monthlyMobileQcCnt);
        console.log(`  ${L(k.relKeyword, 20)}${R(pc, 8)}${R(mo, 8)}${R(pc + mo, 8)}${R(k.compIdx ?? "—", 8)}`);
      }
    }
  } catch (e: any) {
    console.log(`  조회 실패: ${e.message.slice(0, 120)}`);
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
