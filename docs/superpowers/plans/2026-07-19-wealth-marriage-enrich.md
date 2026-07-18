# 재물운·결혼운 유료 결과지 풍부화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재물운·결혼운 유료 결과지를 "삭제만 하는 후처리 → QA 재생성 루프", "계산해놓고 안 쓰는 타이밍 → 5년 날씨 타임라인 렌더", "불리언 위주 facts → 궁위·지장간·연속 강도·아키타입 구조화"로 풍부화한다.

**Architecture:** LLM 호출 경로(analyze 라우트)의 "호출→파싱→검증→가드"를 펫 패턴(위반 목록 첨부 1회 재생성)의 공용 헬퍼로 감싸고, 서버 결정론 데이터(세운 타임라인·강도 점수·아키타입)는 facts/엔진에서만 생산해 full_json·DB 컬럼으로 흘려보낸 뒤 클라이언트는 그대로 그린다. 프롬프트에는 새 소재를 "엔진 확정값" 라인으로만 추가한다(LLM 숫자 생성 0).

**Tech Stack:** Next.js 15 + TypeScript, Gemini API(`callGemini` in `lib/analysis.ts` — **Claude 아님**), Supabase(supabaseAdmin + RLS), Tailwind. 유닛테스트 = Node 내장 `node --import tsx --test <file>` (기존 `lib/*.test.ts` 컨벤션, `node:test` + `node:assert/strict`).

## Global Constraints

- **풍부함 ≠ 글자수. 분량 상한만 올려 패러프레이즈로 늘리는 것 금지. 재료·새 축을 먼저.**
- **모듈 고유 값어치 — 재물운은 재물운만의 것, 결혼운은 결혼운만의 것. 개인사주 재탕 금지.**
- **숫자·점수·게이지는 전부 서버 결정론 계산. LLM에 숫자 생성 위임 절대 금지.**
- **소재는 프롬프트 규칙 완화가 아니라 엔진이 계산해 facts에 넣는 방식으로만 늘림 (hallucination 방지).**
- **명리 정확성: 재성/재고/식상생재/궁위(재물), 배우자궁·일지 지장간 본기/중기/여기·배우자성(결혼).**
- 브랜치: `feat/wealth-marriage-enrich` (현재 체크아웃 상태) 위에서 작업. main 머지/배포는 운영자 명시 허용 필요.
- Next.js dev 서버가 돌고 있을 때 `npx next build` 금지(`.next` 청크 충돌). 빌드 검증 전 dev 서버 종료 확인.
- API 에러 응답에 `error.message` 노출 금지 — 일반 한국어 메시지만, 상세는 `console.error`.
- 결제/차감/환불 로직(멱등 헬퍼·orphan 처리)은 **한 줄도 건드리지 않는다** — 이 계획은 Gemini 호출 구간과 저장 payload에만 손댄다.
- 클라이언트 결과 파일 원칙: 신규 프레젠테이션 컴포넌트는 공유 컴포넌트 신설 없이 각 result client 파일에 인라인(두 파일 상단 주석에 명시된 기존 원칙).

---

## 실행자용 코드베이스 지도 (읽기 전용 배경)

| 파일 | 역할 |
|---|---|
| `lib/wealth-facts.ts` / `lib/marriage-facts.ts` | 결정론 facts 엔진. `deriveWealthFacts(enriched, fortune, sajuData, interest, currentYear)` / `deriveMarriageFacts(enriched, fortune, sajuData, sex, maritalStatus, currentYear)` |
| `lib/wealth-prompt.ts` / `lib/marriage-prompt.ts` | 프롬프트 문자열 조립만. `buildWealthPrompt(facts, grade, sajuText, employmentStatus?)` / `buildMarriagePrompt(facts, grade, sajuText)` |
| `lib/wealth-postprocess.ts` / `lib/marriage-postprocess.ts` | `applyWealthGuards(parsed, facts, sajuText)` / `applyMarriageGuards(...)` → `{ blocks, violations }` (삭제만, 재생성 없음 — 이번에 고침), `validateWealthBlocks` / `validateMarriageBlocks(parsed, {minAdvice})` → `string[]` |
| `lib/pet-compat.ts:604-634` | 이식할 QA 재생성 루프 원형 (`attempt 1..2`, 위반 목록을 `extra`로 덧붙여 재생성) |
| `app/api/wealth/analyze/route.ts` / `app/api/marriage/analyze/route.ts` | 멱등 차감 → facts → consistency → **Gemini 모델 폴백 루프(교체 대상)** → 가드 → 저장 → 실패 시 환불 |
| `lib/utils/saju-fortune.ts:149-153` | 세운은 이미 `currentYear-1 .. currentYear+9` 계산됨(`SeunEntry { year, age, pillar, stem, branch, tenStar, twelveStage }`) — Phase 2는 엔진 변경 불필요 |
| `app/yearly/result/[id]/YearlyResultClient.tsx:428-433, 441-662` | 재활용할 날씨 UI(`MOOD_STYLE` + `/icons/weather/*.svg` + 가로 스크롤 셀 + 상세 row) |
| `lib/pet-compat-scoring.ts:362-407` | 결정론 라벨/아키타입 분기 원형 `pickLabelAndArchetype` |
| DB | `wealth_results`(`full_json`, `jae_grip` 등 enum 메타만 — 연속 강도 컬럼 없음), `marriage_results` 동일 구조. GET 라우트 `SELECT_COLUMNS`가 응답 필드의 유일한 통로 |

테스트 실행: `node --import tsx --test lib/<파일>.test.ts` (전부 이 형식).

---

# Phase 1 — QA 재생성 루프 (최우선·저위험)

**목표:** 후처리가 위반 문장을 삭제만 하고 끝나 "걸릴수록 리포트가 짧아지는" 구조를, 펫 패턴(위반 목록 첨부 1회 재생성)으로 교체. 동시에 결혼운 `/재혼/`·`/사별/` 컷이 "다시 혼자" 사용자의 정당 문맥을 잘라먹는 구멍을 해소.

### Task 1: 공용 QA 재생성 헬퍼 `lib/qa-regen.ts`

**Files:**
- Create: `lib/qa-regen.ts`
- Test: `lib/qa-regen.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 함수 — Gemini 호출은 `callModel`로 주입받음. 테스트에서 stub 가능)
- Produces: 아래 시그니처 그대로. Task 3(양 라우트 배선)과 Task 14(softValidate 공급)가 이 시그니처에 의존한다.

```ts
export interface QaGenOptions<T> {
  prompt: string;
  systemPrompt: string;
  models: string[];
  temperature?: number; // default 0.75
  callModel: (model: string, prompt: string, systemPrompt: string, cfg: { temperature: number }) =>
    Promise<{ ok: boolean; text?: string; status?: number; apiStatus?: string; message?: string }>;
  shouldFallback: (status?: number, apiStatus?: string) => boolean;
  parse: (text: string) => unknown;
  validateBlocks: (parsed: unknown) => string[];
  applyGuards: (parsed: unknown) => { blocks: T; violations: string[] };
  softValidate?: (blocks: T) => string[]; // Phase 5: 재생성만 유발, 최종 출고는 막지 않음
  maxAttempts?: number; // default 2
}
export type QaGenResult<T> =
  | { ok: true; blocks: T; violations: string[]; attempts: number }
  | { ok: false; error: string };
export declare function generateWithQaRegen<T>(opts: QaGenOptions<T>): Promise<QaGenResult<T>>;
```

- [ ] **Step 1: 실패 테스트 작성** — `lib/qa-regen.test.ts`

```ts
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
    prompt: "BASE", systemPrompt: "SYS", models: ["m1"],
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
    prompt: "BASE", systemPrompt: "SYS", models: ["bad", "good"],
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
    prompt: "BASE", systemPrompt: "SYS", models: ["m1"],
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
    prompt: "BASE", systemPrompt: "SYS", models: ["m1"],
    callModel: async () => { calls++; return { ok: true, text: CLEAN }; },
    shouldFallback: () => false,
    parse: (t) => JSON.parse(t),
    validateBlocks: passValidate,
    applyGuards: guardCutForbidden,
    softValidate: () => ["본문 총량 부족 — [재성 궁위 해석]·[타이밍 창] 재료로 1~2문장씩 보강"],
  });
  assert.ok(res.ok);
  assert.equal(calls, 2);           // soft 이슈로 1회 재생성 시도
  if (res.ok) assert.equal(res.violations.length, 0); // soft 이슈는 violations에 안 남음
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/qa-regen.test.ts`
Expected: FAIL — `Cannot find module './qa-regen'`

- [ ] **Step 3: 최소 구현** — `lib/qa-regen.ts`

```ts
// LLM 리포트 생성 공용 QA 재생성 루프 — lib/pet-compat.ts:604-634 패턴의 일반화.
// 원칙: 가드가 문장을 "삭제"만 하면 걸릴수록 리포트가 짧아진다(유료 리포트 품질 하락).
// 위반이 잡히면 위반 목록을 프롬프트에 덧붙여 1회 재생성하고, 그래도 위반이면
// 스크럽본을 출고한다(기존과 동일한 안전 하한 — 리포트를 비우지 않음).
// Gemini 의존을 주입(callModel)으로 끊어 node --import tsx --test 단위 테스트 가능.

export interface QaGenOptions<T> {
  prompt: string;
  systemPrompt: string;
  models: string[];
  temperature?: number;
  callModel: (model: string, prompt: string, systemPrompt: string, cfg: { temperature: number }) =>
    Promise<{ ok: boolean; text?: string; status?: number; apiStatus?: string; message?: string }>;
  shouldFallback: (status?: number, apiStatus?: string) => boolean;
  parse: (text: string) => unknown;
  validateBlocks: (parsed: unknown) => string[];
  applyGuards: (parsed: unknown) => { blocks: T; violations: string[] };
  softValidate?: (blocks: T) => string[];
  maxAttempts?: number;
}

export type QaGenResult<T> =
  | { ok: true; blocks: T; violations: string[]; attempts: number }
  | { ok: false; error: string };

export async function generateWithQaRegen<T>(opts: QaGenOptions<T>): Promise<QaGenResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 2;
  const temperature = opts.temperature ?? 0.75;
  let extra = "";
  let lastError = "분석 생성 실패";
  let lastGuarded: { blocks: T; violations: string[] } | null = null;
  let lastAttempt = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastAttempt = attempt;

    // ── 모델 폴백 체인 (기존 analyze 라우트 루프와 동일 의미) ──
    let parsed: unknown = null;
    for (const model of opts.models) {
      const res = await opts.callModel(model, opts.prompt + extra, opts.systemPrompt, { temperature });
      if (res.ok && typeof res.text === "string") {
        try {
          const candidate = opts.parse(res.text);
          const blockIssues = opts.validateBlocks(candidate);
          if (blockIssues.length > 0) {
            lastError = `블록 검증 실패: ${blockIssues.join(", ")}`;
            continue; // 다음 모델
          }
          parsed = candidate;
          break;
        } catch (err: any) {
          lastError = `JSON 파싱 실패: ${err?.message ?? "unknown"}`;
          continue;
        }
      }
      lastError = res.message ?? "LLM 호출 실패";
      if (!opts.shouldFallback(res.status, res.apiStatus)) break;
    }
    if (parsed === null) continue; // 이번 attempt 전체 실패 → 재시도

    const guarded = opts.applyGuards(parsed);
    lastGuarded = guarded;

    const softIssues = guarded.violations.length === 0 && opts.softValidate
      ? opts.softValidate(guarded.blocks)
      : [];

    if (guarded.violations.length === 0 && softIssues.length === 0) {
      return { ok: true, blocks: guarded.blocks, violations: [], attempts: attempt };
    }
    if (attempt < maxAttempts) {
      const notes = [...guarded.violations, ...softIssues];
      extra = `\n\n[★ 직전 출력이 다음 룰을 위반했다. 아래 위반이 없도록 해당 부분을 완전히 새로 써라: ${notes.join(" / ")}]`;
    }
  }

  if (lastGuarded) {
    // 재생성으로도 못 없앤 위반 → 스크럽본 출고(호출부가 postGuard 검증·감사 기록 담당)
    return { ok: true, blocks: lastGuarded.blocks, violations: lastGuarded.violations, attempts: lastAttempt };
  }
  return { ok: false, error: lastError };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/qa-regen.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/qa-regen.ts lib/qa-regen.test.ts
git commit -m "feat(qa): 공용 QA 재생성 루프 — 가드 위반 시 위반 목록 첨부 1회 재생성 (pet-compat 604-634 패턴 일반화, 삭제-only 후처리로 리포트가 얇아지는 구조 해소)"
```

### Task 2: 결혼운 금지어 status-aware 분리 (`다시 혼자` 구멍 해소)

**Files:**
- Modify: `lib/marriage-postprocess.ts:3-8` (FORBIDDEN_PREDICTIONS), `:40-50` (applyMarriageGuards의 facts 사용), `:64-82` (scrub 함수가 status-aware 목록 사용)
- Test: `lib/marriage-postprocess.test.ts` (기존 파일에 테스트 추가)

**Interfaces:**
- Consumes: `applyMarriageGuards(parsed, facts, _primarySummary)` — `facts.maritalStatus`를 이번부터 실제로 읽는다(기존에도 파라미터로 전달되고 있음, `app/api/marriage/analyze/route.ts:474`).
- Produces: `export function forbiddenPredictionsFor(maritalStatus?: string): RegExp[]` — 테스트와 향후 감사 스크립트가 사용. `applyMarriageGuards` 시그니처 무변경.

- [ ] **Step 1: 실패 테스트 추가** — `lib/marriage-postprocess.test.ts` 하단에 append

```ts
test("다시 혼자: '재혼' 정당 문맥(앞으로의 시기)은 보존", () => {
  const facts: any = { sex: "female", maritalStatus: "다시 혼자" };
  const parsed = { timingFlow: "재혼을 생각한다면 2027년 이후의 인연 창을 살펴보면 좋아.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(blocks.timingFlow.includes("재혼"));
  assert.equal(violations.filter(v => v.includes("단정")).length, 0);
});

test("다시 혼자: '이혼 후'(과거 언급)는 보존, '이혼수'(예언형)는 컷", () => {
  const facts: any = { sex: "female", maritalStatus: "다시 혼자" };
  const parsed = {
    partnerProfile: "이혼 후 다시 시작하는 인연은 서두르지 않는 게 좋아. 이혼수가 또 보인다.",
    advice: [],
  };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.ok(blocks.partnerProfile.includes("이혼 후"));
  assert.ok(!blocks.partnerProfile.includes("이혼수"));
});

test("다시 혼자: '재혼 못 한다' 낙인·'사별수' 예언은 여전히 컷", () => {
  const facts: any = { sex: "male", maritalStatus: "다시 혼자" };
  const parsed = { timingFlow: "너는 재혼 못 할 팔자야. 사별수도 보여.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(!blocks.timingFlow.includes("재혼 못"));
  assert.ok(!blocks.timingFlow.includes("사별수"));
  assert.ok(violations.length >= 2);
});

test("기혼(비-다시혼자): '재혼'·'사별' 단어 자체가 기존대로 컷", () => {
  const facts: any = { sex: "female", maritalStatus: "기혼" };
  const parsed = { timingFlow: "재혼 이야기가 나올 수 있어.", advice: [] };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.ok(!blocks.timingFlow.includes("재혼"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/marriage-postprocess.test.ts`
Expected: 신규 4개 중 "다시 혼자" 보존 테스트 2개 FAIL (현행 `/재혼/`, `/사별/`, `/이혼수?/`가 무조건 컷하므로)

- [ ] **Step 3: 구현** — `lib/marriage-postprocess.ts` 파일 상단 교체

기존 `const FORBIDDEN_PREDICTIONS = [...]`(3~8행)을 다음으로 교체:

```ts
// 단정 예언 금지어 — 문장 단위로만 컷하므로 긍정 맥락 문장은 안전하다.
// ★관계상태 분기(2026-07-19): "다시 혼자"(이혼·사별) 사용자에게 /재혼/·/사별/·/이혼/ 무조건
// 컷은 정당 문맥(재혼 타이밍 = 이 세그먼트의 핵심 콘텐츠, "이혼 후"라는 상태 서술)까지 잘라
// 리포트를 얇게 만들던 구멍 — 예언·낙인형 패턴만 남기고 상태 서술은 허용한다.
const FORBIDDEN_PREDICTIONS_BASE = [
  /외도/, /바람(을|이|날)/, /혼자 늙/, /팔자가 세/,
  /이별수/, /곧\s*헤어/, /헤어질\s*(수|운명|팔자)/, /파혼/, /갈라서|갈라설/,
  /결혼\s*운이?\s*없/, /불임/, /자식\s*(이|은|을)?\s*없/, /자식\s*복이?\s*없/,
  /바람\s*(기|피)/, /과부/, /독수공방/, /(일찍|먼저)\s*(떠나|떠날|여의)/,
];
// 기본(솔로·연애중·기혼): 이 단어들이 등장할 정당 맥락이 없다 — 단어 자체를 컷(기존 동작 유지).
const FORBIDDEN_DEFAULT_EXTRA = [/이혼수?/, /사별/, /재혼/];
// 다시 혼자: 예언·낙인형만 컷. "재혼 시기", "이혼 후", "사별의 아픔을 딛고"는 정당 문맥.
const FORBIDDEN_REMARRIED_EXTRA = [
  /이혼수/,                       // 예언형만 ("이혼 후"는 통과)
  /사별(수|할|하게)/,             // 예언형만 ("사별의 아픔"은 통과)
  /재혼.{0,6}(못|없|힘들|어렵)/,  // "재혼 못 한다" 낙인만 (재혼 자체는 핵심 소재)
];

export function forbiddenPredictionsFor(maritalStatus?: string): RegExp[] {
  return maritalStatus === "다시 혼자"
    ? [...FORBIDDEN_PREDICTIONS_BASE, ...FORBIDDEN_REMARRIED_EXTRA]
    : [...FORBIDDEN_PREDICTIONS_BASE, ...FORBIDDEN_DEFAULT_EXTRA];
}
```

`applyMarriageGuards` 본문 수정 — 함수 첫 줄에 목록 계산을 추가하고, `FORBIDDEN_PREDICTIONS.some(...)` 참조 2곳(advice 필터 48행, `scrubForbiddenPredictions` 내부 72행)을 `forbidden.some(...)`으로 교체:

```ts
export function applyMarriageGuards(parsed: any, facts: any, _primarySummary: string): MarriageGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));
  const forbidden = forbiddenPredictionsFor(facts?.maritalStatus); // ★ status-aware
  // ... 이하 기존 코드에서 FORBIDDEN_PREDICTIONS → forbidden 치환 (2곳)
```

(`scrubForbiddenPredictions`는 `applyMarriageGuards` 안의 지역 함수이므로 클로저로 `forbidden`을 그대로 참조한다 — 시그니처 변경 불필요.)

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/marriage-postprocess.test.ts`
Expected: PASS (기존 전체 + 신규 4개. 기존 "이혼수" 테스트는 facts.maritalStatus="기혼"이라 기존대로 통과)

- [ ] **Step 5: 커밋**

```bash
git add lib/marriage-postprocess.ts lib/marriage-postprocess.test.ts
git commit -m "fix(marriage): 금지어 status-aware 분리 — '다시 혼자'의 재혼 타이밍·과거 상태 서술 정당 문맥 보존, 예언·낙인형만 컷 (세그먼트 리포트 얇아지는 구멍 해소)"
```

### Task 3: 양 analyze 라우트에 QA 재생성 배선

**Files:**
- Modify: `app/api/wealth/analyze/route.ts:433-499` (`// 6) Gemini 호출` ~ `// F-2 후단` 직전의 모델 루프 + 가드 호출부)
- Modify: `app/api/marriage/analyze/route.ts:431-490` (동일 구간 — `buildMarriagePrompt` 호출부터 `applyMarriageGuards`·postGuard 직전까지)

**Interfaces:**
- Consumes: Task 1의 `generateWithQaRegen`, 기존 `callGemini(model, userInfo, systemPrompt, {temperature})`(`lib/analysis.ts:2113`), `shouldFallback`, `parseJson5Loose`, `validateWealthBlocks`/`validateMarriageBlocks`, `applyWealthGuards`/`applyMarriageGuards`.
- Produces: 라우트 응답 스키마 무변경. `guard_violations` 감사 기록 로직 무변경(잔존 위반만 기록됨 — 재생성으로 0이 되면 기록 없음, 의도된 동작).

- [ ] **Step 1: wealth 라우트 교체** — `app/api/wealth/analyze/route.ts`

import 추가:
```ts
import { generateWithQaRegen } from "@/lib/qa-regen";
```

기존 6)·7) 구간(`const prompt = buildWealthPrompt(...)` 아래 `let parsed`부터 `const { blocks, violations } = applyWealthGuards(parsed, facts, sajuText); if (violations...) console.warn` 까지)을 다음으로 교체:

```ts
      const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
      const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;

      // 6)+7) Gemini 호출 + 가드 — QA 재생성 루프(가드 위반 시 위반 목록 첨부 1회 재생성,
      // lib/qa-regen.ts). 종전에는 위반 문장을 삭제만 해 걸릴수록 리포트가 짧아졌다.
      const gen = await generateWithQaRegen<any>({
        prompt,
        systemPrompt: WEALTH_SYSTEM_PROMPT,
        models,
        temperature: 0.75,
        callModel: (model, p, sys, cfg) => callGemini(model, p, sys, cfg),
        shouldFallback,
        parse: (text) => parseJson5Loose<any>(text),
        validateBlocks: (candidate) => validateWealthBlocks(candidate),
        applyGuards: (candidate) => applyWealthGuards(candidate, facts, sajuText),
      });

      if (!gen.ok) {
        console.error("[WEALTH_ANALYZE] gemini 실패", gen.error);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석에 실패했어. 알은 환불됐어.", refunded: true },
          { status: 500 },
        );
      }
      const blocks = gen.blocks;
      const violations = gen.violations;
      if (violations.length > 0) {
        console.warn(`[WEALTH_ANALYZE] guard violations (재생성 ${gen.attempts}회 후 잔존)`, violations);
      }
```

이후의 `postGuardIssues = validateWealthBlocks(blocks, { minAdvice: 1 })` 검증, 저장, `guard_violations` 기록 코드는 **그대로 유지**(변수명 `blocks`/`violations` 동일).

- [ ] **Step 2: marriage 라우트 동일 교체** — `app/api/marriage/analyze/route.ts`

import 추가 후, `const prompt = buildMarriagePrompt(facts, grade, sajuText);` 아래 모델 루프~가드 구간을 다음으로 교체:

```ts
      const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
      const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;

      const gen = await generateWithQaRegen<any>({
        prompt,
        systemPrompt: MARRIAGE_SYSTEM_PROMPT,
        models,
        temperature: 0.75,
        callModel: (model, p, sys, cfg) => callGemini(model, p, sys, cfg),
        shouldFallback,
        parse: (text) => parseJson5Loose<any>(text),
        validateBlocks: (candidate) => validateMarriageBlocks(candidate),
        applyGuards: (candidate) => applyMarriageGuards(candidate, facts, sajuText),
      });

      if (!gen.ok) {
        console.error("[MARRIAGE_ANALYZE] gemini 실패", gen.error);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석에 실패했어. 알은 환불됐어.", refunded: true },
          { status: 500 },
        );
      }
      const blocks = gen.blocks;
      const violations = gen.violations;
      if (violations.length > 0) {
        console.warn(`[MARRIAGE_ANALYZE] guard violations (재생성 ${gen.attempts}회 후 잔존)`, violations);
      }
```

(marriage 쪽 실패 시 에러 문구는 해당 라우트의 기존 한국어 문구를 그대로 사용할 것 — 교체 전 원문을 확인해 동일 문구 유지.)

- [ ] **Step 3: 3-layer 정합성 검증 스텝**
  - `applyMarriageGuards`가 두 라우트에서 모두 `facts`를 받는지 확인(Task 2의 status-aware가 실경로에서 작동): `grep -n "applyMarriageGuards(" app/api/marriage/analyze/route.ts` → `(candidate, facts, sajuText)` 형태여야 함.
  - 환불 경로 개수 불변 확인: 교체 전후 `grep -c "refundAndCleanup" app/api/wealth/analyze/route.ts` 값이 동일해야 함(결제 로직 무변경 보장).

- [ ] **Step 4: 빌드 검증**

Run: (dev 서버 꺼진 상태에서) `npx next build`
Expected: 성공. 이어서 `node --import tsx --test lib/qa-regen.test.ts lib/marriage-postprocess.test.ts lib/wealth-postprocess.test.ts` PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/api/wealth/analyze/route.ts app/api/marriage/analyze/route.ts
git commit -m "feat(wealth,marriage): analyze 라우트에 QA 재생성 루프 배선 — 가드 위반 시 1회 재생성 후 출고, 결제·환불 경로 무변경 (Gemini 호출 최대 +1회가 유일한 비용 변화)"
```

**Phase 1 독립 산출물:** 이 Phase만으로 배포 가능 — 응답/DB 스키마 무변경, 두 상품의 리포트가 "가드에 걸려 짧아지는" 대신 재생성되고, "다시 혼자" 세그먼트의 재혼 문맥이 살아난다. 리스크는 위반 발생 시 Gemini 1회 추가 호출뿐.

---

# Phase 2 — 재물/인연 날씨 타임라인 (체감 최대)

**목표:** 서버가 이미 계산해둔 세운 트리거를 "향후 5년(+지나간 1칸 회색)" 날씨 타임라인으로 렌더. 올해운세 날씨 UI 문법(MOOD_STYLE + `/icons/weather/*.svg`) 재활용. 대운은 띠에 섞지 않고 별도 굵은 요소. **모든 값 서버 결정론 — LLM 무관여.**

### Task 4: 결정론 타임라인 빌더 `lib/fortune-timeline.ts`

**Files:**
- Create: `lib/fortune-timeline.ts`
- Test: `lib/fortune-timeline.test.ts`

**Interfaces:**
- Consumes: `FortuneResult`/`SeunEntry`(`lib/utils/saju-fortune.ts:59-72`), `WealthFacts.timingWindows`(`lib/wealth-facts.ts:25-30`), `MarriageFacts.timingWindows`+`maritalStatus`(`lib/marriage-facts.ts:12-14`), `STEM_ELEMENT`/`BRANCH_INFO`(korean 필드, `lib/utils/saju-enrichment.ts` — `lib/utils/yearly-monthly.ts:92` 사용례와 동일).
- Produces: Task 5(라우트 저장)·Task 6(렌더)이 쓰는 타입/함수:

```ts
export type TimelineMood = "강세" | "보통" | "주의";
export interface TimelineEntry {
  year: number; age: number;
  pillarKorean: string;      // "병오"
  tenStar: string; twelveStage: string;
  mood: TimelineMood;
  triggers: string[];        // 그 해 facts 트리거 라벨 원문 (없으면 [])
  hint: string;              // 결정론 한 줄 (LLM 아님)
  isPast: boolean; isCurrent: boolean;
}
export interface ServerTimeline {
  version: 1;
  entries: TimelineEntry[];  // currentYear-1 .. currentYear+5 (세운 존재 범위 내)
  daeun: Array<{ startAge: number; endAge: number; star: string }>; // 별도 굵은 요소
}
export declare function buildWealthTimeline(fortune: FortuneResult | null, facts: WealthFacts, currentYear: number): ServerTimeline | null;
export declare function buildMarriageTimeline(fortune: FortuneResult | null, facts: MarriageFacts, currentYear: number): ServerTimeline | null;
```

- [ ] **Step 1: 실패 테스트 작성** — `lib/fortune-timeline.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWealthTimeline, buildMarriageTimeline } from "./fortune-timeline";
import type { FortuneResult } from "./utils/saju-fortune";

const YEAR = 2026;
// 세운 스텁: 2025~2031 (엔진 실제 범위 currentYear-1..+9의 부분집합)
const seun = [2025, 2026, 2027, 2028, 2029, 2030, 2031].map((year, i) => ({
  year, age: 30 + i, pillar: "丙午", stem: "丙", branch: "午",
  tenStar: "편재", twelveStage: "제왕",
}));
const fortune: FortuneResult = {
  daeun: { gender: "male", isForward: true, startAge: 3,
    startAgeDetail: { years: 3, months: 0, days: 0 }, daysToTerm: 10, pillars: [] },
  seun,
};

const wealthFacts: any = {
  timingWindows: [
    { year: 2025, age: 30, triggers: ["재성투출"], isPast: true },
    { year: 2027, age: 32, triggers: ["비겁손재"], isPast: false },
  ],
  daeunWealthYears: [{ startAge: 34, endAge: 43, star: "정재" }],
};

test("wealth: 범위 currentYear-1..+5, 과거/현재 플래그, 트리거→무드 결정론", () => {
  const tl = buildWealthTimeline(fortune, wealthFacts, YEAR)!;
  assert.equal(tl.entries.length, 7); // 2025..2031
  assert.equal(tl.entries[0].year, 2025);
  assert.equal(tl.entries[0].isPast, true);
  assert.equal(tl.entries[0].mood, "강세");          // 재성투출
  assert.equal(tl.entries[1].isCurrent, true);        // 2026
  assert.equal(tl.entries[1].mood, "보통");           // 트리거 없음
  assert.equal(tl.entries[2].mood, "주의");           // 2027 비겁손재
  assert.ok(tl.entries[2].hint.includes("점검"));      // 절대 규칙 4 프레임(손실 단정 금지)
  assert.equal(tl.entries[0].pillarKorean, "병오");
  assert.deepEqual(tl.daeun, wealthFacts.daeunWealthYears);
});

test("wealth: '위기' 무드는 존재하지 않는다(공포 프레임 금지 — 강세/보통/주의 3단만)", () => {
  const tl = buildWealthTimeline(fortune, wealthFacts, YEAR)!;
  assert.ok(tl.entries.every((e) => ["강세", "보통", "주의"].includes(e.mood)));
});

test("marriage: 기혼이면 도화홍염 힌트가 부부 내부 프레임", () => {
  const mFacts: any = {
    maritalStatus: "기혼",
    timingWindows: [{ year: 2027, age: 32, triggers: ["도화홍염"], isPast: false }],
    daeunSpouseYears: [],
  };
  const tl = buildMarriageTimeline(fortune, mFacts, YEAR)!;
  const e2027 = tl.entries.find((e) => e.year === 2027)!;
  assert.equal(e2027.mood, "강세");
  assert.ok(e2027.hint.includes("부부"));            // 절대 규칙 3-4
  assert.ok(!e2027.hint.includes("새 인연"));
});

test("marriage: 솔로면 같은 트리거가 인연 창 프레임", () => {
  const mFacts: any = {
    maritalStatus: "솔로",
    timingWindows: [{ year: 2027, age: 32, triggers: ["배우자성투출"], isPast: false }],
    daeunSpouseYears: [],
  };
  const tl = buildMarriageTimeline(fortune, mFacts, YEAR)!;
  assert.ok(tl.entries.find((e) => e.year === 2027)!.hint.includes("인연"));
});

test("fortune null → null (타임라인 섹션 미노출 경로)", () => {
  assert.equal(buildWealthTimeline(null, wealthFacts, YEAR), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/fortune-timeline.test.ts`
Expected: FAIL — `Cannot find module './fortune-timeline'`

- [ ] **Step 3: 구현** — `lib/fortune-timeline.ts`

```ts
// 재물/인연 날씨 타임라인 — 전부 서버 결정론(LLM 무관여).
// 세운은 saju-fortune.ts가 이미 currentYear-1..+9를 계산한다(:149) — 여기서는 그중
// currentYear-1..currentYear+5 창만 잘라 무드·힌트를 파생한다.
// 무드는 3단(강세=맑음/보통=흐림/주의=비)만 쓴다 — "위기/폭풍"은 유료 리포트 안전장치
// (wealth 절대 규칙 3·4: 손실 단정·공포 금지)와 충돌하므로 의도적으로 배제.
// 트리거의 단일 진실원은 facts.timingWindows(엔진 계산값) — 여기서 재판정하지 않는다.

import type { FortuneResult } from "./utils/saju-fortune";
import type { WealthFacts } from "./wealth-facts";
import type { MarriageFacts } from "./marriage-facts";
import { STEM_ELEMENT, BRANCH_INFO } from "./utils/saju-enrichment";

export type TimelineMood = "강세" | "보통" | "주의";

export interface TimelineEntry {
  year: number; age: number;
  pillarKorean: string;
  tenStar: string; twelveStage: string;
  mood: TimelineMood;
  triggers: string[];
  hint: string;
  isPast: boolean; isCurrent: boolean;
}

export interface ServerTimeline {
  version: 1;
  entries: TimelineEntry[];
  daeun: Array<{ startAge: number; endAge: number; star: string }>;
}

const PAST_SPAN = 1;   // 지나간 회색 맥락 칸
const FUTURE_SPAN = 5; // 향후 5년

function pillarKoreanFor(stem: string, branch: string): string {
  return `${STEM_ELEMENT[stem]?.korean ?? stem}${BRANCH_INFO[branch]?.korean ?? branch}`;
}

// 세운 한 해의 십성은 단일이므로 wealth 트리거는 해마다 최대 1개(재성/식상/비겁 셋은 서로소).
const WEALTH_MOOD: Record<string, TimelineMood> = {
  재성투출: "강세", 식상투출: "강세", 비겁조력: "보통", 비겁손재: "주의",
};
const WEALTH_HINT: Record<string, string> = {
  재성투출: "재성이 들어오는 해 — 돈이 움직일 여지가 큰 시기야",
  식상투출: "벌이를 만드는 기운이 드는 해 — 새 수입 흐름을 살펴볼 만해",
  비겁조력: "힘을 보태주는 기운 — 기반을 다지기 좋은 해야",
  비겁손재: "지출·대여·보증 같은 결정은 한 번 더 점검하고 넘어가",
};
const WEALTH_HINT_NONE = "큰 트리거 없이 흘러가는 해야";

// marriage 트리거는 동시 발생 가능(합·십성·도화는 독립) → 우선순위로 힌트 대표 트리거 선정.
const MARRIAGE_TRIGGER_PRIORITY = ["배우자성투출", "세운합일지", "도화홍염"] as const;
const MARRIAGE_HINT: Record<string, string> = {
  배우자성투출: "배우자 기운이 드는 해 — 인연의 흐름이 또렷해지는 시기야",
  세운합일지: "배우자궁이 움직이는 해 — 관계가 가까워지기 좋은 시기야",
  도화홍염: "매력이 도는 해 — 인연이 다가오기 좋은 시기야",
};
// 기혼 전용(절대 규칙 3-4: 모든 신호를 부부 관계 내부로만)
const MARRIAGE_HINT_MARRIED: Record<string, string> = {
  배우자성투출: "부부 사이를 재점검하고 소통하기 좋은 해야",
  세운합일지: "부부의 발을 다시 맞추기 좋은 해야",
  도화홍염: "부부 사이에 설렘을 되찾기 좋은 해야",
};
const MARRIAGE_HINT_NONE = "큰 트리거 없이 흘러가는 해야";

function sliceWindow(fortune: FortuneResult, currentYear: number) {
  return (fortune.seun ?? []).filter(
    (s) => s.year >= currentYear - PAST_SPAN && s.year <= currentYear + FUTURE_SPAN,
  );
}

export function buildWealthTimeline(
  fortune: FortuneResult | null,
  facts: Pick<WealthFacts, "timingWindows" | "daeunWealthYears">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = triggers[0];
    return {
      year: s.year, age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar, twelveStage: s.twelveStage,
      mood: lead ? (WEALTH_MOOD[lead] ?? "보통") : "보통",
      triggers,
      hint: lead ? (WEALTH_HINT[lead] ?? WEALTH_HINT_NONE) : WEALTH_HINT_NONE,
      isPast: s.year < currentYear, isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: facts.daeunWealthYears };
}

export function buildMarriageTimeline(
  fortune: FortuneResult | null,
  facts: Pick<MarriageFacts, "timingWindows" | "daeunSpouseYears" | "maritalStatus">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const married = facts.maritalStatus === "기혼";
  const hintTable = married ? MARRIAGE_HINT_MARRIED : MARRIAGE_HINT;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = MARRIAGE_TRIGGER_PRIORITY.find((t) => triggers.includes(t));
    return {
      year: s.year, age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar, twelveStage: s.twelveStage,
      mood: lead ? "강세" : "보통", // 결혼운 엔진엔 부정 트리거가 없다 — 주의 무드 미사용
      triggers,
      hint: lead ? hintTable[lead] : MARRIAGE_HINT_NONE,
      isPast: s.year < currentYear, isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: facts.daeunSpouseYears };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/fortune-timeline.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 3-layer 정합성 검증 스텝** — 힌트 문자열이 각 모듈 후처리 금지 정규식에 걸리지 않는지 테스트로 고정. `lib/fortune-timeline.test.ts`에 추가:

```ts
import { applyWealthGuards } from "./wealth-postprocess";
import { applyMarriageGuards } from "./marriage-postprocess";

test("결정론 힌트 문자열은 양 모듈 가드 금지 패턴에 걸리지 않는다(3-layer 정합)", () => {
  const wtl = buildWealthTimeline(fortune, wealthFacts, YEAR)!;
  const wres = applyWealthGuards({ probe: wtl.entries.map((e) => e.hint).join(" ") }, {}, "");
  assert.equal(wres.violations.length, 0);
  const mFacts: any = { maritalStatus: "기혼",
    timingWindows: [{ year: 2027, age: 32, triggers: ["도화홍염"], isPast: false }], daeunSpouseYears: [] };
  const mtl = buildMarriageTimeline(fortune, mFacts, YEAR)!;
  const mres = applyMarriageGuards({ probe: mtl.entries.map((e) => e.hint).join(" ") }, mFacts, "");
  assert.equal(mres.violations.length, 0);
});
```

Run: `node --import tsx --test lib/fortune-timeline.test.ts` → PASS

- [ ] **Step 6: 커밋**

```bash
git add lib/fortune-timeline.ts lib/fortune-timeline.test.ts
git commit -m "feat(timeline): 재물/인연 5년 날씨 타임라인 결정론 빌더 — facts.timingWindows 단일 진실원, 무드 3단(위기 배제=공포 프레임 금지), 기혼 힌트는 부부 내부 프레임"
```

### Task 5: analyze 라우트에서 타임라인을 full_json에 병합 저장

**Files:**
- Modify: `app/api/wealth/analyze/route.ts` (postGuard 검증 통과 직후 ~ `// 8) 저장` 직전)
- Modify: `app/api/marriage/analyze/route.ts` (동일 위치)

**Interfaces:**
- Consumes: Task 4의 `buildWealthTimeline`/`buildMarriageTimeline`. 라우트 스코프의 `fortune`, `facts`, `currentYear`(양쪽 모두 이미 존재 — wealth `:409-410` 참조).
- Produces: `full_json.serverTimeline?: ServerTimeline` — Task 6(렌더)이 소비. DB 스키마 무변경(jsonb 안). 기존(과거 결제) row에는 없음 → 렌더는 conditional.

- [ ] **Step 1: wealth 라우트 수정** — `postGuardIssues` 검증 블록 통과 직후, `// 8) 저장` 직전에 삽입:

```ts
      // 서버 결정론 타임라인 — 가드/스크럽이 끝난 뒤에 병합한다(LLM 산문이 아니므로 스크럽
      // 대상 아님·건드리면 안 됨). 실패해도 리포트 본문과 무관하므로 저장을 막지 않는다.
      const serverTimeline = buildWealthTimeline(fortune, facts, currentYear);
      if (serverTimeline) blocks.serverTimeline = serverTimeline;
```

import: `import { buildWealthTimeline } from "@/lib/fortune-timeline";`

- [ ] **Step 2: marriage 라우트 동일 수정**

```ts
      const serverTimeline = buildMarriageTimeline(fortune, facts, currentYear);
      if (serverTimeline) blocks.serverTimeline = serverTimeline;
```

import: `import { buildMarriageTimeline } from "@/lib/fortune-timeline";`

- [ ] **Step 3: 정합성 검증 스텝**
  - `applyWealthGuards`/`applyMarriageGuards` 호출 **이후에** 병합되는지 diff 순서 확인 (스크럽 walk가 힌트 문장을 건드리면 안 됨).
  - share 파일이 새 키에 영향 없는지: `grep -n "full_json\|serverTimeline" lib/share-wealth.ts lib/share-marriage.ts` → 특정 키만 읽는 구조면 통과.

- [ ] **Step 4: 빌드 확인**

Run: `npx next build` → 성공

- [ ] **Step 5: 커밋**

```bash
git add app/api/wealth/analyze/route.ts app/api/marriage/analyze/route.ts
git commit -m "feat(wealth,marriage): full_json.serverTimeline 병합 저장 — 가드 후 병합(스크럽 비대상), DB 스키마 무변경, 과거 결제분은 키 부재로 렌더 스킵"
```

### Task 6: 타임라인 렌더 (양 result client 인라인)

**Files:**
- Modify: `app/wealth/result/WealthResultClient.tsx` — `WealthBlocks` 타입(45-55행), 섹션 삽입(382행 `</Reveal>` 뒤), 파일 하단에 인라인 컴포넌트 추가
- Modify: `app/marriage/result/MarriageResultClient.tsx` — `MarriageBlocks` 타입(34-44행), 섹션 삽입(379행 `</Reveal>` 뒤), 동일 인라인 컴포넌트

**Interfaces:**
- Consumes: `result.serverTimeline`(Task 5), 기존 자산 `/icons/weather/{sun,cloud,rain}.svg`, 기존 `Reveal`/`EYEBROW`.
- Produces: 없음(리프 UI). 두 파일에 **동일 컴포넌트를 중복 인라인**한다 — 두 파일 상단 주석의 "공유 컴포넌트 신설 금지 원칙"을 따름(SpecGauge·ReportCard도 같은 방식으로 이미 중복).

- [ ] **Step 1: 타입 추가 (양 파일 공통)** — `WealthBlocks`/`MarriageBlocks`에 추가:

```ts
interface TimelineEntryView {
  year: number; age: number;
  pillarKorean: string; tenStar: string; twelveStage: string;
  mood: "강세" | "보통" | "주의";
  triggers: string[]; hint: string;
  isPast: boolean; isCurrent: boolean;
}
interface ServerTimelineView {
  version: 1;
  entries: TimelineEntryView[];
  daeun: Array<{ startAge: number; endAge: number; star: string }>;
}
// WealthBlocks / MarriageBlocks 에 각각:
  serverTimeline?: ServerTimelineView;
```

- [ ] **Step 2: 인라인 컴포넌트 추가** — `WealthResultClient.tsx` 하단(`ReportCard` 아래)에 추가. YearlyResultClient의 `MOOD_STYLE`(428행)·`MonthQuickCell`(527행)·`MonthRow`(575행) 문법을 연 단위로 번안:

```tsx
// ────────────────────────────────────────────────────────
// 5년 날씨 타임라인 — 전부 서버 결정론 값(full_json.serverTimeline) 렌더.
// app/yearly/result/[id]/YearlyResultClient.tsx MOOD_STYLE/MonthQuickCell/MonthRow 문법의
// 연(年) 단위 번안. 무드 3단(위기/폭풍 배제 — 유료 리포트 공포 프레임 금지).
// ────────────────────────────────────────────────────────

const TIMELINE_MOOD_STYLE: Record<string, { label: string; color: string; icon: string }> = {
  강세: { label: "맑음",   color: "text-saju-wood-muted",  icon: "/icons/weather/sun.svg" },
  보통: { label: "흐림",   color: "text-text-secondary",   icon: "/icons/weather/cloud.svg" },
  주의: { label: "비 예보", color: "text-saju-earth-muted", icon: "/icons/weather/rain.svg" },
};

function FortuneWeatherTimeline({
  title,
  daeunLabel,
  timeline,
}: {
  title: string;
  daeunLabel: (d: { startAge: number; endAge: number; star: string }) => string;
  timeline: ServerTimelineView;
}) {
  return (
    <section className="rounded-3xl bg-background-secondary p-6">
      <h3 className="text-[18px] font-bold text-text-primary mb-5">{title}</h3>

      {/* 연 셀 가로 스크롤 — 지나간 해는 회색 맥락 */}
      <div className="relative -mx-6">
        <div className="overflow-x-auto scrollbar-hide px-6" style={{ scrollSnapType: "x mandatory" }}>
          <div className="flex gap-2" style={{ width: "max-content" }}>
            {timeline.entries.map((e) => {
              const mood = TIMELINE_MOOD_STYLE[e.mood] ?? TIMELINE_MOOD_STYLE["보통"];
              return (
                <div
                  key={e.year}
                  className={`shrink-0 rounded-xl py-3 flex flex-col items-center justify-center gap-1.5 ${
                    e.isCurrent ? "bg-background-tertiary ring-1 ring-white/15" : ""
                  } ${e.isPast ? "opacity-40" : ""}`}
                  style={{ width: "76px", scrollSnapAlign: "start" }}
                >
                  <span className="font-aggro tabular-nums text-text-secondary" style={{ fontSize: "14px" }}>
                    {e.year}
                  </span>
                  <img src={mood.icon} alt="" aria-hidden style={{ width: "44px", height: "44px" }} />
                  <span className={`text-[11px] font-semibold ${mood.color} whitespace-nowrap`}>
                    {e.isPast ? "지남" : mood.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          className="pointer-events-none absolute top-0 bottom-0 right-0 w-14"
          style={{ background: "linear-gradient(to left, rgb(var(--bg-secondary)) 0%, rgba(20,20,20,0) 100%)" }}
          aria-hidden
        />
      </div>

      {/* 연 상세 row — 미래 해만(과거는 맥락 셀로 충분) */}
      <div className="mt-6 pt-5 border-t border-white/5 divide-y divide-white/5">
        {timeline.entries.filter((e) => !e.isPast).map((e) => {
          const mood = TIMELINE_MOOD_STYLE[e.mood] ?? TIMELINE_MOOD_STYLE["보통"];
          return (
            <article key={e.year} className="py-3.5 first:pt-3 last:pb-2">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-aggro text-text-primary tabular-nums leading-none" style={{ fontSize: "17px" }}>
                    {e.year}
                  </span>
                  <img src={mood.icon} alt="" aria-hidden style={{ width: "36px", height: "36px" }} />
                </div>
                <span className={`text-[13px] font-semibold ${mood.color}`}>{mood.label}</span>
              </div>
              <p className="text-[15.5px] text-text-primary leading-relaxed font-medium break-keep">{e.hint}</p>
              <p className="text-[12px] text-text-tertiary mt-1.5">
                만 {e.age}세 · {e.pillarKorean}년 · {e.tenStar}운 · {e.twelveStage}
              </p>
            </article>
          );
        })}
      </div>

      {/* 대운 — 띠에 섞지 않는 별도 굵은 요소 */}
      {timeline.daeun.length > 0 && (
        <div className="mt-5 rounded-2xl bg-background-tertiary px-5 py-4">
          <div className="text-[12px] font-semibold text-text-tertiary mb-2">10년 단위 큰 흐름</div>
          <div className="flex flex-wrap gap-2">
            {timeline.daeun.map((d, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold text-text-primary">
                {daeunLabel(d)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: 섹션 삽입 — wealth** (`WealthResultBody`, 382행 ② 섹션 `</Reveal>` 뒤):

```tsx
        {/* ②.5 재물 날씨 타임라인 — 서버 결정론(serverTimeline). 과거 결제분엔 키 없음 → 스킵 */}
        {result.serverTimeline && result.serverTimeline.entries.length > 0 && (
          <Reveal>
            <section className="px-6 pt-16">
              <p className={EYEBROW}>앞으로 5년</p>
              <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
                재물 날씨 타임라인
              </h2>
              <div className="mt-8">
                <FortuneWeatherTimeline
                  title="해마다 달라지는 재물 기류"
                  daeunLabel={(d) => `${d.startAge}~${d.endAge}세 · ${d.star} 대운`}
                  timeline={result.serverTimeline}
                />
              </div>
            </section>
          </Reveal>
        )}
```

- [ ] **Step 4: 섹션 삽입 — marriage** (`MarriageResultBody`, 379행 ② 섹션 `</Reveal>` 뒤). Step 2의 `TIMELINE_MOOD_STYLE`·`FortuneWeatherTimeline` 코드를 `MarriageResultClient.tsx` 하단에도 **그대로 복사**(파일 인라인 원칙)한 뒤:

```tsx
        {/* ②.5 인연 날씨 타임라인 — 서버 결정론(serverTimeline). 과거 결제분엔 키 없음 → 스킵 */}
        {result.serverTimeline && result.serverTimeline.entries.length > 0 && (
          <Reveal>
            <section className="px-6 pt-16">
              <p className={EYEBROW}>앞으로 5년</p>
              <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
                인연 날씨 타임라인
              </h2>
              <div className="mt-8">
                <FortuneWeatherTimeline
                  title="해마다 달라지는 인연 기류"
                  daeunLabel={(d) => `${d.startAge}~${d.endAge}세 · ${d.star} 대운`}
                  timeline={result.serverTimeline}
                />
              </div>
            </section>
          </Reveal>
        )}
```

- [ ] **Step 5: 빌드 + 육안 검증**

Run: `npx next build` → 성공. (시니어 가독성 체크: 아이콘 44px+, 연도 폰트 aggro, 한 셀에 정보 1개 — `feedback_senior_audience_design` 준수 확인.)

- [ ] **Step 6: 커밋**

```bash
git add app/wealth/result/WealthResultClient.tsx app/marriage/result/MarriageResultClient.tsx
git commit -m "feat(wealth,marriage): 5년 날씨 타임라인 렌더 — yearly 날씨 UI 문법 연 단위 번안, 과거 1칸 회색 맥락, 대운은 별도 칩, serverTimeline 없으면 미노출(하위호환)"
```

**Phase 2 독립 산출물:** 이 Phase만으로 배포 가능 — 신규 결제 리포트에 "향후 5년 재물/인연 날씨 + 대운 칩" 섹션이 추가된다(서버 결정론 100%). 과거 결제분은 기존 화면 그대로(키 부재 → 미노출).

---

# Phase 3 — 프롬프트 긍정 예시 + 궁위·지장간 구조화 (프롬프트 위주)

### Task 7: 재물 궁위(宮位) 구조화 — facts→프롬프트 라인

**Files:**
- Modify: `lib/wealth-prompt.ts` (`buildFactBlock` 96-119행 + `SYSTEM_RULES` 절대 규칙 2)
- Test: Create `lib/wealth-prompt.test.ts`

**Interfaces:**
- Consumes: `WealthFacts.jaeseong`(위치 목록, `lib/wealth-facts.ts:19-23`)
- Produces: `export function formatJaeseongGungwi(facts: WealthFacts): string` — 결정론 텍스트. LLM은 이 라인을 해석만 한다.

- [ ] **Step 1: 실패 테스트 작성** — `lib/wealth-prompt.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWealthPrompt, formatJaeseongGungwi } from "./wealth-prompt";

const baseFacts: any = {
  interest: "목돈·노후 준비", dayStem: "甲",
  jaeseong: [
    { pillar: "month", source: "천간", star: "편재" },
    { pillar: "hour", source: "지장간", star: "정재" },
  ],
  jaeseongType: "재성혼재", jaeseongAbsent: false,
  jaeseongStrength: 6, bigeopStrength: 2, strengthLevel: "신강",
  jaeGrip: "신왕재왕", jaedaShinyak: false, sikssangSaengjae: true,
  gunggeobJaengjae: false, bigeopTaljae: false, jaego: false,
  yongshinFavorsWealth: true, timingWindows: [], daeunWealthYears: [],
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/wealth-prompt.test.ts`
Expected: FAIL — `formatJaeseongGungwi` 미존재

- [ ] **Step 3: 구현** — `lib/wealth-prompt.ts`

`formatDaeunWealthYears` 아래에 추가:

```ts
// 궁위(宮位) — 재성이 앉은 기둥을 인생 국면·육친 무대로 번역(정통 궁위론: 년=초년·조상,
// 월=청년·부모형제·사회, 일지=중년·배우자, 시=말년·자녀). 판단은 여기서 끝났고 LLM은
// "왜 그 국면의 돈인지"를 풀어 쓰기만 한다(숫자·새 판정 생성 금지 원칙).
const PILLAR_DOMAIN: Record<WealthStarHit["pillar"], string> = {
  year: "초년·집안 뿌리 국면(가문·성장기의 기반)",
  month: "사회활동기 국면(직장·벌이의 무대, 20~40대 커리어)",
  day: "중년·배우자와 함께 꾸리는 살림 국면",
  hour: "말년·자녀와 노후 국면",
};

export function formatJaeseongGungwi(facts: WealthFacts): string {
  if (facts.jaeseongAbsent) return "해당 없음(무재 — 궁위 대신 식상·용신·대운 경로로 서술)";
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of facts.jaeseong) {
    if (seen.has(h.pillar)) continue;
    seen.add(h.pillar);
    lines.push(`${PILLAR_LABEL[h.pillar]}(${PILLAR_DOMAIN[h.pillar]})에 ${h.star}`);
  }
  return lines.join(" / ");
}
```

`buildFactBlock`의 `재성 유형` 라인 다음에 추가:

```ts
    `재성 궁위 해석(위치→인생 국면, 서버 결정값 — 이 국면 번역을 jaeseongDiagnosis에 반드시 반영): ${formatJaeseongGungwi(facts)}`,
```

`SYSTEM_RULES` 절대 규칙 2 말미에 추가:

```
- **궁위 활용**: [재물 사실]의 "재성 궁위 해석" 값이 있으면, 재성이 "어느 인생 국면의 돈"인지를
  jaeseongDiagnosis에서 반드시 짚어라. 예: "시주에 정재가 있다는 건 말년·노후 국면에 안정형
  재물이 자리 잡는 그림이야 — 젊을 때 조급해할 이유가 없는 구조지." 궁위 해석 값에 없는
  기둥·국면을 지어내지 마라.
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/wealth-prompt.test.ts`
Expected: 궁위 테스트 2개 PASS (긍정 예시 테스트는 Task 9에서 PASS — 이 시점 FAIL 허용. Task 9까지 같은 브랜치에서 연속 작업하므로 여기선 `--test-name-pattern="궁위"`로 부분 확인: `node --import tsx --test --test-name-pattern="궁위" lib/wealth-prompt.test.ts`)

- [ ] **Step 5: 커밋**

```bash
git add lib/wealth-prompt.ts lib/wealth-prompt.test.ts
git commit -m "feat(wealth): 재성 궁위(년=초년/월=사회활동기/일=중년살림/시=말년) 결정론 번역을 fact 라인으로 — LLM은 국면 해석만, 새 판정 생성 금지 유지"
```

### Task 8: 결혼 일지 지장간 본기/중기/여기 구조화

**Files:**
- Modify: `lib/marriage-facts.ts` (인터페이스 17-33행 + `deriveMarriageFacts` 2) 단계 175-179행)
- Modify: `lib/marriage-prompt.ts` (`buildFactBlock` 65행 일지 지장간 라인)
- Test: `lib/marriage-facts.test.ts` (추가), `lib/marriage-prompt.test.ts` (추가)

**Interfaces:**
- Consumes: `BRANCH_INFO[branch].jijanggan: { stem, weight }[]` — 인덱스 0=본기, 1=중기, 2=여기 (코드베이스 확립 관행: `lib/wealth-facts.ts:102` `JIJANGGAN_POSITION_WEIGHT` 주석)
- Produces:

```ts
export interface SpousePalaceHiddenStar { position: "본기" | "중기" | "여기"; stem: string; star: string; }
// MarriageFacts에 추가 (기존 spousePalaceHiddenStars: string[]는 하위호환 유지 — DB/teaser 파급 없음):
  spousePalaceHidden: SpousePalaceHiddenStar[];
```

- [ ] **Step 1: 실패 테스트 추가** — `lib/marriage-facts.test.ts`에 append (기존 테스트 차트 재사용; 파일 상단의 기존 차트 상수 하나를 확인해 이름을 맞춰 사용하되, 독립 차트를 새로 정의해도 됨):

```ts
// 일지 戌(지장간 戊·辛·丁) — BRANCH_INFO 실측 순서 기준으로 검증.
// 주의: BRANCH_INFO의 jijanggan[0]이 본기다(wealth-facts.ts:102 가중치 관행).
const hiddenChart: SajuData = {
  year: { heavenlyStem: "壬", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "戌", hiddenStems: ["戊", "辛", "丁"] },
  hour: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
};

test("일지 지장간이 본기/중기/여기 라벨과 십성으로 구조화된다", () => {
  const enriched = enrichSajuData(hiddenChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, hiddenChart, "male", "솔로", 2026);
  assert.equal(facts.spousePalaceHidden.length, facts.spousePalaceHiddenStars.length);
  assert.equal(facts.spousePalaceHidden[0].position, "본기");
  // 일간 甲 기준 戌 본기 戊 = 편재
  assert.equal(facts.spousePalaceHidden[0].star, "편재");
  if (facts.spousePalaceHidden.length >= 3) {
    assert.equal(facts.spousePalaceHidden[2].position, "여기");
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/marriage-facts.test.ts`
Expected: 신규 테스트 FAIL (`spousePalaceHidden` undefined)

- [ ] **Step 3: 구현** — `lib/marriage-facts.ts`

인터페이스 추가 + `MarriageFacts`에 `spousePalaceHidden: SpousePalaceHiddenStar[];` 추가. `deriveMarriageFacts` 2) 단계 교체:

```ts
  // 2) 일지 지장간 십성 — 본기/중기/여기 층위 구조화(배우자의 겉결/속결/스치는 결).
  // BRANCH_INFO.jijanggan 인덱스 0=본기, 1=중기, 2=여기 (wealth-facts.ts 가중치 관행과 동일).
  const HIDDEN_POSITION = ["본기", "중기", "여기"] as const;
  const dayHidden = BRANCH_INFO[dayBranch]?.jijanggan ?? [];
  const spousePalaceHidden: SpousePalaceHiddenStar[] = [];
  dayHidden.forEach((h, idx) => {
    const st = tenStarOf(dayStem, h.stem);
    if (!st) return;
    spousePalaceHidden.push({
      position: HIDDEN_POSITION[Math.min(idx, 2)],
      stem: h.stem,
      star: st,
    });
  });
  const spousePalaceHiddenStars = spousePalaceHidden.map((h) => h.star); // 기존 필드 하위호환
```

return 객체에 `spousePalaceHidden` 추가.

- [ ] **Step 4: 프롬프트 반영** — `lib/marriage-prompt.ts` `buildFactBlock`의 일지 지장간 라인(65행) 교체:

```ts
    `일지 지장간 구조(배우자 성격의 겹 — 본기=겉으로 드러나는 기본 결, 중기=같이 살아야 보이는 속결, 여기=가끔 스치는 결): ${
      facts.spousePalaceHidden.length > 0
        ? facts.spousePalaceHidden.map((h) => `${h.position} ${h.star}`).join(" / ")
        : "없음"
    }`,
```

`SYSTEM_RULES` 블록 구조의 `partnerProfile` 서술 앞(상태별 강조 도입부)에 추가:

```
- ★일지 지장간 구조 활용: partnerProfile에서 배우자상을 "본기(첫인상·기본 성향) → 중기/여기(같이
  살아야 보이는 숨은 결)" 층위로 풀어라. 예: "겉으로는 든든하게 챙겨주는 사람인데(본기), 같이
  살아보면 은근히 자기 세계가 뚜렷한 면이 보일 거야(중기)." 구조 값에 없는 층위를 지어내지 마라.
```

`lib/marriage-prompt.test.ts`에 추가:

```ts
test("프롬프트에 일지 지장간 층위 라인이 포함된다", () => {
  // 이 파일의 기존 facts 픽스처에 spousePalaceHidden 추가 후:
  // facts.spousePalaceHidden = [{ position: "본기", stem: "戊", star: "편재" }];
  const p = buildMarriagePrompt(facts, "A", "사주텍스트");
  assert.ok(p.includes("일지 지장간 구조"));
  assert.ok(p.includes("본기 편재"));
});
```

(기존 `marriage-prompt.test.ts`의 facts 픽스처에 `spousePalaceHidden: []` 필드를 추가해 타입을 맞춘다 — 픽스처가 `any`면 그대로 동작.)

- [ ] **Step 5: 통과 확인 + 전체 회귀**

Run: `node --import tsx --test lib/marriage-facts.test.ts lib/marriage-prompt.test.ts lib/marriage-consistency.test.ts`
Expected: PASS (기존 전체 + 신규)

- [ ] **Step 6: 커밋**

```bash
git add lib/marriage-facts.ts lib/marriage-prompt.ts lib/marriage-facts.test.ts lib/marriage-prompt.test.ts
git commit -m "feat(marriage): 일지 지장간 본기/중기/여기 층위 구조화 — 배우자상을 겉결/속결 층위로 풀 결정론 재료 추가 (기존 spousePalaceHiddenStars 하위호환 유지)"
```

### Task 9: 양 프롬프트 긍정 예시 블록

**Files:**
- Modify: `lib/wealth-prompt.ts` (`SYSTEM_RULES` 말미, 블록 구조 앞), `lib/marriage-prompt.ts` (동일 위치)
- Test: `lib/wealth-prompt.test.ts`, `lib/marriage-prompt.test.ts` (추가)

**Interfaces:** Consumes/Produces 없음 — 프롬프트 문자열만. 단, **예시 문장이 각 모듈 후처리 금지 정규식에 절대 걸리지 않아야 함**(3-layer 정합) — 테스트로 고정.

- [ ] **Step 1: 실패 테스트 추가**

`lib/wealth-prompt.test.ts`:
```ts
import { applyWealthGuards } from "./wealth-postprocess";

test("긍정 예시 블록 존재 + 예시 문장이 가드 금지 패턴에 안 걸린다(3-layer)", () => {
  const p = buildWealthPrompt(baseFacts, "A", "사주텍스트");
  const m = p.match(/\[좋은 문장 예시[^\]]*\]([\s\S]*?)────/);
  assert.ok(m, "긍정 예시 블록 없음");
  const { violations } = applyWealthGuards({ probe: m![1] }, {}, "");
  assert.equal(violations.length, 0);
});
```

`lib/marriage-prompt.test.ts`: 동일 구조로 `applyMarriageGuards({ probe }, { maritalStatus: "솔로" }, "")` 검사.

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/wealth-prompt.test.ts lib/marriage-prompt.test.ts` → 신규 테스트 FAIL

- [ ] **Step 3: 구현 — wealth** (`SYSTEM_RULES` 말미, `[블록 구조...]` 구분선 직전에 삽입):

```
────────────────────────────────
[좋은 문장 예시 — 이 결을 따라 써라 (금지 규칙만큼 중요하다)]
아래는 "위치·시기·국면까지 짚는" 이 리포트의 목표 해상도다. 문장을 그대로 베끼지 말고 결만 따라라.
- 재성 진단(위치+방식): "월주에 편재가 떠 있어 — 네 벌이의 무대인 사회활동기에, 월급처럼 고정된
  돈보다 기회 따라 움직이는 돈이 붙는 그림이야. 그래서 남들보다 '판이 커지는 순간'을 잘 읽는 게
  네 재물운의 절반이거든."
- 그릇 진단(구조+대응 한 세트): "버는 힘은 충분한데 곳간 문단속이 관건인 구조야. 큰돈이 들어온
  달에 저축부터 떼어놓는 습관 하나면, 이 구조의 약점은 거의 지워져."
- 타이밍(연도+행동): "2028년은 재성이 들어오는 해라 돈이 움직일 여지가 커 — 새 기회가 보이면
  조건을 꼼꼼히 살펴보기 좋은 타이밍이야. 반대로 그 전 해엔 큰 지출 결정을 한 번 더 점검해."
```

**구현 — marriage** (동일 위치):

```
────────────────────────────────
[좋은 문장 예시 — 이 결을 따라 써라 (금지 규칙만큼 중요하다)]
아래는 "위치·층위·시기까지 짚는" 이 리포트의 목표 해상도다. 문장을 그대로 베끼지 말고 결만 따라라.
- 배우자궁(층위 활용): "일지 본기가 정관이라, 겉으로는 원칙 있고 듬직한 사람이 네 곁에 어울려.
  그런데 중기에 편인이 숨어 있어서 — 같이 살아보면 혼자만의 시간을 꽤 아끼는 속결이 보일 거야.
  그걸 서운함이 아니라 그 사람의 충전 방식으로 읽어주면 관계가 편해져."
- 배우자성(위치+시기): "배우자성이 월주에 떠 있으면 인연이 사회 활동 속에서 자연스럽게 이어지는
  그림이야 — 소개보다 일·모임 무대에서 만나는 인연에 더 힘이 실리거든."
- 타이밍(연도+행동): "2027년은 배우자궁이 움직이는 해야. 관계를 한 단계 정리하고 싶다면 이 해의
  흐름을 타는 게 자연스러워 — 미리 마음의 기준을 정해두면 좋아."
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/wealth-prompt.test.ts lib/marriage-prompt.test.ts`
Expected: PASS (Task 7 Step 4에서 보류한 긍정 예시 테스트 포함 전체)

- [ ] **Step 5: 프롬프트 스냅샷 갱신 + 커밋** (프로젝트 규칙: 프롬프트 수정 시 `prompts/history/` 버전 저장)

```bash
# prompts/history/wealth-v2.md / marriage-v2.md: 기존 v1을 복사하고 상단에
# "v1 대비: 궁위 라인·지장간 층위 라인·긍정 예시 블록 추가" diff 요약 + 변경 블록 원문 기재.
git add lib/wealth-prompt.ts lib/marriage-prompt.ts lib/wealth-prompt.test.ts lib/marriage-prompt.test.ts prompts/history/wealth-v2.md prompts/history/marriage-v2.md
git commit -m "feat(wealth,marriage): 프롬프트 긍정 예시 블록 — 금지 위주에서 목표 해상도 예시 제시로 보강, 예시 문장은 가드 정규식 통과를 테스트로 고정 (v2 스냅샷)"
```

**Phase 3 독립 산출물:** 이 Phase만으로 배포 가능 — 스키마·UI 무변경, 리포트 본문의 해상도(궁위 국면·배우자 층위)와 문장 품질(긍정 예시 앵커)이 올라간다.

---

# Phase 4 — 결정론 아키타입 + 강도 점수 정밀화

### Task 10: 강도 계산 공용화 + 결혼 배우자성 강도 신규

**Files:**
- Create: `lib/utils/star-strength.ts`
- Modify: `lib/wealth-facts.ts` (58-152행의 로컬 헬퍼를 공용 모듈 사용으로 교체 — **판정 로직·임계값 무변경**)
- Modify: `lib/marriage-facts.ts` (`spouseStarStrength: number` 추가)
- Test: `lib/wealth-facts.test.ts`(기존 실측값 9.25/11.5가 회귀 그물), `lib/marriage-facts.test.ts`(추가)

**Interfaces:**
- Produces:

```ts
// lib/utils/star-strength.ts
export const PILLARS: readonly ["year", "month", "day", "hour"];
export interface WeightedStarHit {
  pillar: "year" | "month" | "day" | "hour";
  source: "천간" | "지장간";
  star: string;
  weight: number;
}
export declare function bareStar(label: string): string;
export declare function tenStarOf(dayStem: string, targetStem: string): string | null;
export declare function collectWeightedHits(sajuData: SajuData, dayStem: string): WeightedStarHit[];
export declare function sumWeight(hits: WeightedStarHit[], starSet: Set<string>): number;
```

- `MarriageFacts`에 `spouseStarStrength: number;` (가중 합, 소수 2자리 반올림 — wealth `jaeseongStrength`와 동일 스케일·대칭 해소)

- [ ] **Step 1: 공용 모듈 생성** — `lib/wealth-facts.ts`의 `bareStar`(58-60), `tenStarOf`(63-68), `STEM_WEIGHT`/`JIJANGGAN_POSITION_WEIGHT`/`JIJANGGAN_FALLBACK_WEIGHT`/`MONTH_BRANCH_MULTIPLIER`(101-104), `WeightedHit`(106-111), `collectWeightedHits`(118-144), `sumWeight`(146-152)를 **주석 포함 그대로** `lib/utils/star-strength.ts`로 이동하고 export. `PILLARS`도 이동·export.

- [ ] **Step 2: wealth-facts 리팩토링** — 이동한 심볼을 import로 교체(로컬 정의 삭제). `deriveWealthFacts`·`detectBigeopTaljae` 등 판정 로직은 한 글자도 바꾸지 않는다.

- [ ] **Step 3: 회귀 확인**

Run: `node --import tsx --test lib/wealth-facts.test.ts`
Expected: PASS — 특히 `jaeseongStrength 9.25`·`11.5` 실측 고정 테스트가 그대로 통과(가중 모델 무변경 증명)

- [ ] **Step 4: 결혼 강도 실패 테스트** — `lib/marriage-facts.test.ts` 추가:

```ts
test("배우자성 강도(spouseStarStrength) — 가중 모델이 wealth와 동일 스케일로 산출된다", () => {
  // 남명 甲 일간: 배우자성=재성(토). hiddenChart 일지 戌 본기 戊(편재, weight 2) 등
  const enriched = enrichSajuData(hiddenChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, hiddenChart, "male", "솔로", 2026);
  assert.equal(typeof facts.spouseStarStrength, "number");
  assert.ok(facts.spouseStarStrength > 0);
  // 실측 고정: 구현 후 실제 값을 채워 회귀 그물로 만든다 (wealth 9.25 방식).
  // 구현 스텝에서 콘솔 실측 → 이 assert를 실측값으로 교체.
});
```

- [ ] **Step 5: 구현** — `lib/marriage-facts.ts`

```ts
import { collectWeightedHits, sumWeight } from "./utils/star-strength";
// deriveMarriageFacts 1) 단계 뒤에:
  // 1-1) 배우자성 강도(연속값) — wealth jaeseongStrength와 동일 가중 모델(비대칭 해소).
  // 판정 임계에는 아직 쓰지 않는다(기존 발화율 회귀 0) — 게이지·프롬프트 강약 근거로만.
  const spouseStarStrength =
    Math.round(sumWeight(collectWeightedHits(sajuData, dayStem), spouseSet) * 100) / 100;
```

return에 `spouseStarStrength` 추가. 인터페이스에 필드 추가.

- [ ] **Step 6: 실측값 고정 후 통과 확인** — 테스트를 한 번 실행해 콘솔로 실측값 확인, Step 4의 assert에 그 값을 박는다(예: `assert.equal(facts.spouseStarStrength, 5.5)` — 실측치로).

Run: `node --import tsx --test lib/marriage-facts.test.ts lib/wealth-facts.test.ts` → PASS

- [ ] **Step 7: 커밋**

```bash
git add lib/utils/star-strength.ts lib/wealth-facts.ts lib/marriage-facts.ts lib/marriage-facts.test.ts
git commit -m "feat(marriage): 배우자성 강도 연속값 신설 — wealth 가중 모델 공용화(star-strength.ts)로 비대칭 해소. wealth 판정·임계 무변경(실측 9.25/11.5 회귀 그물 통과)"
```

### Task 11: 결정론 아키타입 — 돈 그릇 유형 / 인연 유형

**Files:**
- Create: `lib/wealth-archetype.ts`, `lib/marriage-archetype.ts`
- Test: `lib/wealth-archetype.test.ts`, `lib/marriage-archetype.test.ts`

**Interfaces:**
- Consumes: `WealthFacts`, `MarriageFacts`
- Produces (Task 12 라우트·Task 13 UI·프롬프트가 소비):

```ts
export interface ArchetypeLabel { key: string; label: string; tagline: string; }
export declare function pickWealthArchetype(facts: WealthFacts): ArchetypeLabel;
export declare function pickMarriageArchetype(facts: MarriageFacts): ArchetypeLabel;
```

- [ ] **Step 1: 실패 테스트 작성** — `lib/wealth-archetype.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWealthArchetype } from "./wealth-archetype";
import { applyWealthGuards } from "./wealth-postprocess";

const base: any = {
  jaeseongType: "정재우세", jaeseongAbsent: false, jaeGrip: "신왕재왕",
  sikssangSaengjae: false, bigeopTaljae: false, gunggeobJaengjae: false,
};

test("분기 결정론: 대표 조합들이 서로 다른 유형으로 갈린다", () => {
  assert.equal(pickWealthArchetype({ ...base, jaeGrip: "재다신약" }).key, "MANAGER_FIRST");
  assert.equal(pickWealthArchetype({ ...base, bigeopTaljae: true }).key, "EARN_BIG_LEAK");
  assert.equal(pickWealthArchetype({ ...base, sikssangSaengjae: true }).key, "TYCOON");
  assert.equal(pickWealthArchetype({ ...base, jaeseongType: "무재", jaeseongAbsent: true, sikssangSaengjae: true }).key, "SELF_MADE");
  assert.equal(pickWealthArchetype({ ...base, jaeGrip: "신왕재쇠", gunggeobJaengjae: true }).key, "SHARE_GUARD");
});

test("모든 라벨·태그라인이 가드 금지 패턴에 안 걸린다(서열화·낙인 0)", () => {
  const combos = [
    base,
    { ...base, jaeGrip: "재다신약" }, { ...base, jaeGrip: "신왕재쇠" },
    { ...base, jaeGrip: "신약재소" }, { ...base, jaeseongType: "무재", jaeseongAbsent: true },
    { ...base, bigeopTaljae: true }, { ...base, sikssangSaengjae: true },
    { ...base, jaeGrip: "신왕재쇠", gunggeobJaengjae: true },
  ];
  for (const c of combos) {
    const a = pickWealthArchetype(c);
    const { violations } = applyWealthGuards({ probe: `${a.label}. ${a.tagline}` }, {}, "");
    assert.equal(violations.length, 0, `${a.key} 위반`);
  }
});
```

`lib/marriage-archetype.test.ts` — 동일 구조로 `pickMarriageArchetype` 대표 조합(무배우자성/손상+불안정/혼잡/안정/도화) 분기 + `applyMarriageGuards({probe}, {maritalStatus:"솔로"}, "")` 위반 0 검사.

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/wealth-archetype.test.ts lib/marriage-archetype.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `lib/wealth-archetype.ts`

```ts
// 돈 그릇 유형 — 서버 결정론 라벨 (pet pickLabelAndArchetype 패턴, lib/pet-compat-scoring.ts:362-407).
// LLM이 유형을 짓지 않는다: facts 조합 → 고정 라벨. 분기 순서가 우선순위다(위가 더 특수한 조합).
// 라벨 원칙: 서열화·낙인 금지(절대 규칙 3) — 모든 유형이 "경향+강점+관리 포인트" 톤.
import type { WealthFacts } from "./wealth-facts";

export interface ArchetypeLabel { key: string; label: string; tagline: string; }

export function pickWealthArchetype(
  facts: Pick<WealthFacts, "jaeseongType" | "jaeseongAbsent" | "jaeGrip" | "sikssangSaengjae" | "bigeopTaljae" | "gunggeobJaengjae">,
): ArchetypeLabel {
  if (facts.jaeseongAbsent) {
    return facts.sikssangSaengjae
      ? { key: "SELF_MADE", label: "맨손으로 파이프를 만드는 그릇", tagline: "타고난 재물보다 스스로 만드는 벌이가 무기" }
      : { key: "FLOW_RIDER", label: "흐름을 타고 차오르는 그릇", tagline: "원국보다 대운·세운의 물때가 중요한 타입" };
  }
  if (facts.jaeGrip === "재다신약") {
    return { key: "MANAGER_FIRST", label: "관리가 먼저인 큰물 그릇", tagline: "들어오는 물은 넉넉 — 담는 손이 승부처" };
  }
  if (facts.jaeGrip === "신왕재왕") {
    if (facts.bigeopTaljae)
      return { key: "EARN_BIG_LEAK", label: "크게 벌고 문단속하는 그릇", tagline: "버는 힘은 확실 — 새는 구멍만 막으면 완성" };
    if (facts.sikssangSaengjae)
      return { key: "TYCOON", label: "벌이와 그릇을 다 갖춘 그릇", tagline: "만드는 힘과 담는 힘이 같이 있는 드문 구조" };
    return { key: "SOLID_HOLDER", label: "들어온 돈을 단단히 쥐는 그릇", tagline: "쥐는 힘이 좋아 쌓이면 잘 안 흩어지는 타입" };
  }
  if (facts.jaeGrip === "신왕재쇠") {
    if (facts.gunggeobJaengjae)
      return { key: "SHARE_GUARD", label: "내 몫부터 챙겨야 하는 그릇", tagline: "나눠 갖는 판에선 조건을 문서로 — 그러면 단단해져" };
    if (facts.sikssangSaengjae)
      return { key: "BUILDER", label: "채워가는 재미가 있는 큰 그릇", tagline: "그릇이 커서 벌이 파이프를 늘릴수록 유리" };
    return { key: "SLOW_FILLER", label: "천천히 차오르는 큰 그릇", tagline: "속도보다 방향 — 길게 보면 유리한 구조" };
  }
  // 신약재소
  if (facts.jaeseongType === "정재우세")
    return { key: "STEADY_SAVER", label: "차곡차곡 쌓는 알뜰 그릇", tagline: "화려하진 않아도 새지 않는 게 최고 강점" };
  return { key: "COMPACT", label: "작지만 새지 않는 실속 그릇", tagline: "무리한 확장보다 꾸준함이 어울리는 구조" };
}
```

`lib/marriage-archetype.ts`:

```ts
// 인연 유형 — 서버 결정론 라벨. 분기 순서=우선순위. 라벨 원칙: 절대 규칙 3(예언·낙인 금지) 톤.
import type { MarriageFacts } from "./marriage-facts";
import type { ArchetypeLabel } from "./wealth-archetype";

export function pickMarriageArchetype(
  facts: Pick<MarriageFacts, "spouseStarAbsent" | "spouseStarDamaged" | "spousePalaceStability" | "gwansalHonjap" | "dohwa" | "hongyeom">,
): ArchetypeLabel {
  if (facts.spouseStarAbsent) {
    return { key: "FATE_FLOW", label: "때가 오면 급물살 타는 인연", tagline: "원국보다 대운·세운의 물때가 중요한 타입" };
  }
  if (facts.spouseStarDamaged && facts.spousePalaceStability === "불안정") {
    return { key: "TUNER", label: "맞춰가며 단단해지는 인연", tagline: "처음보다 함께한 시간이 관계를 완성하는 구조" };
  }
  if (facts.gwansalHonjap) {
    return { key: "HIGH_STANDARD", label: "기준이 분명해 고르는 인연", tagline: "책임감과 눈높이가 또렷한 타입 — 그게 강점" };
  }
  if (facts.spousePalaceStability === "안정" && !facts.spouseStarDamaged) {
    return { key: "ANCHOR", label: "뿌리 깊은 안정형 인연", tagline: "궁이 안정돼 관계가 오래 갈수록 힘이 붙는 구조" };
  }
  if (facts.dohwa || facts.hongyeom) {
    return { key: "MAGNET", label: "끌어당기는 매력형 인연", tagline: "인연이 먼저 다가오는 편 — 고르는 눈이 관건" };
  }
  return { key: "BALANCED", label: "잔잔히 흘러가는 균형형 인연", tagline: "큰 굴곡 없이 쌓아가는 관계가 어울리는 구조" };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/wealth-archetype.test.ts lib/marriage-archetype.test.ts` → PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/wealth-archetype.ts lib/marriage-archetype.ts lib/wealth-archetype.test.ts lib/marriage-archetype.test.ts
git commit -m "feat(wealth,marriage): 결정론 아키타입 라벨 — 돈 그릇 유형 10종·인연 유형 6종 (pet pickLabelAndArchetype 패턴, 전 라벨 가드 정규식 통과 테스트 고정)"
```

### Task 12: DB 컬럼 + 라우트 저장/응답 + 프롬프트 연결

**Files:**
- Create: `supabase/migrations/20260719_wealth_marriage_enrich.sql`
- Modify: `app/api/wealth/analyze/route.ts`(저장 payload 502-513행), `app/api/marriage/analyze/route.ts`(저장 payload), `app/api/wealth/results/route.ts`(SELECT_COLUMNS 16-17행 + 응답), `app/api/marriage/results/route.ts`(동일), `lib/wealth-prompt.ts`/`lib/marriage-prompt.ts`(fact 라인 1줄씩)

**Interfaces:**
- Produces: DB 컬럼 `wealth_results.jaeseong_strength numeric / bigeop_strength numeric / wealth_archetype text`, `marriage_results.spouse_star_strength numeric / marriage_archetype text`. GET 응답 신규 필드 `jaeseongStrength?: number; bigeopStrength?: number; archetype?: { key: string; label: string; tagline: string }` (wealth) / `spouseStarStrength?: number; archetype?: {...}` (marriage) — Task 13 UI가 소비. **아키타입 label/tagline은 응답에서 재계산이 아니라 full_json에 저장분 사용**(아래).

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260719_wealth_marriage_enrich.sql
-- Phase 4: 연속 강도값 + 결정론 아키타입 저장.
-- 기존 row는 null 유지(하위호환) — UI·프롬프트는 null이면 기존 enum 폴백.
alter table public.wealth_results
  add column if not exists jaeseong_strength numeric,
  add column if not exists bigeop_strength numeric,
  add column if not exists wealth_archetype text;   -- ArchetypeLabel.key
alter table public.marriage_results
  add column if not exists spouse_star_strength numeric,
  add column if not exists marriage_archetype text; -- ArchetypeLabel.key

comment on column public.wealth_results.jaeseong_strength is '재성 weighted 강도(lib/utils/star-strength.ts) — 게이지 연속값 원본';
comment on column public.marriage_results.spouse_star_strength is '배우자성 weighted 강도 — 게이지 연속값 원본';
```

- [ ] **Step 2: wealth analyze 저장/병합 수정**

Task 5에서 넣은 serverTimeline 병합 바로 아래에 추가:

```ts
      const archetype = pickWealthArchetype(facts);
      blocks.serverArchetype = archetype; // {key,label,tagline} — 렌더용(LLM 산문 아님)
```

update payload에 추가:

```ts
          jaeseong_strength: facts.jaeseongStrength,
          bigeop_strength: facts.bigeopStrength,
          wealth_archetype: archetype.key,
```

프롬프트 연결 — `buildWealthPrompt` 호출 전에 archetype을 계산해야 하므로 위 계산을 Gemini 호출 **이전**(facts 산출 직후)으로 옮기고, `lib/wealth-prompt.ts`에서 `pickWealthArchetype(facts)`를 직접 호출해 fact 라인 추가:

```ts
// lib/wealth-prompt.ts
import { pickWealthArchetype } from "./wealth-archetype";
// buildFactBlock lines 배열에 추가(지역 상수로 1회 계산):
    `돈 그릇 유형(서버 결정 라벨 — 리포트 결이 이 유형과 모순되면 안 됨, 라벨 자체를 인용해도 좋음): ${pickWealthArchetype(facts).label} — ${pickWealthArchetype(facts).tagline}`,
```

- [ ] **Step 3: marriage analyze 동일 수정** — `pickMarriageArchetype(facts)` → `blocks.serverArchetype`, update payload에 `spouse_star_strength: facts.spouseStarStrength, marriage_archetype: archetype.key`, `lib/marriage-prompt.ts` buildFactBlock에:

```ts
    `인연 유형(서버 결정 라벨 — 리포트 결이 이 유형과 모순되면 안 됨): ${pickMarriageArchetype(facts).label} — ${pickMarriageArchetype(facts).tagline}`,
    `배우자성 강도(가중 점수 — 절대값 언급 말고 강약 판단 근거로만): ${facts.spouseStarStrength}`,
```

- [ ] **Step 4: GET 라우트 확장**

`app/api/wealth/results/route.ts`:
```ts
const SELECT_COLUMNS =
  "id, user_id, interest, wealth_grade, jaeseong_type, jaeda_shinyak, sikssang_saengjae, gunggeob_jaengjae, jae_grip, jaeseong_strength, bigeop_strength, wealth_archetype, teaser_json, full_json, created_at";
// completed 응답에 추가:
      jaeseongStrength: row.jaeseong_strength,
      bigeopStrength: row.bigeop_strength,
```
`app/api/marriage/results/route.ts` 동일하게 `spouse_star_strength, marriage_archetype` 추가 + 응답 `spouseStarStrength: row.spouse_star_strength`.

- [ ] **Step 5: 정합성 검증 + 빌드**
  - 3-layer 체크: 프롬프트 fact 라인(라벨) ↔ 렌더(`blocks.serverArchetype`) ↔ DB(`*_archetype` key)가 **모두 같은 `pickXxxArchetype(facts)` 진실원**에서 나오는지 diff 확인.
  - 프롬프트 테스트 추가(`lib/wealth-prompt.test.ts`): `assert.ok(p.includes("돈 그릇 유형"))`. marriage 동일.
  - Run: `node --import tsx --test lib/wealth-prompt.test.ts lib/marriage-prompt.test.ts` → PASS, `npx next build` → 성공.
  - 마이그레이션 적용은 배포 절차에서 운영자 승인 후(`feedback_deploy_checklist` — 2차 영향: 기존 row null 폴백 확인).

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260719_wealth_marriage_enrich.sql app/api/wealth/analyze/route.ts app/api/marriage/analyze/route.ts app/api/wealth/results/route.ts app/api/marriage/results/route.ts lib/wealth-prompt.ts lib/marriage-prompt.ts lib/wealth-prompt.test.ts lib/marriage-prompt.test.ts
git commit -m "feat(wealth,marriage): 아키타입·연속 강도 저장/응답/프롬프트 배선 — 단일 진실원(pickArchetype·facts 강도), 기존 row는 null 폴백"
```

### Task 13: UI — 아키타입 칩 + 연속 게이지

**Files:**
- Modify: `app/wealth/result/WealthResultClient.tsx` (`ApiResponse` 65-79행, `WealthBlocks`, 게이지 601-633행, ② 섹션)
- Modify: `app/marriage/result/MarriageResultClient.tsx` (`ApiResponse` 54-67행, `MarriageBlocks`, `deriveStarGauge` 587행 인근, ② 섹션)

**Interfaces:**
- Consumes: Task 12의 GET 응답 필드(`jaeseongStrength`/`spouseStarStrength`)와 `result.serverArchetype`.
- Produces: 없음(리프 UI).

- [ ] **Step 1: 타입 추가**

```ts
// WealthBlocks / MarriageBlocks:
  serverArchetype?: { key: string; label: string; tagline: string };
// Wealth ApiResponse: jaeseongStrength?: number | null; bigeopStrength?: number | null;
// Marriage ApiResponse: spouseStarStrength?: number | null;
```

- [ ] **Step 2: 연속 게이지 — wealth** (`deriveJaeseongStrengthGauge` 교체가 아니라 **연속값 우선 + 기존 enum 폴백**):

```ts
// 연속 강도(jaeseong_strength 컬럼, Phase 4 신규 결제분부터 존재)가 있으면 그 값으로,
// 없으면(과거 결제분) 기존 enum 고정 포지션으로. 12 = 실측 상위권 강도(테스트 고정값 11.5)
// 기준의 투영 상수 — 서버 숫자를 픽셀로 옮기는 결정론 사상일 뿐 새 숫자 생성이 아니다.
const STRENGTH_GAUGE_MAX = 12;
function strengthToGaugeValue(strength: number): number {
  return Math.max(6, Math.min(96, Math.round((strength / STRENGTH_GAUGE_MAX) * 100)));
}

function deriveJaeseongStrengthGauge(
  jaeseongType: "정재우세" | "편재우세" | "재성혼재" | "무재",
  jaeGrip: WealthGrip | undefined,
  strength?: number | null,
): { value: number; verdict: string } {
  if (jaeseongType === "무재") return { value: 10, verdict: "재성이 없어 — 그릇으로 보자" };
  if (typeof strength === "number" && Number.isFinite(strength)) {
    const strong = jaeGrip === "신왕재왕" || jaeGrip === "재다신약";
    return { value: strengthToGaugeValue(strength), verdict: strong ? "재성이 뚜렷하게 강해" : "재성이 차분한 편이야" };
  }
  // 폴백(과거 결제분): 기존 enum 고정 포지션 유지
  if (jaeGrip === "신왕재왕" || jaeGrip === "재다신약") return { value: 85, verdict: "재성이 뚜렷하게 강해" };
  if (jaeGrip === "신왕재쇠" || jaeGrip === "신약재소") return { value: 35, verdict: "재성이 차분한 편이야" };
  return { value: 50, verdict: "결이 섞여 있어" };
}
```

호출부: `deriveJaeseongStrengthGauge(jaeseongType, jaeGrip, data.jaeseongStrength)`.

- [ ] **Step 3: 연속 게이지 — marriage** — `deriveStarGauge`에 동일 패턴으로 `strength?: number | null` 3번째 인자 추가(연속값 있으면 `strengthToGaugeValue`, verdict는 기존 문구 유지, 없으면 기존 3단 고정 포지션). `strengthToGaugeValue`·`STRENGTH_GAUGE_MAX`를 marriage 파일에도 인라인 복사(파일 인라인 원칙).

- [ ] **Step 4: 아키타입 칩** — 양 파일 ② 섹션의 게이지 박스 바로 위에:

```tsx
            {result.serverArchetype && (
              <div className="mt-6 rounded-2xl bg-background-tertiary px-5 py-4">
                <div className="text-[12px] font-semibold text-text-tertiary mb-1">
                  {/* wealth: "나의 돈 그릇 유형" / marriage: "나의 인연 유형" */}
                  나의 돈 그릇 유형
                </div>
                <div className="text-[17px] font-bold text-text-primary break-keep">
                  {result.serverArchetype.label}
                </div>
                <p className="mt-1 text-[13.5px] text-text-secondary break-keep">
                  {result.serverArchetype.tagline}
                </p>
              </div>
            )}
```

- [ ] **Step 5: 빌드 확인 + 커밋**

Run: `npx next build` → 성공

```bash
git add app/wealth/result/WealthResultClient.tsx app/marriage/result/MarriageResultClient.tsx
git commit -m "feat(wealth,marriage): 아키타입 칩 + 연속 강도 게이지 — 신규 결제분은 서버 연속값, 과거 결제분은 기존 enum 포지션 폴백"
```

**Phase 4 독립 산출물:** 이 Phase만으로 배포 가능(마이그레이션 적용 필수) — 결과지 상단에 결정론 유형 라벨이 붙고, 게이지가 enum 3~4단 고정에서 연속값으로 정밀해진다. 결혼운 배우자성 강도 비대칭도 해소.

---

# Phase 5 — 분량 범위 상향 (연료 보강 후에만·맨 마지막)

### Task 14: 총량 soft 하한 + 채움경로 + 분량 범위 상향

**Files:**
- Modify: `lib/wealth-postprocess.ts` (`validateWealthRichness` 신설), `lib/marriage-postprocess.ts` (`validateMarriageRichness` 신설)
- Modify: `lib/wealth-prompt.ts` `OUTPUT_SCHEMA`(303-306행), `lib/marriage-prompt.ts` `OUTPUT_SCHEMA`(220-223행)
- Modify: `app/api/wealth/analyze/route.ts`, `app/api/marriage/analyze/route.ts` (`generateWithQaRegen`에 `softValidate` 공급 — Task 1에서 이미 시그니처 존재)
- Test: `lib/wealth-postprocess.test.ts`, `lib/marriage-postprocess.test.ts` (추가)

**Interfaces:**
- Produces: `export function validateWealthRichness(blocks: any): string[]` / `export function validateMarriageRichness(blocks: any): string[]` — 이슈 문자열에 **채움경로를 직접 명시**(재생성 프롬프트에 그대로 실림). soft 전용: 최종 출고를 막지 않음(`REQUIRED_TEXT_BLOCKS` 하한은 그대로 hard).

- [ ] **Step 1: 실패 테스트 추가** — `lib/wealth-postprocess.test.ts`:

```ts
import { validateWealthRichness } from "./wealth-postprocess";

test("본문 총량이 얇으면 채움경로가 명시된 이슈 반환 (soft — 재생성용)", () => {
  const thin = {
    jaeseongDiagnosis: "짧다.", jaeGripDiagnosis: "짧다.",
    savingStyle: "짧다.", riskAndPace: "짧다.", timingFlow: "짧다.",
  };
  const issues = validateWealthRichness(thin);
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes("궁위"));      // 채움경로 1
  assert.ok(issues[0].includes("타이밍"));    // 채움경로 2
  assert.ok(issues[0].includes("패러프레이즈")); // 같은 말 반복 금지 명시
});

test("총량 충분하면 이슈 없음", () => {
  const fat = Object.fromEntries(
    ["jaeseongDiagnosis","jaeGripDiagnosis","savingStyle","riskAndPace","timingFlow"]
      .map((k) => [k, "가".repeat(400)]),
  );
  assert.equal(validateWealthRichness(fat).length, 0);
});
```

`lib/marriage-postprocess.test.ts`에도 동일 구조(`validateMarriageRichness`, 채움경로에 "지장간"·"타이밍" 포함 검사).

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/wealth-postprocess.test.ts lib/marriage-postprocess.test.ts` → 신규 FAIL

- [ ] **Step 3: 구현**

`lib/wealth-postprocess.ts` 하단:

```ts
// Phase 5: 총량 soft 하한 — REQUIRED_TEXT_BLOCKS(빈 리포트 방지 hard 하한)와 별개로,
// "채워졌지만 얇은" 리포트를 QA 재생성 루프(softValidate)로 한 번 더 쓰게 만든다.
// 원칙: 분량은 재료(궁위·타이밍)로만 늘린다 — 이슈 문장 자체가 재생성 프롬프트에 실리므로
// 채움경로를 여기 명시한다. 최종 출고는 절대 막지 않는다(환불 사유 아님).
const WEALTH_PROSE_KEYS = ["jaeseongDiagnosis", "jaeGripDiagnosis", "savingStyle", "riskAndPace", "timingFlow"] as const;
const WEALTH_RICHNESS_MIN_TOTAL = 1600; // 5블록 합 (상향된 목표범위 350~550×5의 바닥 근처)

export function validateWealthRichness(blocks: any): string[] {
  const total = WEALTH_PROSE_KEYS.reduce(
    (sum, k) => sum + (typeof blocks?.[k] === "string" ? blocks[k].trim().length : 0), 0);
  if (total >= WEALTH_RICHNESS_MIN_TOTAL) return [];
  return [
    `본문 5블록 총량 부족(${total}자 < ${WEALTH_RICHNESS_MIN_TOTAL}자) — 같은 말 반복·패러프레이즈로 늘리지 말고, [재성 궁위 해석]의 인생 국면 번역과 [타이밍 창]·[대운 중 재성이 들어오는 구간]의 구체 연도를 근거로 각 블록에 1~2문장씩 새 정보를 추가하라`,
  ];
}
```

`lib/marriage-postprocess.ts` 하단(동일 구조):

```ts
const MARRIAGE_PROSE_KEYS = ["spousePalace", "spouseStar", "partnerProfile", "relationshipPattern", "timingFlow"] as const;
const MARRIAGE_RICHNESS_MIN_TOTAL = 1600;

export function validateMarriageRichness(blocks: any): string[] {
  const total = MARRIAGE_PROSE_KEYS.reduce(
    (sum, k) => sum + (typeof blocks?.[k] === "string" ? blocks[k].trim().length : 0), 0);
  if (total >= MARRIAGE_RICHNESS_MIN_TOTAL) return [];
  return [
    `본문 5블록 총량 부족(${total}자 < ${MARRIAGE_RICHNESS_MIN_TOTAL}자) — 같은 말 반복·패러프레이즈로 늘리지 말고, [일지 지장간 구조]의 본기/중기/여기 층위와 [타이밍 창]·[대운 중 배우자성이 들어오는 구간]의 구체 연도를 근거로 각 블록에 1~2문장씩 새 정보를 추가하라`,
  ];
}
```

- [ ] **Step 4: 라우트 배선** — 양 analyze의 `generateWithQaRegen` 옵션에 한 줄씩:

```ts
        softValidate: (b) => validateWealthRichness(b),
// marriage:
        softValidate: (b) => validateMarriageRichness(b),
```

- [ ] **Step 5: 분량 범위 상향** — `lib/wealth-prompt.ts` `OUTPUT_SCHEMA` 303-304행 교체:

```
- gradeHeadline: **35자 이내 한 문장**(화면 최상단 대표 문구, 짧고 임팩트). jaeseongDiagnosis·jaeGripDiagnosis: 각 350~500자.
- 관심사별 3블록(savingStyle·riskAndPace·timingFlow): 각 400~550자.
- ★늘어난 분량은 반드시 새 정보(궁위 국면·구체 연도·대운 구간)로 채워라 — 같은 진단을 다른 말로
  반복해 분량을 채우면 실패다.
```

`lib/marriage-prompt.ts` `OUTPUT_SCHEMA` 220-221행 동일 패턴(spousePalace·spouseStar 350~500, 상태별 3블록 400~550, "지장간 층위·구체 연도로 채워라" 문구).

★주의: `REQUIRED_TEXT_BLOCKS`의 hard 하한(80자)은 올리지 않는다 — 상향 실패가 환불로 이어지면 안 됨(soft만 재생성 유발).

- [ ] **Step 6: 통과 확인 + 빌드**

Run: `node --import tsx --test lib/wealth-postprocess.test.ts lib/marriage-postprocess.test.ts lib/qa-regen.test.ts` → PASS. `npx next build` → 성공.

- [ ] **Step 7: 프롬프트 스냅샷(v3) + 커밋**

```bash
git add lib/wealth-postprocess.ts lib/marriage-postprocess.ts lib/wealth-prompt.ts lib/marriage-prompt.ts lib/wealth-postprocess.test.ts lib/marriage-postprocess.test.ts app/api/wealth/analyze/route.ts app/api/marriage/analyze/route.ts prompts/history/wealth-v3.md prompts/history/marriage-v3.md
git commit -m "feat(wealth,marriage): 분량 범위 상향 + 총량 soft 하한 — 채움경로(궁위/타이밍/지장간)를 재생성 지시에 명시, hard 하한·환불 경로 무변경 (연료 보강 완료 후 마지막 단계)"
```

**Phase 5 독립 산출물:** 이 Phase만으로 배포 가능 — 얇은 리포트는 채움경로가 명시된 지시로 1회 재생성되고, 목표 분량이 "새 재료 강제" 문구와 세트로 상향된다.

---

## 최종 검증 (전체 완료 후)

- [ ] 전체 테스트: `node --import tsx --test lib/qa-regen.test.ts lib/fortune-timeline.test.ts lib/wealth-facts.test.ts lib/marriage-facts.test.ts lib/wealth-prompt.test.ts lib/marriage-prompt.test.ts lib/wealth-postprocess.test.ts lib/marriage-postprocess.test.ts lib/wealth-grade.test.ts lib/marriage-grade.test.ts lib/wealth-consistency.test.ts lib/marriage-consistency.test.ts lib/wealth-archetype.test.ts lib/marriage-archetype.test.ts` → 전부 PASS
- [ ] `npx next build` 성공 (dev 서버 종료 상태)
- [ ] 실 리포트 1건 육안 검수(스테이징/로컬 + 본인 사주): 타임라인 연도가 세운과 일치하는지, 아키타입 라벨·게이지·본문이 서로 모순 없는지, "다시 혼자"로 결혼운 1건 생성해 재혼 문맥이 살아있는지
- [ ] 배포·마이그레이션 적용은 운영자 명시 승인 후 (`feedback_generation_approval`은 해당 없음 — 유료 외부 생성 없음. 단 검수용 analyze 1~2회는 Gemini 호출 발생을 사전 고지)

---

## Self-Review

**1. 스펙 커버리지**
- 진단 1(facts 해상도) → Task 7(궁위)·8(지장간 층위)·10(배우자성 강도 신규 — 비대칭 해소)·12(프롬프트 라인). ✅
- 진단 2(결정론 리치요소 0 렌더·연속값 미저장) → Task 4~6(타임라인)·11~13(아키타입+연속 게이지, DB 저장). ✅
- 진단 3(삭제만 하는 후처리) → Task 1~3(펫 604-634 패턴 이식, 결혼 `/재혼/`·`/사별/` 구멍 Task 2 해소). ✅
- 진단 4(금지 위주 프롬프트) → Task 9(긍정 예시). ✅
- Phase 순서 = 확정 순서(1 QA → 2 타임라인 → 3 프롬프트/구조화 → 4 아키타입/강도 → 5 분량 마지막). 타임라인 축 12개월→향후 5년+과거 1칸, 엔진 무변경, yearly UI 재활용 — 반영. ✅
- 핵심 원칙: 분량은 Phase 5에서만·채움경로 세트, LLM 숫자 생성 0, 개인사주 재탕 금지(모듈 고유 축), 소재는 엔진→facts 경로만. ✅

**2. Placeholder 스캔** — "TBD"·"적절히"·"위와 유사" 없음. 미확정 값 2곳은 의도된 실측 고정 절차(Task 10 Step 4 spouseStarStrength 실측값 — 기존 9.25/11.5 관행)와 marriage 라우트 기존 에러 문구 재사용(원문 보존). ✅

**3. 타입 정합성**
- `generateWithQaRegen`의 `softValidate`(Task 1) ↔ Task 14 공급. ✅
- `ServerTimeline`(Task 4) ↔ 클라이언트 `ServerTimelineView`(Task 6) 필드 1:1. ✅
- `ArchetypeLabel`은 `lib/wealth-archetype.ts` 단일 정의, marriage import. `blocks.serverArchetype` ↔ `result.serverArchetype` 키 일치. ✅
- GET 응답 필드(`jaeseongStrength`/`spouseStarStrength`) ↔ `ApiResponse` ↔ 게이지 3번째 인자 일치. ✅
- 발견·수정: (a) Task 7 긍정 예시 테스트가 Task 9 전 FAIL하는 순서 → Task 7 Step 4를 `--test-name-pattern` 부분 실행으로 명시. (b) 타임라인 힌트·아키타입 라벨의 가드 정규식 위험 → 3-layer 정합 테스트(Task 4 Step 5, Task 9 Step 1, Task 11 Step 1)로 고정.
