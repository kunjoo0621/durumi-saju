/**
 * 희신 매핑 분기 수정 케이스 검증
 *
 * 5가지 (신강/약 × 5 용신) 케이스로 새 매핑이 의도대로 동작하는지 확인.
 * tsx scripts/heesin-case-check.mts
 */

const enrichModule = await import("../lib/utils/saju-enrichment");
const enrich: typeof import("../lib/utils/saju-enrichment") =
  ((enrichModule as any).default ?? enrichModule) as any;

type Case = {
  label: string;
  pillars: { year: string; month: string; day: string; hour: string };
  expectedStrength: "신강" | "신약" | "중화신강" | "중화신약";
  expectedYongCat: "관성" | "식상" | "재성" | "인성" | "비겁";
  expectedHeesin: "관성" | "식상" | "재성" | "인성" | "비겁";
};

function splitPillar(p: string) { return { stem: p[0]!, branch: p[1]! }; }

function build(pillars: Case["pillars"]) {
  const year = splitPillar(pillars.year);
  const month = splitPillar(pillars.month);
  const day = splitPillar(pillars.day);
  const hour = splitPillar(pillars.hour);
  const stems = [year.stem, month.stem, day.stem, hour.stem];
  const branches = [year.branch, month.branch, day.branch, hour.branch];
  const dayMaster = enrich.STEM_ELEMENT[day.stem]!;
  const elementDist = enrich.calculateElementDistribution(stems, branches);
  const strength = enrich.judgeStrength(
    dayMaster.element, elementDist, stems.length + branches.length, false,
    {
      monthBranch: month.branch, dayBranch: day.branch, hourBranch: hour.branch,
      allBranches: branches, allStems: stems, dayStem: day.stem,
    },
  );
  const yong = enrich.determineYongshin(dayMaster.element, strength, elementDist, month.branch);
  return { dayMaster, elementDist, strength, yong };
}

function catOf(dayEl: any, target: any): string {
  const gwansung = (Object.entries(enrich.CONTROLS) as any[]).find(([_, v]) => v === dayEl)![0];
  const siksang = enrich.GENERATES[dayEl];
  const jaesung = enrich.CONTROLS[dayEl];
  const insung = (Object.entries(enrich.GENERATES) as any[]).find(([_, v]) => v === dayEl)![0];
  if (target === gwansung) return "관성";
  if (target === siksang) return "식상";
  if (target === jaesung) return "재성";
  if (target === insung) return "인성";
  if (target === dayEl) return "비겁";
  return "?";
}

// Jay 케이스: 癸亥/壬戌/癸未/癸丑 — 신강+식상 용신
// 본인(신건주): 庚申/壬午/癸未/庚申 같은 형태가 아니라 실제는 시주 다름. 일단 신강+관성 시뮬 케이스
const cases: Case[] = [
  {
    label: "Jay (신강+식상목 용신)",
    pillars: { year: "癸亥", month: "壬戌", day: "癸未", hour: "癸丑" },
    expectedStrength: "신강", expectedYongCat: "식상", expectedHeesin: "재성",
  },
  {
    label: "신강+관성 시뮬 (목 강, 관성 금)",
    pillars: { year: "甲寅", month: "乙卯", day: "甲寅", hour: "乙亥" },
    expectedStrength: "신강", expectedYongCat: "관성", expectedHeesin: "재성",
  },
  {
    label: "신강+재성 시뮬 (수 강, 재성 화)",
    pillars: { year: "壬子", month: "癸亥", day: "壬子", hour: "癸亥" },
    expectedStrength: "신강", expectedYongCat: "재성", expectedHeesin: "식상",
  },
  {
    label: "신약+인성 시뮬 (목 약, 인성 수)",
    pillars: { year: "戊午", month: "己未", day: "乙巳", hour: "戊寅" },
    expectedStrength: "신약", expectedYongCat: "인성", expectedHeesin: "관성",
  },
  {
    label: "신약+비겁 시뮬 (목 약, 비겁 목)",
    pillars: { year: "戊戌", month: "庚申", day: "甲申", hour: "辛未" },
    expectedStrength: "신약", expectedYongCat: "비겁", expectedHeesin: "인성",
  },
];

console.log("희신 매핑 케이스 검증\n");
console.log("| 케이스 | 일간 | 신강/약 | 용신 | 용신 분류 | 희신 | 희신 분류 | 기대 | 결과 |");
console.log("|---|---|---|---|---|---|---|---|---|");

for (const c of cases) {
  const { dayMaster, strength, yong } = build(c.pillars);
  const yongCat = catOf(dayMaster.element, yong.eokbu);
  const heesinCat = catOf(dayMaster.element, yong.heesin);
  const ok = heesinCat === c.expectedHeesin ? "✓" : "✗";
  console.log(
    `| ${c.label} | ${dayMaster.element}(${dayMaster.korean}) | ${strength.result} | ${yong.eokbu} | ${yongCat} | ${yong.heesin} | ${heesinCat} | ${c.expectedHeesin} | ${ok} |`
  );
}
