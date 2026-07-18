import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWithQaRegen } from "./qa-regen";

// 공용 stub 재료
const CLEAN = JSON.stringify({ body: "깨끗한 본문", advice: [] });
const DIRTY = JSON.stringify({ body: "이혼수가 보입니다", advice: [] });
const passValidate = () => [] as string[];
const guardCutForbidden = (parsed: any) => {
  const dirty = String(parsed?.body ?? "").includes("이혼수");
  return {
    blocks: { ...parsed, body: dirty ? "" : parsed.body },
    violations: dirty ? ["단정 예언 제거(body)"] : [],
  };
};

test("1차 위반 → 위반 목록 첨부 재생성 → 2차 통과", async () => {
  const prompts: string[] = [];
  const responses = [DIRTY, CLEAN];
  const res = await generateWithQaRegen<{ body: string }>({
    prompt: "BASE",
    systemPrompt: "SYS",
    models: ["m1"],
    callModel: async (_m, prompt) => {
      prompts.push(prompt);
      return { ok: true, text: responses.shift()! };
    },
    shouldFallback: () => false,
    parse: (t) => JSON.parse(t),
    validateBlocks: passValidate,
    applyGuards: guardCutForbidden,
  });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.attempts, 2);
    assert.equal(res.violations.length, 0);
    assert.equal(res.blocks.body, "깨끗한 본문");
  }
  // 2번째 프롬프트에 위반 목록이 덧붙었는지
  assert.ok(prompts[1].includes("직전 출력이 다음 룰을 위반했다"));
  assert.ok(prompts[1].includes("단정 예언 제거"));
  assert.ok(prompts[1].startsWith("BASE"));
});

test("2회 모두 위반 → 스크럽된 blocks + violations를 그대로 출고(리포트 절대 비우지 않음)", async () => {
  const res = await generateWithQaRegen<{ body: string }>({
    prompt: "BASE",
    systemPrompt: "SYS",
    models: ["m1"],
    callModel: async () => ({ ok: true, text: DIRTY }),
    shouldFallback: () => false,
    parse: (t) => JSON.parse(t),
    validateBlocks: passValidate,
    applyGuards: guardCutForbidden,
  });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.attempts, 2);
    assert.ok(res.violations.length > 0); // 잔존 위반은 호출부가 postGuard 검증/감사 기록
  }
});

test("모델 폴백: 1번 모델 실패(fallback 대상) → 2번 모델로 성공", async () => {
  const called: string[] = [];
  const res = await generateWithQaRegen<{ body: string }>({
    prompt: "BASE",
    systemPrompt: "SYS",
    models: ["bad", "good"],
    callModel: async (model) => {
      called.push(model);
      return model === "bad"
        ? { ok: false, status: 503, apiStatus: "UNAVAILABLE", message: "down" }
        : { ok: true, text: CLEAN };
    },
    shouldFallback: (status) => status === 503,
    parse: (t) => JSON.parse(t),
    validateBlocks: passValidate,
    applyGuards: guardCutForbidden,
  });
  assert.ok(res.ok);
  assert.deepEqual(called, ["bad", "good"]);
});

test("파싱 실패·블록 검증 실패가 전 모델에서 반복되면 ok:false", async () => {
  const res = await generateWithQaRegen<{ body: string }>({
    prompt: "BASE",
    systemPrompt: "SYS",
    models: ["m1"],
    callModel: async () => ({ ok: true, text: "not-json{{{" }),
    shouldFallback: () => true,
    parse: (t) => JSON.parse(t),
    validateBlocks: passValidate,
    applyGuards: guardCutForbidden,
  });
  assert.equal(res.ok, false);
});

test("softValidate 이슈는 재생성을 유발하되 최종 출고는 막지 않음", async () => {
  let calls = 0;
  const res = await generateWithQaRegen<{ body: string }>({
    prompt: "BASE",
    systemPrompt: "SYS",
    models: ["m1"],
    callModel: async () => {
      calls++;
      return { ok: true, text: CLEAN };
    },
    shouldFallback: () => false,
    parse: (t) => JSON.parse(t),
    validateBlocks: passValidate,
    applyGuards: guardCutForbidden,
    softValidate: () => ["본문 총량 부족 — [재성 궁위 해석]·[타이밍 창] 재료로 1~2문장씩 보강"],
  });
  assert.ok(res.ok);
  assert.equal(calls, 2); // soft 이슈로 1회 재생성 시도
  if (res.ok) assert.equal(res.violations.length, 0); // soft 이슈는 violations에 안 남음
});
