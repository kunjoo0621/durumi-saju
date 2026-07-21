import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCareerGuards, validateCareerBlocks, validateCareerRichness } from "./career-postprocess";
import { buildCareerPrompt } from "./career-prompt";

// ── 프롬프트가 명시적으로 금지한 예시 문장 전수 — 정규식이 실제로 잡는지 (1b2bef5 선반영:
//    "프롬프트는 금지했는데 후처리 정규식은 통과"가 재물운 실제 갭이었다) ──
const FORBIDDEN_EXAMPLES = [
  "너는 승진 못할 팔자야",
  "이 사주는 조직생활 못 한다",
  "딱 백수 사주네",
  "사업하면 망한다",
  "리더는 못 된다",
  "윗사람과 부딪혀 결국 잘린다",
  "그 시기엔 해고당할 수 있어",
  "너는 조직에 못 붙어 있는다",
  "이 자리 맡으면 번아웃 온다",
  "2027년에 반드시 승진한다",
  "이 시기에 이직하면 무조건 잘 된다",
  "그 해엔 분명 잘린다",
  "그 시기는 무조건 피해라",
  "지금 회사 그만둬라",
  "당장 창업해라",
  "무조건 이직해라",
  "좌천될 운이야",
  "직장운이 아예 없는 사주야",
];

test("금지 예시 전수: applyCareerGuards가 문장 단위로 전부 컷한다", () => {
  for (const bad of FORBIDDEN_EXAMPLES) {
    const { blocks, violations } = applyCareerGuards(
      { workStyle: `앞 문장은 멀쩡해. ${bad} 뒤 문장도 멀쩡해.` },
      {},
      "",
    );
    assert.ok(
      !blocks.workStyle.includes(bad.replace(/야$|네$|다$/, "")) || violations.length > 0,
      `금지 예시가 안 걸림: "${bad}"`,
    );
    assert.ok(violations.length > 0, `위반 미기록: "${bad}"`);
  }
});

test("금지 예시가 advice에 있으면 항목 통째로 삭제", () => {
  const { blocks } = applyCareerGuards(
    { advice: [{ text: "2027년에 반드시 승진한다", tag: "[근거:정관]" }, { text: "자격증을 미리 챙겨두면 좋아", tag: "[근거:관인상생]" }] },
    {},
    "",
  );
  assert.equal(blocks.advice.length, 1);
  assert.ok(blocks.advice[0].text.includes("자격증"));
});

test("오탐 방지: 실행 단정의 부정형(안심 문장)은 보존", () => {
  const keep = [
    "지금 회사 그만두라는 뜻이 아니야",
    "당장 그만두지 마",
    "무조건 이직하란 말은 아니야",
    "서두르지 마",
  ];
  for (const s of keep) {
    const { blocks } = applyCareerGuards({ riskAndPace: `${s} 조건부터 차분히 봐.` }, {}, "");
    assert.ok(blocks.riskAndPace.includes(s.slice(0, 6)), `부정형이 잘못 삭제됨: "${s}"`);
  }
});

test("근거 태그 없는 advice 항목은 삭제", () => {
  const { blocks } = applyCareerGuards(
    { advice: [{ text: "자리에서 신뢰를 쌓아", tag: "" }, { text: "문서로 남기는 습관을 들여", tag: "[근거:상관견관]" }] },
    {},
    "",
  );
  assert.equal(blocks.advice.length, 1);
});

test("금지 신살(괴강·백호·양인·장성·학당) 스크럽 + 위반 기록", () => {
  const { blocks, violations } = applyCareerGuards(
    { gwanseongDiagnosis: "괴강살이라 리더십이 강하고 장성살이 대장 기질을 줘." },
    {},
    "",
  );
  assert.ok(!blocks.gwanseongDiagnosis.includes("괴강살"));
  assert.ok(!blocks.gwanseongDiagnosis.includes("장성살"));
  assert.ok(violations.some((v) => v.includes("금지신살")));
});

test("한자 병기 스크럽(순수 한글 원칙)", () => {
  const { blocks } = applyCareerGuards({ careerGripDiagnosis: "정관(正官)이 자리를 잡았어." }, {}, "");
  assert.ok(!/[㐀-鿿]/.test(blocks.careerGripDiagnosis));
  assert.ok(blocks.careerGripDiagnosis.includes("정관"));
});

test("소수점 강도값 누출 스크럽", () => {
  const { blocks } = applyCareerGuards({ workStyle: "관성이 6.5로 뚜렷하게 강해." }, {}, "");
  assert.ok(!/\d+\.\d+/.test(blocks.workStyle));
});

test("validateCareerBlocks: gradeHeadline은 minLen 8 (80자 복사 함정 방지)", () => {
  const ok = {
    teaserSummary: "조직에서 오래 갈 결이야",
    gradeHeadline: "관성이 또렷한 조직형이야", // 13자 — 8 통과, 80이면 반려됨
    gwanseongDiagnosis: "가".repeat(80),
    careerGripDiagnosis: "가".repeat(80),
    workStyle: "가".repeat(80),
    riskAndPace: "가".repeat(80),
    timingFlow: "가".repeat(80),
    yearlyCta: "가".repeat(30),
    advice: [{ text: "자격증을 미리 챙겨두면 힘이 돼", tag: "[근거:관인상생]" }, { text: "반박은 제안으로 바꿔서 남겨둬", tag: "[근거:상관견관]" }],
  };
  assert.deepEqual(validateCareerBlocks(ok), []);
  // 짧은 헤드라인(8자 미만)은 반려
  assert.ok(validateCareerBlocks({ ...ok, gradeHeadline: "짧아" }).some((i) => i.includes("gradeHeadline")));
});

test("validateCareerRichness: 5블록 총량 부족이면 재생성 안내", () => {
  const thin = { gwanseongDiagnosis: "짧아", careerGripDiagnosis: "짧아", workStyle: "짧아", riskAndPace: "짧아", timingFlow: "짧아" };
  assert.ok(validateCareerRichness(thin).length > 0);
  const rich: any = {};
  for (const k of ["gwanseongDiagnosis", "careerGripDiagnosis", "workStyle", "riskAndPace", "timingFlow"]) rich[k] = "가".repeat(400);
  assert.deepEqual(validateCareerRichness(rich), []);
});

// ── 3-layer 정합: 프롬프트의 "좋은 문장 예시"가 이 가드에 안 걸려야 한다 ──
test("3-layer: 프롬프트 좋은 문장 예시가 가드 금지 패턴에 안 걸린다", () => {
  const baseFacts: any = {
    situation: "현직 성장", dayStem: "甲",
    gwanseong: [{ pillar: "month", source: "천간", star: "정관" }],
    gwanseongType: "정관우세", gwanseongAbsent: false, gwanseongStrength: 5,
    siksinStrength: 2, sanggwanStrength: 0, siksangType: "식신우세",
    inseongStrength: 5, inseongAbsent: false, strengthLevel: "신강",
    careerGrip: "신왕관쇠", gwandaSinyak: false, gwaninSangsaeng: true,
    sanggwanGyeongwan: false, yongshinFavorsCareer: true, timingWindows: [], daeunCareerYears: [],
  };
  const p = buildCareerPrompt(baseFacts, "A", "사주텍스트");
  const m = p.match(/\[좋은 문장 예시[^\]]*\]([\s\S]*?)────/);
  assert.ok(m, "좋은 문장 예시 블록 없음");
  const { violations } = applyCareerGuards({ probe: m![1] }, {}, "");
  assert.equal(violations.length, 0, `좋은 예시가 가드에 걸림: ${violations.join(" | ")}`);
});
