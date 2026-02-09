const enrichModule = await import("../lib/utils/saju-enrichment");
const enrich: typeof import("../lib/utils/saju-enrichment") =
  ((enrichModule as any).default ?? enrichModule) as any;

type Pillars = {
  year: string; // "甲子"
  month: string;
  day: string;
  hour: string | null;
};

type Case = { label: string; pillars: Pillars; isTimeUnknown: boolean };

const cases: Case[] = [
  {
    label: "case1-spec-sample",
    pillars: { year: "甲子", month: "乙丑", day: "丙寅", hour: "丁卯" },
    isTimeUnknown: false,
  },
  {
    label: "case2-varied",
    pillars: { year: "庚申", month: "壬子", day: "乙酉", hour: "戊午" },
    isTimeUnknown: false,
  },
  {
    label: "case3-unknown-time",
    pillars: { year: "癸亥", month: "辛酉", day: "甲子", hour: null },
    isTimeUnknown: true,
  },
];

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

function splitPillar(p: string) {
  return { stem: p[0]!, branch: p[1]! };
}

function formatPillar(p: string) {
  const { stem, branch } = splitPillar(p);
  const stemK = enrich.STEM_ELEMENT[stem]?.korean ?? "";
  const branchK = enrich.BRANCH_INFO[branch]?.korean ?? "";
  return `${stem}${branch}(${stemK}${branchK})`;
}

function parseElementSum(text: string) {
  const line = text.split("\n").find((l) => l.startsWith("오행분포:"));
  if (!line) throw new Error("missing element distribution line");
  const re = /([목화토금수])\((\d+)\)/g;
  let m: RegExpExecArray | null;
  let sum = 0;
  while ((m = re.exec(line))) sum += Number(m[2] || 0);
  return { line, sum };
}

for (const c of cases) {
  const year = splitPillar(c.pillars.year);
  const month = splitPillar(c.pillars.month);
  const day = splitPillar(c.pillars.day);

  const stems = [year.stem, month.stem, day.stem];
  const branches = [year.branch, month.branch, day.branch];

  let hourPillarText: string | null = null;
  if (!c.isTimeUnknown && c.pillars.hour) {
    const hour = splitPillar(c.pillars.hour);
    stems.push(hour.stem);
    branches.push(hour.branch);
    hourPillarText = formatPillar(c.pillars.hour);
  }

  const dayMaster = enrich.STEM_ELEMENT[day.stem]!;
  const elementDist = enrich.calculateElementDistribution(stems, branches);
  const elementAnalysis = enrich.analyzeElementBalance(elementDist);
  const strength = enrich.judgeStrength(
    dayMaster.element,
    elementDist,
    stems.length + branches.length,
    c.isTimeUnknown
  );
  const tenStars = enrich.calculateTenStars(stems, branches);
  const relationships = enrich.findRelationships(branches);
  const shinsal = enrich.findShinsal(day.branch, day.stem, branches);

  const enriched: enrich.EnrichedSajuData = {
    pillars: {
      year: formatPillar(c.pillars.year),
      month: formatPillar(c.pillars.month),
      day: formatPillar(c.pillars.day),
      hour: c.isTimeUnknown ? null : hourPillarText,
    },
    dayMaster: {
      stem: day.stem,
      element: dayMaster.element,
      yinYang: dayMaster.yin_yang,
      korean: dayMaster.korean,
    },
    elementDist,
    elementAnalysis,
    strength,
    tenStars,
    relationships,
    shinsal,
    isTimeUnknown: c.isTimeUnknown,
  };

  const text = enrich.formatEnrichedSajuText(enriched);
  console.log(`\\n===== ${c.label} =====\\n${text}\\n`);

  const lines = text.split("\n");
  assert(lines.length === 7, `${c.label}: expected 7 lines, got ${lines.length}`);
  assert(lines[0].startsWith("년주:"), `${c.label}: line1 must start with 년주:`);
  assert(lines[1].startsWith("일간:"), `${c.label}: line2 must start with 일간:`);
  assert(lines[2].startsWith("오행분포:"), `${c.label}: line3 must start with 오행분포:`);
  assert(lines[3].startsWith("신강/신약:"), `${c.label}: line4 must start with 신강/신약:`);
  assert(lines[4].startsWith("십성:"), `${c.label}: line5 must start with 십성:`);
  assert(lines[5].startsWith("합충형:"), `${c.label}: line6 must start with 합충형:`);
  assert(lines[6].startsWith("신살:"), `${c.label}: line7 must start with 신살:`);

  const { sum } = parseElementSum(text);
  const expectedSum = c.isTimeUnknown ? 6 : 8;
  assert(sum === expectedSum, `${c.label}: expected element sum ${expectedSum}, got ${sum}`);

  if (c.isTimeUnknown) {
    assert(text.includes("시주: 미상"), `${c.label}: must show '시주: 미상'`);
    assert(text.includes("시주 미상"), `${c.label}: must include '(시주 미상...)' note`);
  } else {
    assert(!text.includes("시주: 미상"), `${c.label}: must not show '시주: 미상' when time known`);
  }
}

console.log("\\nAll saju enrichment checks passed.");
