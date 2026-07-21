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

// ── Fable 검수(2026-07-21) 실측 누출 문장 — 프롬프트는 금지했는데 가드가 못 잡던 것 ──
const LEAKED_PREDICTIONS = [
  "고생한 만큼 명예와 직함은 반드시 따라오는 결이야",
  "좋은 제안이 여기저기서 쏟아질 거야",
  "기회는 준비된 너를 절대 지나치지 않아",
  "네가 원하는 자리가 무조건 따라온다",
];

test("Fable 누출 성사보장 문장 전수 컷(FORBIDDEN 확장)", () => {
  for (const bad of LEAKED_PREDICTIONS) {
    const { violations } = applyCareerGuards({ timingFlow: `앞 문장 멀쩡. ${bad} 뒤 문장 멀쩡.` }, {}, "");
    assert.ok(violations.length > 0, `안 걸림: "${bad}"`);
  }
});

test("그릇 4상한 용어(관다신약 등) 본문 노출 → 중립 치환 + 위반", () => {
  const { blocks, violations } = applyCareerGuards(
    { careerGripDiagnosis: "이걸 명리에서는 관다신약이라고 부르는데, 페이스가 관건이야." },
    {}, "",
  );
  assert.ok(!blocks.careerGripDiagnosis.includes("관다신약"), "용어가 남아있음");
  assert.ok(violations.some((v) => v.includes("그릇용어")));
});

test("그릇 용어 비교 서열화(관다신약처럼 ~) → 용어 제거(재해석 문장은 보존)", () => {
  const { blocks } = applyCareerGuards(
    { workStyle: "관다신약처럼 자리에 치여 사는 게 아니라, 네가 판을 주도하는 결이야." },
    {}, "",
  );
  assert.ok(!blocks.workStyle.includes("관다신약"));
  assert.ok(blocks.workStyle.includes("네가 판을 주도하는"), "재해석 문장이 통째로 날아감");
});

test("teaser 등급 알파벳 노출(S등급 등) → 스크럽 + 위반", () => {
  const { blocks, violations } = applyCareerGuards(
    { teaserSummary: "S등급다운 탄탄한 에너지로 네 판을 어떻게 짜야 할지 알려줄게." },
    {}, "",
  );
  assert.ok(!/(SS|[SABCD])\s*등급/.test(blocks.teaserSummary), "등급 알파벳이 남아있음");
  assert.ok(violations.some((v) => v.includes("등급노출")));
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

test("정수 강도값 누출(힘도 5 정도로 / 강도 6) 스크럽 — 소수점만 잡던 갭 보강", () => {
  const r1 = applyCareerGuards({ gwanseongDiagnosis: "인성의 힘도 5 정도로 든든해서 자리를 지탱해." }, {}, "");
  assert.ok(!r1.blocks.gwanseongDiagnosis.includes("5 정도"), r1.blocks.gwanseongDiagnosis);
  const r2 = applyCareerGuards({ workStyle: "관성 강도 6인 편이라 뚜렷해." }, {}, "");
  assert.ok(!/강도\s*\d/.test(r2.blocks.workStyle), r2.blocks.workStyle);
});

test("연도·나이·개수는 스크럽 안 됨(강도 정수만 제거)", () => {
  const { blocks } = applyCareerGuards({ timingFlow: "2028년, 34세 무렵에 자리가 3번 열려." }, {}, "");
  assert.ok(blocks.timingFlow.includes("2028") && blocks.timingFlow.includes("34") && blocks.timingFlow.includes("3번"));
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
