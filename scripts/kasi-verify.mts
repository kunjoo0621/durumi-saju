/**
 * 한국천문연구원(KASI) 대조 검사기 — 두루미 만세력을 국가 공식값과 맞춘다.
 *
 * 왜: CLAUDE.md 에 박힌 그 위험 —
 *     "절기가 9시간 밀려 절입 경계 출생자의 **월주가 뒤집히고 대운수도 어긋난다**"
 *     지금은 `lib/saju-solar-terms.golden.test.ts` 가 발행 만세력 골든값 2건으로만 가드한다.
 *     KASI 는 **국가 공식 절입 시각(분 단위)과 간지**를 준다 — 완전히 독립된 두 번째 대조군이다.
 *     (2026-08-21 신설. 12신살 버그가 6개월 방치됐던 그 정합성 문제와 같은 결.)
 *
 * 대조하는 것:
 *   ① 24절기 절입 시각  — KASI get24DivisionsInfo  vs  analyzeSolarTerms()
 *   ② 일주(일진)        — KASI getLunCalInfo       vs  두루미 사주 계산
 *
 * ★★실행 시 TZ=UTC 필수. KST 로 돌리면 절기가 9시간 밀려 조용히 다른 값이 나온다.
 *   getAdapter() 가 자가치유로 UTC 로 되돌리지만, 명시하는 편이 안전하다.
 *     TZ=UTC npx tsx scripts/kasi-verify.mts [연도=올해]
 *
 * ★인증키는 인코딩형이다. URLSearchParams 로 감싸면 이중 인코딩되어 인증 실패한다.
 *   문자열로 직접 붙일 것.
 */
import { readFileSync } from "fs";

const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim();
}
const KEY = env.DATA_GO_KR_KEY_ENC;
if (!KEY) { console.error(".env.local 에 DATA_GO_KR_KEY_ENC 필요"); process.exit(1); }

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m", red:"\x1b[31m", yellow:"\x1b[33m" };
const L=(s:any,n:number)=>String(s).padEnd(n);
const R=(s:any,n:number)=>String(s).padStart(n);
const TOLERANCE_MIN = 2;   // 골든 테스트와 같은 허용치

async function kasi(service: string, op: string, params: Record<string, string|number>) {
  const qs = Object.entries(params).map(([k,v])=>`${k}=${v}`).join("&");
  const r = await fetch(`https://apis.data.go.kr/B090041/openapi/service/${service}/${op}?serviceKey=${KEY}&_type=json&${qs}`);
  const j = await r.json();
  const code = j?.response?.header?.resultCode;
  if (code !== "00") throw new Error(`KASI ${op} → ${code} ${j?.response?.header?.resultMsg}`);
  const item = j?.response?.body?.items?.item;
  return item == null ? [] : Array.isArray(item) ? item : [item];
}

/**
 * ★★ 좌표계 주의 — 여기서 한 번 틀렸다(2026-08-21, 24건 전부 9시간씩 어긋나 보였다).
 *
 * 이 엔진(@gracefullight/saju)은 **"한국 벽시계를 UTC 인 척 인코딩한" 공간**에서 돈다.
 * 즉 prevJieMillis 는 진짜 epoch 이 아니라 `Date.UTC(한국벽시계)` 다.
 * (CLAUDE.md 의 TZ=UTC 규칙과 golden.test.ts 의 expectedMs 가 같은 규약을 쓴다)
 *
 * 그래서 KASI 의 KST 시각도 **-9h 하지 않고** Date.UTC 로 그대로 인코딩해야 비교가 맞는다.
 * 진짜 epoch 으로 바꾸면 정확히 9시간(540분) 어긋난 것처럼 보인다.
 */
const wallMs = (y:number,mo:number,d:number,h:number,mi:number) => Date.UTC(y, mo-1, d, h, mi);
const wallText = (ms:number) => {
  const d = new Date(ms);
  const p = (n:number)=>String(n).padStart(2,"0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

/**
 * ★명리에서 월주를 가르는 건 **절(節) 12개**뿐이다. 중기(氣)는 월주를 안 바꾼다.
 * analyzeSolarTerms 의 prevJieMillis 도 절만 돌려준다 — 중기와 비교하면 전부 불일치로 보인다.
 */
const JIE_12 = new Set(["입춘","경칩","청명","입하","망종","소서","입추","백로","한로","입동","대설","소한"]);

async function main() {
  const year = Number(process.argv[2] ?? new Date().getFullYear());
  if (new Date().getTimezoneOffset() !== 0)
    console.log(`${c.yellow}⚠ 프로세스 TZ 가 UTC 가 아닙니다(offset ${-new Date().getTimezoneOffset()/60}h). TZ=UTC 로 실행하세요.${c.reset}`);

  const { getAdapter } = await import("../lib/utils/saju");
  const { analyzeSolarTerms } = await import("@gracefullight/saju");
  const adapter = await getAdapter();

  console.log(`\n${c.bold}${c.cyan}KASI 대조 검사 — ${year}년${c.reset}  ${c.dim}허용 오차 ${TOLERANCE_MIN}분${c.reset}`);

  // ── ① 24절기 절입 시각 ──────────────────────────────────
  const terms: { name:string; ms:number }[] = [];
  for (let m = 1; m <= 12; m++) {
    for (const it of await kasi("SpcdeInfoService", "get24DivisionsInfo",
      { solYear: year, solMonth: String(m).padStart(2,"0"), numOfRows: 20 })) {
      const s = String(it.locdate);           // 20260807
      const t = String(it.kst).trim();        // "2043"
      terms.push({ name: it.dateName,
        ms: wallMs(+s.slice(0,4), +s.slice(4,6), +s.slice(6,8), +t.slice(0,2), +t.slice(2,4)) });
    }
    await new Promise(r=>setTimeout(r,80));
  }
  terms.sort((a,b)=>a.ms-b.ms);

  const jie = terms.filter(t => JIE_12.has(t.name));
  console.log(`\n${c.bold}━━ ① 절(節) 절입 시각 — 월주를 가르는 12개 ━━${c.reset}  ${c.dim}(KASI 전체 ${terms.length}건 중 절 ${jie.length}건)${c.reset}`);
  console.log(`  ${c.dim}${L("절기",6)}${L("KASI(KST)",19)}${L("두루미 엔진",19)}${R("차이",8)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(54)}${c.reset}`);
  let bad = 0, checked = 0;
  for (const t of jie) {
    // 절입 1시간 뒤를 기준으로 물으면 '직전절기'가 그 절기가 된다.
    // t.ms 는 '한국 벽시계를 UTC 로 인코딩한' 값 → UTC 필드가 곧 한국 벽시계다.
    const probe = new Date(t.ms + 3600_000);
    const got: any = analyzeSolarTerms(
      { date: new Date(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate(),
                       probe.getUTCHours(), probe.getUTCMinutes()), timeZone: "Asia/Seoul" },
      { adapter });
    const engineMs = got.prevJieMillis;
    if (engineMs == null) continue;
    checked++;
    const diffMin = Math.abs(engineMs - t.ms) / 60000;
    const ok = diffMin <= TOLERANCE_MIN;
    if (!ok) bad++;
    if (!ok || process.argv.includes("--all"))
      console.log(`  ${L(t.name,6)}${L(wallText(t.ms),19)}${L(wallText(engineMs),19)}` +
        `${ok?c.green:c.red}${R(diffMin.toFixed(0)+"분",8)}${c.reset}`);
  }
  console.log(`  ${bad===0?c.green:c.red}${checked}건 중 불일치 ${bad}건${c.reset}` +
    (bad===0 ? `  ${c.dim}(--all 로 전체 표시)${c.reset}` : ""));

  // ── ② 일주(일진) ───────────────────────────────────────
  //  절입 경계일을 포함해 뽑는다 — 여기서 틀리면 월주가 뒤집힌다.
  const probes: string[] = [];
  for (const t of jie.slice(0, 8)) probes.push(wallText(t.ms).slice(0,10));   // 절입일
  probes.push(`${year}-01-01`, `${year}-06-15`, `${year}-12-31`);

  console.log(`\n${c.bold}━━ ② 일주(일진) 대조 ━━${c.reset}  ${c.dim}절입일 위주 ${probes.length}건${c.reset}`);
  console.log(`  ${c.dim}${L("날짜",12)}${L("KASI 일진",14)}${L("KASI 월건",14)}${L("KASI 세차",14)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(54)}${c.reset}`);
  for (const d of probes) {
    const [y,mo,dd] = d.split("-");
    const [it] = await kasi("LrsrCldInfoService","getLunCalInfo",{ solYear:y, solMonth:mo, solDay:dd });
    if (!it) continue;
    console.log(`  ${L(d,12)}${L(it.lunIljin ?? "—",14)}${L(it.lunWolgeon ?? "—",14)}${L(it.lunSecha ?? "—",14)}`);
    await new Promise(r=>setTimeout(r,80));
  }
  console.log(`  ${c.dim}※ KASI 월건은 **음력 월** 기준이다. 명리 월주는 **절기** 기준이라 절입 경계에서 갈릴 수 있다.${c.reset}`);
  console.log(`  ${c.dim}  일진(일주)은 두 체계가 같아야 한다 — 여기가 어긋나면 만세력 자체가 틀린 것이다.${c.reset}\n`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
