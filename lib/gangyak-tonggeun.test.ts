// 강약 4득 판정 + 천덕·월덕 탐색 범위 회귀 테스트 (2026-08-25 신설)
//
// 배경: 기존 `saju-facts-dict.test.ts`(870줄)는 엔진↔사전의 **조견표 값**을 대조한다.
//   그런데 2026-08-25에 찾은 버그 둘은 값이 아니라 **탐색 범위와 판정 규칙**이라
//   그 검사기의 대조 대상이 아니었고, 그래서 오래 방치됐다.
//   "어떤 값이냐"는 잠겨 있었는데 "어디서 찾고 어떻게 판정하느냐"는 안 잠겨 있었다.
//   이 파일이 그 구멍을 메운다.
//
// 근거는 각 테스트에 고전 원문으로 달아 둔다. 주석은 실행되지 않지만 테스트는 실행된다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isWangSangBranch,
  hasRootOrInseong,
  judgeStrength,
  findShinsal,
} from "./utils/saju-enrichment";

// ──────────────────────────────────────────────────────────────
// 1. 12운성 생왕지를 '득'으로 치던 경로가 사라졌는가
//
// 구현: "12운성이 장생·관대·건록·제왕이면 오행과 무관하게 득"
// 그렇게 추가되던 조합이 정확히 아래 13개인데, **전부 일간을 돕지 않는 십성**이었다.
// 칠살월(일간이 가장 극을 받는 달)을 득령으로 세는 셈이라 왕상휴수와 방향이 반대다.
//
// 적천수 주석: "甲木死於午, 午為洩氣之地, 理固然也; 而乙木死於亥, 亥中有壬水,
//   乃其嫡母, 何為死哉?" — 역행 12운성의 생사는 오행 생극과 어긋난다.
// 임철초: "不專以順逆為憑, 須觀日主之衰旺 … 至於長生沐浴等名, 乃假借形容之辭也"
// 서락오: "皆因誤於陰陽各有長生, 而不能自圓其說也"
// ──────────────────────────────────────────────────────────────
const FAKE_DEUK: [string, string, string][] = [
  // [일간, 지지, 실제 십성] — 12운성으로는 장생·관대라 '득'이었으나 전부 비겁·인성이 아니다
  ["戊", "寅", "편관(칠살)"],
  ["庚", "巳", "편관(칠살)"],
  ["壬", "戌", "편관(칠살)"],
  ["癸", "丑", "편관(칠살)"],
  ["乙", "午", "식신"],
  ["丙", "辰", "식신"],
  ["丁", "未", "식신"],
  ["己", "酉", "식신"],
  ["辛", "子", "식신"],
  ["癸", "卯", "식신"],
  ["甲", "丑", "정재"],
  ["乙", "辰", "정재"],
  ["丁", "酉", "편재"],
];

test("득령 — 12운성 생왕지 경로 제거: 가짜 득 13개 조합이 전부 부득이다", () => {
  for (const [stem, branch, star] of FAKE_DEUK) {
    assert.equal(
      isWangSangBranch(stem, branch),
      false,
      `${stem}-${branch}는 ${star}이므로 득령이 아니어야 한다(12운성 경로가 되살아났는지 확인)`,
    );
  }
});

test("득령 — 진짜 왕상(비겁·인성)은 그대로 득이다", () => {
  assert.equal(isWangSangBranch("甲", "寅"), true, "갑목-인월: 비겁(旺)");
  assert.equal(isWangSangBranch("甲", "子"), true, "갑목-자월: 인성(相)");
  assert.equal(isWangSangBranch("丙", "午"), true, "병화-오월: 비겁");
  assert.equal(isWangSangBranch("庚", "辰"), true, "경금-진월: 본기 戊土 = 인성");
  // 갑목 진월 — 辰 본기는 戊土(재성)라 득령은 아니다. 유근 여부는 아래 2번에서 따로 본다.
  assert.equal(isWangSangBranch("甲", "辰"), false, "갑목-진월: 본기 戊土는 재성이라 부득령");
});

// ──────────────────────────────────────────────────────────────
// 2. 득지·득시 — 통근은 지장간 전층에서 인정하는가
//
// 자평진전 「논음양생사」: "就使逢庫, 亦為有根"
// 서락오 평주: "天干通根, 不僅祿旺為美, 長生·餘氣·墓庫皆其根也.
//   如甲乙木見寅卯, 固為身旺, 而見亥辰未, 亦為有根也"
//   → 갑을목이 亥·辰·未를 봐도 유근. 본기만 보면 辰(본기 戊土)·未(본기 己土)를 놓친다.
// 음양 불문: 서락오 "墓本從五行論, 不分陰陽也"
// ──────────────────────────────────────────────────────────────
test("득지 — 갑을목은 亥·辰·未에서 유근이다 (서락오 직접 인용 케이스)", () => {
  for (const stem of ["甲", "乙"]) {
    assert.equal(hasRootOrInseong(stem, "辰"), true, `${stem}-辰: 중기 乙木에 통근`);
    assert.equal(hasRootOrInseong(stem, "未"), true, `${stem}-未: 여기 乙木에 통근`);
    assert.equal(hasRootOrInseong(stem, "亥"), true, `${stem}-亥: 중기 甲木에 통근`);
    assert.equal(hasRootOrInseong(stem, "寅"), true, `${stem}-寅: 본기 甲木`);
    assert.equal(hasRootOrInseong(stem, "卯"), true, `${stem}-卯: 본기 乙木`);
  }
});

test("득지 — 통근이 없고 생조도 없으면 부득이다", () => {
  // 갑목에게 申은 본기 庚金(관성)이고 지장간에 목이 없다
  assert.equal(hasRootOrInseong("甲", "申"), false, "갑목-신: 통근 없음, 본기는 관성");
  // 병화에게 酉는 본기 辛金(재성)이고 지장간에 화가 없다
  assert.equal(hasRootOrInseong("丙", "酉"), false, "병화-유: 통근 없음, 본기는 재성");
});

test("득지 — 통근이 없어도 본기가 인성이면 득이다 (통근 ≠ 생조)", () => {
  // 갑목에게 子는 본기 癸水 = 인성. 목 통근은 없지만 생조로 득
  assert.equal(hasRootOrInseong("甲", "子"), true, "갑목-자: 본기 癸水 인성");
  // ★단 미약한 여기·중기 인성까지 득으로 치지는 않는다.
  //   무토에게 亥는 중기 甲木(관성)·본기 壬水(재성)이라 부득이어야 한다.
  assert.equal(hasRootOrInseong("戊", "亥"), false, "무토-해: 본기 壬水는 재성이라 부득");
});

test("음양을 가리지 않는다 — 음간도 같은 오행이면 통근 (서락오 '不分陰陽')", () => {
  // 계수(음간)가 辰을 볼 때 여기 癸水에 통근한다
  assert.equal(hasRootOrInseong("癸", "辰"), true, "계수-진: 여기 癸水에 통근");
  // 정화(음간)가 戌을 볼 때 여기 丁火에 통근한다
  assert.equal(hasRootOrInseong("丁", "戌"), true, "정화-술: 여기 丁火에 통근");
});

// ──────────────────────────────────────────────────────────────
// 3. 천덕·월덕이 일주(일간·일지)에서도 잡히는가
//
// 삼명통회 「論天月德」: "凡命中帶凶煞, 得此二德扶化, 凶不為甚;
//   須要日上見, 時上不犯克沖刑破, 方吉"
//   → 일 자리에서 보는 것이 성립의 으뜸 조건이다.
// 사전 woldeok-gwiin.ts: "일간이 직접 월덕에 해당하면 본인 자체가 덕망을 갖춘 사람으로 봅니다"
//
// 구현은 otherBranchSet/otherStemSet(일간 기반 신살용 제외 집합)을 빌려 써서
// 고전이 가장 중요하다고 하는 자리만 골라 못 보고 있었다.
// ──────────────────────────────────────────────────────────────
function gilsinOf(pillars: { y: string; m: string; d: string; h?: string }) {
  const stems = [pillars.y[0], pillars.m[0], pillars.d[0]];
  const branches = [pillars.y[1], pillars.m[1], pillars.d[1]];
  if (pillars.h) { stems.push(pillars.h[0]); branches.push(pillars.h[1]); }
  const r = findShinsal(
    pillars.d[1],           // 일지
    pillars.d[0],           // 일간
    pillars.m[1],           // 월지
    branches,
    !pillars.h,             // 시 미상
    stems,
  );
  return (r.matches ?? []).map((m) => m.label.replace(/\(.*\)/, ""));
}

test("천덕귀인 — 일지에 있어도 잡힌다", () => {
  // 인(寅)월의 천덕은 丁. 일주를 丁으로 두면 일간에서 잡혀야 한다.
  // 己卯 / 丙寅 / 丁巳 — 월지 寅 → 천덕 丁, 일간이 丁
  const g = gilsinOf({ y: "己卯", m: "丙寅", d: "丁巳" });
  assert.ok(g.includes("천덕귀인"), `일간 丁이 인월 천덕인데 못 잡았다: ${g.join(",")}`);
});

test("월덕귀인 — 일간에 있어도 잡힌다", () => {
  // 인오술 월의 월덕은 丙. 일간을 丙으로 둔다.
  // 甲子 / 庚午 / 丙申 — 월지 午(인오술) → 월덕 丙, 일간이 丙
  const g = gilsinOf({ y: "甲子", m: "庚午", d: "丙申" });
  assert.ok(g.includes("월덕귀인"), `일간 丙이 오월 월덕인데 못 잡았다: ${g.join(",")}`);
});

// ──────────────────────────────────────────────────────────────
// 4. 골든값 — 매거진 발행분과 제품이 갈리지 않게 고정
//    (2026-08-25 수정 시 본문을 이 값으로 교정했다)
// ──────────────────────────────────────────────────────────────
test("골든 — 박지훈(1999-05-29, 시 미상) = 중화신강", () => {
  // 己卯 / 己巳 / 辛巳. 득령 X(사화는 신금의 관성) · 득지 O(사화 중기 庚金에 통근) · 득세 O(기토 둘)
  const r = judgeStrength(
    "금",
    { 목: 1, 화: 2, 토: 2, 금: 1, 수: 0 },
    6,
    true,
    { dayStem: "辛", monthBranch: "巳", dayBranch: "巳", hourBranch: null,
      allStems: ["己", "己", "辛"], allBranches: ["卯", "巳", "巳"] } as never,
  );
  assert.equal(r.result, "중화신강");
  assert.equal(r.details.deukryeong, false, "월지 사화는 신금의 관성이라 부득령");
  assert.equal(r.details.deukji, true, "일지 사화 중기 庚金에 통근");
});

test("골든 — 전유진(2006-10-10, 시 미상) = 신약", () => {
  // 丙戌 / 戊戌 / 壬申. 득지만 O(신금 본기 = 임수의 인성)
  const r = judgeStrength(
    "수",
    { 목: 0, 화: 1, 토: 3, 금: 1, 수: 1 },
    6,
    true,
    { dayStem: "壬", monthBranch: "戌", dayBranch: "申", hourBranch: null,
      allStems: ["丙", "戊", "壬"], allBranches: ["戌", "戌", "申"] } as never,
  );
  assert.equal(r.result, "신약");
  assert.equal(r.details.deukji, true, "일지 신금 본기 庚金은 임수의 인성");
  assert.equal(r.details.deukse, false, "천간 병·무는 재성·관성");
});

// ──────────────────────────────────────────────────────────────
// 5. 기신(忌神) — 억부 매핑 (2026-08-26)
//
// 기존은 `findElementThatControls(용신)` = "용신을 극하는 오행"이었는데,
// 그건 자평이 아니라 육효(六爻)의 정의다("忌神: 克用神之爻就叫做忌神").
// 자평의 기신은 체·용을 손상하는 것이다 — 적천수 "忌神者, 損害體用之神也".
//
// 실제 폐해: 신강 분기의 용신 후보는 {관성·식상·재성}인데, 관성이 뽑히는 순간
// 방금까지 동급 후보였던 식상이 기신이 됐다(약을 병이라 부른 셈).
// 실사용자 3,272명 중 815명(24.9%)이 이 경우였고 변화는 전부 "식상 → 비겁" 단일.
// ──────────────────────────────────────────────────────────────
import { determineYongshin } from "./utils/saju-enrichment";

const GEN_EL: Record<string, string> = { 목:"화", 화:"토", 토:"금", 금:"수", 수:"목" };
const CTRL_EL: Record<string, string> = { 목:"토", 토:"수", 수:"화", 화:"금", 금:"목" };
const sipseong = (day: string, t: string) =>
  t === day ? "비겁"
  : GEN_EL[day] === t ? "식상"
  : CTRL_EL[day] === t ? "재성"
  : CTRL_EL[t] === day ? "관성" : "인성";

function yongshinOf(day: string, camp: "신강" | "신약") {
  const dist: Record<string, number> = { 목:1, 화:1, 토:1, 금:1, 수:1 };
  dist[day] = camp === "신강" ? 4 : 1;
  const st = { result: camp, helpCount: 0, resistCount: 0,
    details: { deukryeong:false, deukji:false, deuksi:false, deukse:false }, legacy: camp };
  return determineYongshin(day as never, st as never, dist as never, "午");
}

test("기신 — 진영 규칙: 신강이면 비겁·인성, 신약이면 식상·재성·관성", () => {
  for (const day of ["목","화","토","금","수"]) {
    for (const camp of ["신강","신약"] as const) {
      const y = yongshinOf(day, camp);
      const gi = sipseong(day, y.gisin);
      const allowed = camp === "신강" ? ["비겁","인성"] : ["식상","재성","관성"];
      assert.ok(allowed.includes(gi), `${day} ${camp}: 기신이 ${gi} — 진영 위반`);
    }
  }
});

test("기신 — 용신·희신과 겹치지 않는다", () => {
  for (const day of ["목","화","토","금","수"]) {
    for (const camp of ["신강","신약"] as const) {
      const y = yongshinOf(day, camp);
      assert.notEqual(y.gisin, y.eokbu, `${day} ${camp}: 기신 = 용신`);
      assert.notEqual(y.gisin, y.heesin, `${day} ${camp}: 기신 = 희신`);
    }
  }
});

test("기신 — 신강+관성 용신이면 비겁이다 (육효식 '식상'이 아니다)", () => {
  // 이 칸이 실사용자 815명(24.9%)이 걸리는 자리다. 옛 규칙은 식상을 냈다.
  for (const day of ["목","화","토","금","수"]) {
    const y = yongshinOf(day, "신강");
    assert.equal(sipseong(day, y.eokbu), "관성", `${day} 신강: 용신이 관성이어야 이 케이스`);
    assert.equal(sipseong(day, y.gisin), "비겁", `${day} 신강+관성: 기신은 비겁`);
  }
});

test("기신 — 신약+인성 용신이면 재성이다 (탐재괴인, 연해자평 '貪財壞印')", () => {
  for (const day of ["목","화","토","금","수"]) {
    const y = yongshinOf(day, "신약");
    assert.equal(sipseong(day, y.eokbu), "인성");
    assert.equal(sipseong(day, y.gisin), "재성");
  }
});

test("골든 — 운영자 사주(1995-06-21 16:30) 기신 = 수", () => {
  // 乙亥·壬午·癸未·庚申, 중화신강, 용신 토(관성).
  // 수3금2로 수가 왕한 원국이라 병은 비겁(수)이다.
  // 옛 값 목(식신)은 오히려 왕한 수를 설기하는 통로라 기신일 수 없었다.
  const dist = { 목:1, 화:1, 토:1, 금:2, 수:3 } as never;
  const st = { result: "중화신강", helpCount: 5, resistCount: 3,
    details: { deukryeong:false, deukji:false, deuksi:true, deukse:true }, legacy: "신강" } as never;
  const y = determineYongshin("수" as never, st, dist, "午");
  assert.equal(y.eokbu, "토", "억부 용신은 관성(토)");
  assert.equal(y.gisin, "수", "기신은 비겁(수) — 옛 규칙은 목을 냈다");
  assert.equal(y.heesin, "화", "희신은 재성(화)");
});
