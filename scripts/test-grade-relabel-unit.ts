/**
 * displayGrade + transformGradeText 단위 검증
 * - 일반 케이스, 경계 케이스, 오변환 위험 케이스
 */
import { displayGrade, transformGradeText, transformGradesDeep } from "../lib/gradeSystem";

let pass = 0;
let fail = 0;

function eq<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) {
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
    fail++;
  } else {
    pass++;
  }
}

console.log("\n## displayGrade");
eq("S→SS", displayGrade("S"), "SS");
eq("A→S", displayGrade("A"), "S");
eq("B→A", displayGrade("B"), "A");
eq("C→B", displayGrade("C"), "B");
eq("D→C", displayGrade("D"), "C");

console.log("\n## transformGradeText — 단순 케이스");
eq("S등급", transformGradeText("S등급"), "SS등급");
eq("A등급", transformGradeText("A등급"), "S등급");
eq("B등급", transformGradeText("B등급"), "A등급");
eq("C등급", transformGradeText("C등급"), "B등급");
eq("D등급", transformGradeText("D등급"), "C등급");

console.log("\n## transformGradeText — 본문 안 등급 표기");
eq(
  "재물운 B등급",
  transformGradeText("재물운 점수가 74점으로 B등급인데"),
  "재물운 점수가 74점으로 A등급인데"
);
eq(
  "여러 등급 한 문장",
  transformGradeText("연애운이 C등급에 머무는 건 네 날카로운 성격이"),
  "연애운이 B등급에 머무는 건 네 날카로운 성격이"
);
eq(
  "S/D 동시",
  transformGradeText("S등급은 흔치 않고, D등급도 드물어"),
  "SS등급은 흔치 않고, C등급도 드물어"
);

console.log("\n## transformGradeText — 이중 변환 방지");
eq("S등급 → SS등급 (한 번만)", transformGradeText("S등급"), "SS등급");
eq("연쇄 변환 안 됨", transformGradeText("B등급 A등급"), "A등급 S등급");

console.log("\n## transformGradeText — 오변환 위험 케이스");
eq("Class A — suffix 없음 그대로", transformGradeText("Class A를 선택"), "Class A를 선택");
eq("ABCDEF — 영문 단어 그대로", transformGradeText("ABCDEF"), "ABCDEF");
eq("긴급 — 한글 단어 그대로", transformGradeText("긴급 상황입니다"), "긴급 상황입니다");
eq("S급식 — 단어 일부, 변환 안 됨", transformGradeText("S급식이 좋네"), "S급식이 좋네");
eq("B에서 머물지 A로 — 단독 등급 그대로(한계)", transformGradeText("B에서 머물지 A로"), "B에서 머물지 A로");
eq("빈 문자열", transformGradeText(""), "");

console.log("\n## transformGradeText — 역순 '등급 X' 패턴 (tier.description 류)");
eq("종합등급 S, 상위", transformGradeText("종합등급 S, 상위 4%의"), "종합등급 SS, 상위 4%의");
eq("종합등급 S라는 건", transformGradeText("종합등급 S라는 건"), "종합등급 SS라는 건");
eq("등급 D 다음 줄바꿈", transformGradeText("최저 등급 D\n다음"), "최저 등급 C\n다음");
eq("등급 Sky — 변환 안 됨", transformGradeText("등급 Sky"), "등급 Sky");
eq("등급 S1 — 변환 안 됨", transformGradeText("등급 S1"), "등급 S1");
eq("등급이 A인 건", transformGradeText("재물운 등급이 A인 건"), "재물운 등급이 S인 건");
eq("등급은 B로", transformGradeText("연애 등급은 B로 떨어졌어"), "연애 등급은 A로 떨어졌어");
eq("등급의 D는", transformGradeText("최저 등급의 D는 드물어"), "최저 등급의 C는 드물어");

console.log("\n## transformGradesDeep — JSON 구조 재귀");
const input = {
  tier: { grade: "B", description: "재물운 B등급으로", title: "엔진 좋은 사주" },
  sections: ["연애운 C등급은", "직장운 A등급이라"],
  composite: 70,
  nested: { deep: { msg: "S등급 도달" } },
};
const expected = {
  tier: { grade: "B", description: "재물운 A등급으로", title: "엔진 좋은 사주" },
  sections: ["연애운 B등급은", "직장운 S등급이라"],
  composite: 70,
  nested: { deep: { msg: "SS등급 도달" } },
};
eq("deep transform", transformGradesDeep(input), expected);

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
