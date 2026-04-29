/**
 * 묘(墓) 후처리 단위 테스트 — mock 데이터로 검증
 */
const { postprocessBattleResult } = require("../lib/battle-postprocess");

// 묘(墓) 패턴이 다양하게 포함된 mock 데이터 (총 20+ 묘)
const mock: any = {
  heroQuip: "신건주 묘(墓)에 앉은 일주라 감정을 속으로 삭여",
  categoryResults: {
    wealth: {
      killingLine: "김채현이 돈을 굴리는 동안 신건주는 묘(墓) 속 감정에 잠겨 있어",
      detail: "일주 계미(癸未)가 묘(墓)에 앉아 있어 재물에 대한 욕심이 묻혀 있어. 12운성 묘의 영향으로 돈을 숨기려는 경향이 강해.",
      winner: "B", diff: 8, intensity: "확실한", basis: "편재+겁재"
    },
    love: {
      killingLine: "묘(墓)에 앉아 있어서 감정 표현이 서투른 편",
      detail: "정우진의 기묘년 출생으로 목 기운이 강한데, 묘지 성향 때문에 연애에서도 감정을 삭여. 을묘 일주인 임하늘은 건록이라 당당해.",
      winner: "A", diff: 3, intensity: "미세한", basis: "정관"
    },
    career: {
      killingLine: "편관 대운이 압박하는 시기",
      detail: "대운 묘 시기에 직장 스트레스가 극대화돼. 운성 묘( 해당) 기간이라 참고 견디는 게 핵심이야.",
      winner: "B", diff: 5, intensity: "미세한", basis: "편관+정인"
    },
    health: {
      killingLine: "墓(묘)지에 앉아 체력이 떨어져",
      detail: "일주 묘에 앉아 있으니 기력이 약해지기 쉬워. 묘(墓) 속 섭섭함이 건강에도 영향을 줘.",
      winner: "draw", diff: 0, intensity: "초접전", basis: "오행균형"
    },
    social: {
      killingLine: "묘(墓)의 에너지가 대인관계를 위축시켜",
      detail: "12운성 묘 자리에 앉아 있어서 사람들 앞에서 위축되기 쉬워.",
      winner: "A", diff: 4, intensity: "미세한", basis: "비견"
    }
  },
  chemistry: {
    label: { emoji: "🪞", title: "거울 보는 느낌", description: "닮아서 편한데, 닮아서 지루해" },
    punchline: "둘 다 묘(墓) 기운이 있어서 말없이 앉아 있으면 장례식장 분위기",
    analysis: "정우진은 묘(墓)에 앉은 일주라 감정을 속으로 삭이고, 김채현도 비슷한 패턴이야.",
    mainScenario: { analysis: "연인으로서 묘(墓)의 기운이 감정 교류를 막아." },
    bonusScenarios: [
      { type: "friend", label: "친구였다면", punchline: "묘(墓) 친구", analysis: "서로 묘(墓) 앉은 사이라 조용히 옆에 앉아 있는 게 편안해." },
      { type: "colleague", label: "동료였다면", punchline: "업무 파트너", analysis: "묘지에 앉아 있는 듯한 분위기지만 의외로 꼼꼼해." }
    ]
  },
  simulations: [
    { question: "싸우면?", icon: "😡", punchline: "정우진이 3일 참다가 터져", reasoning: "묘(墓)에 앉은 일주라 감정을 삭이다가 폭발해.", subject: "A", subjectLabel: "정우진" },
    { question: "여행?", icon: "✈️", punchline: "김채현이 계획표 짜", reasoning: "묘(墓) 기운이 있는 정우진은 계획보다 즉흥 선호.", subject: "B", subjectLabel: "김채현" },
  ],
  futureOutlook: {
    punchline: "2026 김채현이 앞서가지만 2030엔 신건주가 뒤집어",
    timeline: [
      { year: 2027, eventA: "묘(墓)의 영향으로 내면 성장기", eventB: "커리어 도약", relationship: "관계에 거리감", mood: "down" as const },
      { year: 2029, eventA: "안정기 진입", eventB: "묘(墓) 대운 진입으로 조용해져", relationship: "입장 역전", mood: "neutral" as const },
      { year: 2031, eventA: "성과 폭발", eventB: "조용히 내면 정리", relationship: "재결합 가능", mood: "up" as const },
    ]
  },
  finalVerdict: {
    punchline: "묘(墓)에 앉은 둘이라 느리지만 깊은 관계",
    verdict: "정우진은 묘(墓)에 앉아 감정을 숨기고, 김채현은 겉으로 드러내. 묘(墓) 기운 때문에 시간이 걸리지만 결국 통하는 사이야.",
    overallWinner: "B",
    overallIntensity: "확실한"
  }
};

// Before 카운트
const allBefore = JSON.stringify(mock);
const myoBeforeTotal = (allBefore.match(/묘/g) || []).length;
const myo墓Regex = /묘\s*\(墓\)|12운성\s*묘|일주\s*묘|묘\s*지에?\s*앉|대운\s*\(?\s*묘|묘\s*\(墓\)\s*지|운성\s*묘\s*\(|묘지\s*성향|묘\(墓\)/g;
const myo墓Before = (allBefore.match(myo墓Regex) || []).length;
const maoRegex = /기묘|을묘|정묘|묘\s*\(卯\)|卯\s*\(묘\)/g;
const maoBefore = (allBefore.match(maoRegex) || []).length;

console.log("═══════════════════════════════════════════════");
console.log("  묘(墓) 후처리 단위 테스트 (mock 데이터)");
console.log("═══════════════════════════════════════════════\n");
console.log(`BEFORE: "묘" 총 ${myoBeforeTotal}회 (墓 패턴 ${myo墓Before}회, 卯 패턴 ${maoBefore}회)\n`);

// 후처리 실행
const { result, warnings } = postprocessBattleResult(mock, undefined, { nameA: "정우진", nameB: "김채현" });

// After 카운트
const allAfter = JSON.stringify(result);
const myoAfterTotal = (allAfter.match(/묘/g) || []).length;
const myo墓After = (allAfter.match(new RegExp(myo墓Regex.source, "g")) || []).length;
const maoAfter = (allAfter.match(new RegExp(maoRegex.source, "g")) || []).length;

console.log(`AFTER:  "묘" 총 ${myoAfterTotal}회 (墓 패턴 ${myo墓After}회, 卯 패턴 ${maoAfter}회)`);
console.log(`제거: ${myoBeforeTotal - myoAfterTotal}회\n`);

// 1) [FIX] 묘(墓) 반복 제한 로그
const myoWarnings = warnings.filter((w: string) => w.includes("묘"));
console.log(`━━━ 1) 묘 관련 [FIX] 경고 (${myoWarnings.length}개) ━━━`);
for (const w of myoWarnings) console.log(`  ${w}`);

// 2) 최종 "묘" 총 등장
console.log(`\n━━━ 2) 최종 "묘" 총 등장: ${myoAfterTotal}회 ━━━`);

// 3) 卯(지지) 보호 검증
console.log(`\n━━━ 3) 卯(지지) 보호 ━━━`);
console.log(`  BEFORE: ${maoBefore}개 → AFTER: ${maoAfter}개`);
if (maoBefore === maoAfter) console.log("  ✅ 卯 보호 정상 — 지지 묘 변동 없음");
else console.log("  ❌ 卯 변동 발생!");

// 기묘, 을묘 구체적 확인
const kiMyoBefore = (allBefore.match(/기묘/g) || []).length;
const kiMyoAfter = (allAfter.match(/기묘/g) || []).length;
const eulMyoBefore = (allBefore.match(/을묘/g) || []).length;
const eulMyoAfter = (allAfter.match(/을묘/g) || []).length;
console.log(`  기묘: ${kiMyoBefore} → ${kiMyoAfter} ${kiMyoBefore === kiMyoAfter ? "✅" : "❌"}`);
console.log(`  을묘: ${eulMyoBefore} → ${eulMyoAfter} ${eulMyoBefore === eulMyoAfter ? "✅" : "❌"}`);

// 4) 변경된 필드 비교 (before → after)
console.log(`\n━━━ 4) 제거/치환된 필드 상세 ━━━`);

type FieldCheck = { label: string; before: string; after: string };
const checks: FieldCheck[] = [
  { label: "heroQuip", before: mock.heroQuip, after: "N/A" }, // mock is mutated, need pre-save
  { label: "wealth.killingLine", before: "김채현이 돈을 굴리는 동안 신건주는 묘(墓) 속 감정에 잠겨 있어", after: result.categoryResults.wealth.killingLine },
  { label: "wealth.detail", before: "일주 계미(癸未)가 묘(墓)에 앉아 있어 재물에 대한 욕심이 묻혀 있어. 12운성 묘의 영향으로 돈을 숨기려는 경향이 강해.", after: result.categoryResults.wealth.detail },
  { label: "love.killingLine", before: "묘(墓)에 앉아 있어서 감정 표현이 서투른 편", after: result.categoryResults.love.killingLine },
  { label: "love.detail", before: "정우진의 기묘년 출생으로 목 기운이 강한데, 묘지 성향 때문에 연애에서도 감정을 삭여. 을묘 일주인 임하늘은 건록이라 당당해.", after: result.categoryResults.love.detail },
  { label: "career.detail", before: "대운 묘 시기에 직장 스트레스가 극대화돼. 운성 묘( 해당) 기간이라 참고 견디는 게 핵심이야.", after: result.categoryResults.career.detail },
  { label: "health.killingLine", before: "墓(묘)지에 앉아 체력이 떨어져", after: result.categoryResults.health.killingLine },
  { label: "health.detail", before: "일주 묘에 앉아 있으니 기력이 약해지기 쉬워. 묘(墓) 속 섭섭함이 건강에도 영향을 줘.", after: result.categoryResults.health.detail },
  { label: "social.killingLine", before: "묘(墓)의 에너지가 대인관계를 위축시켜", after: result.categoryResults.social.killingLine },
  { label: "social.detail", before: "12운성 묘 자리에 앉아 있어서 사람들 앞에서 위축되기 쉬워.", after: result.categoryResults.social.detail },
  { label: "chemistry.punchline", before: "둘 다 묘(墓) 기운이 있어서 말없이 앉아 있으면 장례식장 분위기", after: result.chemistry.punchline },
  { label: "sim[0].reasoning", before: "묘(墓)에 앉은 일주라 감정을 삭이다가 폭발해.", after: result.simulations[0].reasoning },
  { label: "finalVerdict.verdict", before: "정우진은 묘(墓)에 앉아 감정을 숨기고, 김채현은 겉으로 드러내. 묘(墓) 기운 때문에 시간이 걸리지만 결국 통하는 사이야.", after: result.finalVerdict.verdict },
];

for (const c of checks) {
  if (c.before !== c.after) {
    console.log(`\n  [${c.label}]`);
    console.log(`    BEFORE: "${c.before}"`);
    console.log(`    AFTER:  "${c.after}"`);
    const broken = /^\s*[은는이가을를에서의도로]\s/.test(c.after) || /,\s*,|,\s*\./.test(c.after);
    console.log(`    문맥: ${broken ? "⚠️ 의심" : "✅ 자연스러움"}`);
  }
}
