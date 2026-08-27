/**
 * 매거진 연예인 편 — 강약/신살 수정이 라이브 글과 어긋나게 만드는지 전수 대조.
 *
 * 왜: 연예인 글은 발행 시점 판정을 본문에 박제한다. 엔진을 고치면 글이 제품과 갈린다.
 *     8/19 박은빈 편에서 실제로 이 문제로 critic 이 RED 를 냈다.
 *
 * 방법: 각 글의 생년월일로
 *        구규칙(12운성 생왕지 OR 본기 / 천덕·월덕 일주제외)
 *        신규칙(현행 엔진 = 득령 왕상휴수 + 득지·득시 전층통근 / 천덕·월덕 전 칸)
 *       을 각각 계산해 8단계와 길신 목록을 비교한다.
 *
 * ★연예인 글은 대부분 시 미상(3주)이므로 unknownBirthTime=true 로 계산한다.
 *   TZ=UTC 필수.
 */
const { BRANCH_INFO, STEM_ELEMENT, GENERATES } = await import("../lib/utils/saju-enrichment");
const { resolveSajuEnrichedData } = await import("../lib/analysis");

const BI = BRANCH_INFO as any;
const BR = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const YANG = new Set(["甲","丙","戊","庚","壬"]);
const JS: Record<string,string> = { 甲:"亥", 丙:"寅", 戊:"寅", 庚:"巳", 壬:"申", 乙:"午", 丁:"酉", 己:"酉", 辛:"子", 癸:"卯" };
const NM = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"];
const PROS = new Set(["장생","관대","건록","제왕"]);
const stage = (s: string, b: string) => {
  const bi = BR.indexOf(JS[s]), ti = BR.indexOf(b);
  return NM[YANG.has(s) ? ((ti - bi + 12) % 12) : ((bi - ti + 12) % 12)];
};
const el = (s: string) => STEM_ELEMENT[s]?.element;
const bongiEl = (b: string) => el(BI[b].jijanggan[0].stem);
const genMe = (e: string) => Object.keys(GENERATES).find((k) => (GENERATES as any)[k] === e)!;

/** 구규칙: 12운성 생왕지 OR 본기 비화/인성 */
const OLD = (s: string, b: string) => {
  if (PROS.has(stage(s, b))) return true;
  const he = bongiEl(b), de = el(s);
  return he === de || (GENERATES as any)[he] === de;
};

/** 구규칙으로 8단계 재현 */
function oldLevel(stems: string[], brs: string[], timeUnknown: boolean) {
  const ds = stems[2], de = el(ds), gm = genMe(de);
  const uS = timeUnknown ? stems.slice(0, 3) : stems;
  const uB = timeUnknown ? brs.slice(0, 3) : brs;
  const dist: Record<string, number> = { 목:0, 화:0, 토:0, 금:0, 수:0 };
  for (const x of uS) dist[el(x)]++;
  for (const b of uB) dist[BI[b].element]++;
  const total = uS.length + uB.length, help = dist[de] + dist[gm];
  const resist = Math.max(0, total - help);
  const dr = OLD(ds, brs[1]), dj = OLD(ds, brs[2]);
  const dsi = timeUnknown ? false : OLD(ds, brs[3]);
  let hs = 0;
  for (let i = 0; i < uS.length; i++) { if (i === 2) continue; const e = el(uS[i]); if (e === de || e === gm) hs++; }
  const tc = [dr, dj, dsi, hs >= 2].filter(Boolean).length, hr = help / total;
  if (tc === 4) return "극왕";
  if (tc === 3 && hr > 0.6) return "태강";
  if (tc === 3) return "신강";
  if (tc === 2 && help >= resist) return "중화신강";
  if (tc === 2) return "중화신약";
  if (tc === 1) return "신약";
  if (dist[de] === 0) return "극약";
  return Object.values(dist).filter((v) => v === 0).length >= 2 ? "태약" : "신약";
}

const CD: Record<string,string> = { 寅:"丁", 卯:"申", 辰:"壬", 巳:"辛", 午:"亥", 未:"甲", 申:"癸", 酉:"寅", 戌:"丙", 亥:"乙", 子:"巳", 丑:"庚" };
const WD: Record<string,string> = { 寅:"丙", 午:"丙", 戌:"丙", 申:"壬", 子:"壬", 辰:"壬", 巳:"庚", 酉:"庚", 丑:"庚", 亥:"甲", 卯:"甲", 未:"甲" };
/** 구규칙 천덕·월덕: 일주(일간·일지) 제외하고 탐색 */
function oldDeok(stems: string[], brs: string[], timeUnknown: boolean) {
  const n = timeUnknown ? 3 : 4;
  const oS: string[] = [], oB: string[] = [];
  for (let i = 0; i < n; i++) { if (i === 2) continue; oS.push(stems[i]); oB.push(brs[i]); }
  const mb = brs[1], out: string[] = [];
  const cd = CD[mb]; if (cd && (BR.includes(cd) ? oB.includes(cd) : oS.includes(cd))) out.push("천덕귀인");
  const wd = WD[mb]; if (wd && oS.includes(wd)) out.push("월덕귀인");
  return out;
}

const PEOPLE: [string, string, string][] = [
  ["안유진",   "anyujin",     "2003-09-01"],
  ["공효진",   "gonghyojin",  "1980-04-04"],
  ["고윤정",   "goyunjeong",  "1996-04-22"],
  ["장기하",   "janggiha",    "1982-02-20"],
  ["전유진",   "jeonyujin",   "2006-10-10"],
  ["이채민",   "leechaemin",  "2000-09-15"],
  ["박지훈",   "parkjihoon",  "1999-05-29"],
  ["소지섭",   "sojiseop",    "1977-11-04"],
  ["태연",     "taeyeon",     "1989-03-09"],
  ["윤경호",   "yoonkyungho", "1980-07-05"],
  ["윤가이",   "yungai",      "2000-09-16"],
];

async function main() {
  if (new Date().getTimezoneOffset() !== 0) { console.error("TZ=UTC 로 실행하세요"); process.exit(1); }
  console.log("이름     슬러그          구판정 → 신판정        길신 변화");
  console.log("─".repeat(78));
  let changed = 0, gilsinChanged = 0;
  for (const [name, slug, birth] of PEOPLE) {
    const [y, m, d] = birth.split("-");
    const { enriched } = await resolveSajuEnrichedData({
      name: "", birthYear: y, birthMonth: m, birthDay: d,
      calendarType: "solar", birthHour: "12", birthMinute: "0",
      birthLocation: "", gender: "female",
      relationshipStatus: "", employmentStatus: "", coreFearAxis: "",
      unknownBirthTime: true,
    } as any);
    if (!enriched) { console.log(`${name} — 계산 실패`); continue; }
    // pillars 는 "己巳(기사)" 형태 문자열이다
    const P = enriched.pillars as any;
    const pick = (v: string | null) => (v ? [v[0], v[1]] : null);
    const yy = pick(P.year), mm = pick(P.month), dd = pick(P.day), hh = pick(P.hour);
    if (!yy || !mm || !dd) { console.log(`${name} — 원국 파싱 실패`); continue; }
    const stems = [yy[0], mm[0], dd[0], hh?.[0] ?? dd[0]];
    const brs   = [yy[1], mm[1], dd[1], hh?.[1] ?? dd[1]];
    const before = oldLevel(stems, brs, true);
    const after  = enriched.strength?.result ?? "?";
    const gil = (enriched.shinsal?.matches ?? []).filter((x: any) => x.type === "good").map((x: any) => x.label.replace(/\(.*\)/, ""));
    const oldDk = oldDeok(stems, brs, true);
    const newDk = gil.filter((g: string) => g === "천덕귀인" || g === "월덕귀인");
    const added = newDk.filter((g: string) => !oldDk.includes(g));
    const hasNewGil = added.length > 0;
    const mark = before !== after ? "★" : " ";
    if (before !== after) changed++;
    if (hasNewGil) gilsinChanged++;
    console.log(`${mark}${name.padEnd(6)} ${slug.padEnd(14)} ${before.padEnd(6)} → ${after.padEnd(8)}  ${added.length ? "신규 " + added.join("·") : "변화 없음"}`);
  }
  console.log("─".repeat(78));
  console.log(`강약 판정이 바뀌는 글: ${changed} / ${PEOPLE.length}편`);
  console.log(`★천덕·월덕이 새로 잡히는 글: ${gilsinChanged}편 (본문에 길신 목록이 있으면 함께 교정 필요)`);
}
main();
