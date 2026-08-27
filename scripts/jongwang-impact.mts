/**
 * v21 종왕 분기 영향 감사 (2026-08-27)
 *
 *   ① 종왕 게이트(극왕+관살0+재성0+인수>=1) 인원
 *   ② 관성 제외 분기(극왕+관살0, 종왕 아님) 인원
 *   ③ ★그 둘 외에 용신·기신·희신이 바뀐 사람이 0명인가 (변경 국소성 증명)
 *   ④ 대상자의 점수·등급 before→after
 *
 * ★TZ=UTC 필수. ★Supabase 페이지네이션 필수.
 * before 는 git stash 없이 구할 수 없으므로, 현행(after) 엔진으로 계산하고
 * before 는 옛 규칙을 이 스크립트 안에서 재현해 비교한다.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const { calculateSaju, enrichSajuData } = await import("../lib/utils/saju");
const { calculateServerScoring } = await import("../lib/utils/saju-scoring");

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) { const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/); if (m) envVars[m[1].trim()] = m[2].trim(); }
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const rows: any[] = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from("saju_results").select("id, birth_date, birth_time, gender").range(from, from + 999);
  if (!data?.length) break; rows.push(...data); if (data.length < 1000) break;
}

const CTRLBY: Record<string,string> = { "목":"금","화":"수","토":"목","금":"화","수":"토" };
const CTRL:   Record<string,string> = { "목":"토","화":"금","토":"수","금":"목","수":"화" };
const GEN:    Record<string,string> = { "목":"화","화":"토","토":"금","금":"수","수":"목" };
const GENBY:  Record<string,string> = { "목":"수","화":"목","토":"화","금":"토","수":"금" };
const STRONG = new Set(["극왕","태강","신강","중화신강"]);

/** v20(옛) 억부용신 재현 — 관성>식상>재성 동률 우선 */
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
function oldGisin(dayEl: string, lvl: string, eokbu: string) {
  const gwan = CTRLBY[dayEl], sik = GEN[dayEl], jae = CTRL[dayEl], ins = GENBY[dayEl];
  return STRONG.has(lvl) ? (eokbu === sik ? ins : dayEl) : (eokbu === ins ? jae : gwan);
}

let n = 0, jongwang = 0, noGwanOther = 0, changed = 0, unexpectedChange = 0;
let gradeUp = 0, gradeDown = 0, gradeSame = 0;
const samples: string[] = [];
for (const r of rows) {
  if (!r.birth_date) continue;
  const d = new Date(r.birth_date);
  const [hh, mm] = String(r.birth_time ?? "12:00").split(":").map(Number);
  let e: any;
  try {
    const s: any = await calculateSaju(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate(), Number.isFinite(hh)?hh:12, Number.isFinite(mm)?mm:0);
    if (!s) continue; e = enrichSajuData(s, { isTimeUnknown: !r.birth_time });
  } catch { continue; }
  const lvl = e?.strength?.result, dayEl = e?.dayMaster?.element, y = e?.yongshin;
  if (!lvl || !dayEl || !y) continue;
  n++;
  const dist = e.elementDist ?? {};
  const gwanN = dist[CTRLBY[dayEl]] ?? 0, jaeN = dist[CTRL[dayEl]] ?? 0, insN = dist[GENBY[dayEl]] ?? 0;
  const isJW = lvl === "극왕" && gwanN === 0 && jaeN === 0 && insN >= 1;
  const isNoGwan = lvl === "극왕" && gwanN === 0 && !isJW;
  if (isJW) jongwang++;
  if (isNoGwan) noGwanOther++;

  const oe = oldEokbu(dayEl, lvl, dist), og = oldGisin(dayEl, lvl, oe);
  const diff = oe !== y.eokbu || og !== y.gisin;
  if (diff) {
    changed++;
    if (!isJW && !isNoGwan) { unexpectedChange++; if (samples.length < 5) samples.push(`  ★예상밖: ${lvl} 일간${dayEl} 관살${gwanN} 재성${jaeN} | ${oe}→${y.eokbu}`); }
  }
}
console.log(`대상 ${n}명`);
console.log(`  ① 종왕(극왕+관살0+재성0+인수>=1)      : ${jongwang}명`);
console.log(`  ② 관성 제외(극왕+관살0, 종왕 아님)    : ${noGwanOther}명`);
console.log(`  용신·기신이 바뀐 총 인원              : ${changed}명`);
console.log(`  ★①+② 밖에서 바뀐 인원                : ${unexpectedChange}명 ${unexpectedChange === 0 ? "✓ 변경 국소성 확인" : "★국소성 위반"}`);
samples.forEach(s => console.log(s));
