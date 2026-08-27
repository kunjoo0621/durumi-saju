/**
 * v21 종왕 분기 영향 감사 (2026-08-27)
 *
 *   ① 종왕 게이트(극왕+관살0+재성0+인수>=1) 인원
 *   ② 관성 제외 분기(극왕+관살0, 종왕 아님) 인원
 *   ③ ★그 둘 밖에서 용신·기신이 바뀐 사람이 0명인가 (변경 국소성 증명)
 *   ④ 대상자 composite·등급 before→after  ★커밋된 코드로 재현 가능해야 한다
 *   ⑤ ★#145 조후 노트와의 교집합 — 종왕 기신(관성)은 관살 0이라 항상 n=0 분기에 떨어진다.
 *      "犯旺이라 꺼려야 할 오행"과 "조후위급이라 채워야 할 오행"이 같은 프롬프트에 나가는가
 *
 * ★TZ=UTC 필수(절기 경계) — 가드 있음. ★Supabase 1000행 잘림 → 페이지네이션 필수.
 * ★region(경도 보정) 반영 — 안 하면 프로덕션과 다른 차트를 센다.
 * ★한계: 음력 입력분(249건, 7.6%)은 birth_date 에 **원본 음력 그대로** 저장돼 있고
 *   (payment/complete:277·career/start:222 — 양력 변환은 계산 시점에만 한다),
 *   saju_results 에 윤달 플래그가 없어 재구성할 수 없다. 그 건들은 양력으로 간주해
 *   계산되므로 아래 인원수는 근사다. 국소성 논증(같은 차트로 구/신 규칙 비교)은 무영향.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

if (new Date().getTimezoneOffset() !== 0) { console.error("TZ=UTC 로 실행하세요"); process.exit(1); }

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) { const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/); if (m) envVars[m[1].trim()] = m[2].trim(); }
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const { calculateSaju, enrichSajuData } = await import("../lib/utils/saju");
const { calculateServerScoring } = await import("../lib/utils/saju-scoring");
const { formatEnrichedSajuText } = await import("../lib/utils/saju-enrichment");

const rows: any[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("saju_results")
    .select("id, birth_date, birth_time, region, calendar_type").range(from, from + 999);
  if (error) throw new Error(error.message);
  if (!data?.length) break;
  rows.push(...data);
  if (data.length < 1000) break;
}

const CTRLBY: Record<string,string> = { "목":"금","화":"수","토":"목","금":"화","수":"토" };
const CTRL:   Record<string,string> = { "목":"토","화":"금","토":"수","금":"목","수":"화" };
const GEN:    Record<string,string> = { "목":"화","화":"토","토":"금","금":"수","수":"목" };
const GENBY:  Record<string,string> = { "목":"수","화":"목","토":"화","금":"토","수":"금" };
const STRONG = new Set(["극왕","태강","신강","중화신강"]);
const ORDER = ["D","C","B","A","S"];

/** v20(옛) 억부용신 재현 — 신강이면 {관성,식상,재성} 최저, 동률 시 관성>식상>재성 */
function oldEokbu(dayEl: string, lvl: string, dist: Record<string, number>) {
  const gwan = CTRLBY[dayEl], sik = GEN[dayEl], jae = CTRL[dayEl], ins = GENBY[dayEl];
  const cands = STRONG.has(lvl)
    ? [{ e: gwan, l: "관성" }, { e: sik, l: "식상" }, { e: jae, l: "재성" }]
    : [{ e: ins, l: "인성" }, { e: dayEl, l: "비겁" }];
  cands.sort((a, b) => (dist[a.e] || 0) - (dist[b.e] || 0));
  const low = dist[cands[0].e] || 0;
  const pri = STRONG.has(lvl) ? ["관성","식상","재성"] : ["인성","비겁"];
  const tied = cands.filter(c => (dist[c.e] || 0) === low).sort((a,b)=>pri.indexOf(a.l)-pri.indexOf(b.l));
  return tied[0].e;
}
const oldGisin = (dayEl: string, lvl: string, eokbu: string) => {
  const gwan = CTRLBY[dayEl], sik = GEN[dayEl], jae = CTRL[dayEl], ins = GENBY[dayEl];
  return STRONG.has(lvl) ? (eokbu === sik ? ins : dayEl) : (eokbu === ins ? jae : gwan);
};
const oldHeesin = (dayEl: string, lvl: string, eokbu: string) => {
  const gwan = CTRLBY[dayEl], sik = GEN[dayEl], jae = CTRL[dayEl], ins = GENBY[dayEl];
  return STRONG.has(lvl) ? (eokbu === gwan || eokbu === sik ? jae : sik) : (eokbu === ins ? gwan : ins);
};

let n = 0, jongwang = 0, noGwanOther = 0, changed = 0, unexpected = 0;
let up = 0, down = 0, same = 0, gUp = 0, gDown = 0, johuClash = 0, johuOverlap = 0, johuJongwangNote = 0;
let lunar = 0, regioned = 0;
const deltas: number[] = [];
const notes: string[] = [];

for (const r of rows) {
  const ds = String(r.birth_date ?? ""); if (ds.length < 10) continue;
  const y = +ds.slice(0,4), mo = +ds.slice(5,7), dd = +ds.slice(8,10);
  if (!y || y < 1901 || y > 2030) continue;
  // ★음력 원본 저장분은 양력으로 간주된다(위 헤더 한계 참조). 건수만 공시한다.
  if (r.calendar_type && String(r.calendar_type).includes("lunar")) lunar++;
  if (r.region) regioned++;
  const tm = String(r.birth_time ?? ""); const tu = tm.length < 5;
  const [hh, mi] = tu ? [12, 0] : [+tm.slice(0,2), +tm.slice(3,5)];
  let e: any;
  try {
    const s: any = await calculateSaju(y, mo, dd, hh, mi, { birthLocation: r.region ?? undefined });
    if (!s) continue;
    e = enrichSajuData(s, { isTimeUnknown: tu });
  } catch { continue; }
  const lvl = e?.strength?.result, dayEl = e?.dayMaster?.element, yg = e?.yongshin;
  if (!lvl || !dayEl || !yg) continue;
  n++;
  const dist = e.elementDist ?? {};
  const gwanN = dist[CTRLBY[dayEl]] ?? 0, jaeN = dist[CTRL[dayEl]] ?? 0, insN = dist[GENBY[dayEl]] ?? 0;
  // ★게이트를 여기서 재구현하지 않는다. 엔진이 내린 판정을 그대로 읽는다 —
  //   초안은 조건을 복제했다가 엔진에 식상 조건이 추가됐을 때 조용히 낡았다(감사 드리프트).
  const isJW = yg.eokbuReason.includes("종왕");
  const isNG = yg.eokbuReason.includes("관살 부재로 관성 제외");
  if (isJW) jongwang++;
  if (isNG) noGwanOther++;

  const oe = oldEokbu(dayEl, lvl, dist), og = oldGisin(dayEl, lvl, oe), oh = oldHeesin(dayEl, lvl, oe);
  if (oe !== yg.eokbu || og !== yg.gisin || oh !== yg.heesin) {
    changed++;
    if (!isJW && !isNG) { unexpected++; if (notes.length < 5) notes.push(`  ★예상밖: ${lvl} 일간${dayEl} 관살${gwanN} | ${oe}→${yg.eokbu}`); }
  }
  if (!isJW && !isNG) continue;

  // ④ composite·등급 before→after (커밋된 코드로 재현 가능하게 여기서 측정)
  const after = calculateServerScoring(e);
  const before = calculateServerScoring({ ...e, yongshin: { ...yg, eokbu: oe, gisin: og, heesin: oh } } as any);
  const dc = (after.tier?.composite ?? 0) - (before.tier?.composite ?? 0);
  deltas.push(dc);
  if (dc > 0) up++; else if (dc < 0) down++; else same++;
  const bg = before.tier?.grade, ag = after.tier?.grade;
  if (bg !== ag) { if (ORDER.indexOf(ag!) > ORDER.indexOf(bg!)) gUp++; else gDown++; }

  // ⑤ #145 조후 노트와의 교집합
  if (isJW && yg.johu === yg.gisin) {
    const line = formatEnrichedSajuText(e).split("\n").find((l: string) => l.startsWith("기신:")) ?? "";
    johuOverlap++;
    if (line.includes("★조후 충돌")) johuClash++;        // ← 犯旺 오행을 채우라는 지시. 0이어야 정상
    if (line.includes("★종왕 우선")) johuJongwangNote++;  // ← 종왕 전용 문구. overlap 과 같아야 정상
  }
}
const avg = deltas.length ? (deltas.reduce((a,b)=>a+b,0)/deltas.length).toFixed(2) : "-";
console.log(`대상 ${n}명 (region 보정 ${regioned}건 / ★음력 원본 ${lunar}건은 양력 간주 — 인원수 근사)`);
console.log(`  ① 종왕(극왕+관살0+재성0+식상0+인수>=1): ${jongwang}명`);
console.log(`  ② 관성 제외(극왕+관살0, 종왕 아님) : ${noGwanOther}명`);
console.log(`  용신·기신·희신이 바뀐 총 인원      : ${changed}명`);
console.log(`  ★①+② 밖에서 바뀐 인원             : ${unexpected}명 ${unexpected === 0 ? "✓ 변경 국소성" : "★위반"}`);
notes.forEach(s => console.log(s));
console.log(`  ④ composite 상승 ${up} · 하락 ${down} · 동일 ${same} (평균 ${avg}점)`);
console.log(`     등급 상승 ${gUp} · ★등급 하락 ${gDown}`);
console.log(`  ⑤ 종왕 ∩ 조후==기신 교집합: ${johuOverlap}명`);
console.log(`     └ 잘못된 "채우라" 문구: ${johuClash}명 ${johuClash === 0 ? "✓" : "★犯旺 지시 잔존"}`);
console.log(`     └ 종왕 전용 문구 부착 : ${johuJongwangNote}명 ${johuJongwangNote === johuOverlap ? "✓ 전원" : "★누락 " + (johuOverlap - johuJongwangNote)}`);
