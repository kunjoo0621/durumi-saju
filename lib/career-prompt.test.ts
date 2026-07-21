import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCareerPrompt,
  formatGwanseongGungwi,
  detectSituationStructureGap,
  careerGripPlain,
} from "./career-prompt";

const baseFacts: any = {
  situation: "현직 성장",
  dayStem: "甲",
  gwanseong: [
    { pillar: "month", source: "천간", star: "정관" },
    { pillar: "hour", source: "지장간", star: "편관" },
  ],
  gwanseongType: "관살혼잡",
  gwanseongAbsent: false,
  gwanseongStrength: 6,
  siksinStrength: 2,
  sanggwanStrength: 0,
  siksangType: "식신우세",
  inseongStrength: 5,
  inseongAbsent: false,
  strengthLevel: "신강",
  careerGrip: "신왕관왕",
  gwandaSinyak: false,
  gwaninSangsaeng: true,
  sanggwanGyeongwan: false,
  yongshinFavorsCareer: true,
  timingWindows: [],
  daeunCareerYears: [],
};

test("궁위 해석: 관성 위치별 인생 국면이 결정론으로 붙는다", () => {
  const s = formatGwanseongGungwi(baseFacts);
  assert.ok(s.includes("월주"));
  assert.ok(s.includes("사회활동기"));
  assert.ok(s.includes("시주"));
  assert.ok(s.includes("말년"));
});

test("무관이면 궁위 해석은 '해당 없음'", () => {
  const s = formatGwanseongGungwi({ ...baseFacts, gwanseong: [], gwanseongAbsent: true });
  assert.ok(s.includes("해당 없음"));
});

test("프롬프트에 관성 궁위 라인과 좋은 문장 예시 블록이 포함된다", () => {
  const p = buildCareerPrompt(baseFacts, "A", "사주텍스트");
  assert.ok(p.includes("관성 궁위 해석"));
  assert.ok(p.includes("[좋은 문장 예시"));
});

test("그릇 용어명 노출 방지: factBlock은 careerGripPlain(뜻)으로 렌더", () => {
  // careerGripPlain은 용어명 없이 뜻만 반환
  assert.ok(!careerGripPlain("신왕관왕").includes("신왕관왕"));
  // 프롬프트의 그릇 라인에 뜻풀이가 들어간다
  const p = buildCareerPrompt(baseFacts, "A", "사주텍스트");
  assert.ok(p.includes(careerGripPlain("신왕관왕")));
});

test("CURRENT_YEAR 치환: 플레이스홀더 잔존 없음, 실제 연도 삽입", () => {
  const p = buildCareerPrompt(baseFacts, "A", "사주텍스트", undefined, 2026);
  assert.ok(!p.includes("{{CURRENT_YEAR}}"));
  assert.ok(!p.includes("{{PREV_YEAR}}"));
  assert.ok(p.includes("2026"));
});

test("간극 감지: 현직 성장 × 상관견관 → 승진 저항 신호 간극", () => {
  const s = detectSituationStructureGap({
    ...baseFacts,
    situation: "현직 성장",
    sanggwanGyeongwan: true,
  });
  assert.notEqual(s, "");
  assert.ok(!s.includes("없음"));
});

test("간극 감지: 독립·사업 × 무식상 → 조직·체계형 간극", () => {
  const s = detectSituationStructureGap({
    ...baseFacts,
    situation: "독립·사업",
    siksangType: "무식상",
    siksinStrength: 0,
    sanggwanStrength: 0,
  });
  assert.notEqual(s, "");
  assert.ok(!s.includes("없음"));
});

test("간극 감지: 어긋남 없으면 '없음' 반환(억지 간극 금지)", () => {
  const s = detectSituationStructureGap({
    ...baseFacts,
    situation: "현직 성장",
    gwanseongType: "정관우세",
    sanggwanGyeongwan: false,
    gwanseongAbsent: false,
  });
  assert.ok(s.includes("없음"));
});
