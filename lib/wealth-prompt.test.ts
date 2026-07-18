import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWealthPrompt, formatJaeseongGungwi } from "./wealth-prompt";
import { applyWealthGuards } from "./wealth-postprocess";

const baseFacts: any = {
  interest: "목돈·노후 준비",
  dayStem: "甲",
  jaeseong: [
    { pillar: "month", source: "천간", star: "편재" },
    { pillar: "hour", source: "지장간", star: "정재" },
  ],
  jaeseongType: "재성혼재",
  jaeseongAbsent: false,
  jaeseongStrength: 6,
  bigeopStrength: 2,
  strengthLevel: "신강",
  jaeGrip: "신왕재왕",
  jaedaShinyak: false,
  sikssangSaengjae: true,
  gunggeobJaengjae: false,
  bigeopTaljae: false,
  jaego: false,
  yongshinFavorsWealth: true,
  timingWindows: [],
  daeunWealthYears: [],
};

test("궁위 해석: 재성 위치별 인생 국면이 결정론으로 붙는다", () => {
  const s = formatJaeseongGungwi(baseFacts);
  assert.ok(s.includes("월주"));
  assert.ok(s.includes("사회활동기"));
  assert.ok(s.includes("시주"));
  assert.ok(s.includes("말년"));
});

test("무재면 궁위 해석은 '해당 없음'", () => {
  const s = formatJaeseongGungwi({ ...baseFacts, jaeseong: [], jaeseongAbsent: true });
  assert.ok(s.includes("해당 없음"));
});

test("프롬프트에 궁위 라인과 긍정 예시 블록이 포함된다", () => {
  const p = buildWealthPrompt(baseFacts, "A", "사주텍스트");
  assert.ok(p.includes("재성 궁위 해석"));
  assert.ok(p.includes("[좋은 문장 예시"));
});

test("긍정 예시 문장이 가드 금지 패턴에 안 걸린다(3-layer 정합)", () => {
  const p = buildWealthPrompt(baseFacts, "A", "사주텍스트");
  const m = p.match(/\[좋은 문장 예시[^\]]*\]([\s\S]*?)────/);
  assert.ok(m, "긍정 예시 블록 없음");
  const { violations } = applyWealthGuards({ probe: m![1] }, {}, "");
  assert.equal(violations.length, 0);
});
