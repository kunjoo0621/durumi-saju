# 결혼운/애정운 심층 검사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개인사주와 동일한 원국을 확대해 결혼·애정 영역만 심층 분석하는 독립 유료 검사(파일럿 1호)를 today/yearly 패턴으로 추가한다.

**Architecture:** 결정론 엔진(`deriveMarriageFacts`)이 기존 enrichment/fortune 프리미티브를 조합해 배우자성·배우자궁·타이밍 사실을 뽑고 → Gemini 프롬프트가 그 사실의 *조합 해석만* 생성 → postprocess가 차별화·여명 안전장치·근거태그를 강제한다. 라우트·테이블·결제·결과표는 today/yearly/pet의 검증된 패턴을 미러한다.

**Tech Stack:** Next.js 15 + TypeScript, Gemini API(`@google/generative-ai`, **Claude 아님**), Supabase(PostgreSQL + RLS, `supabaseAdmin` service role), Zustand, Tailwind. 유닛테스트 = Node 24 내장 `node --import tsx --test` (신규 의존성 없음).

## Global Constraints

- **Gemini API 사용** — Claude API로 착각 금지 (CLAUDE.md).
- API 에러 응답에 `error.message` 노출 금지 → 일반 한국어 메시지만, 상세는 `console.error`.
- 배포 전 `npx next build` 성공 필수. **dev 서버 돌 때 build 금지**(청크 충돌).
- 코인 차감은 **멱등** + 분석 실패 시 **환불** (과거 18회 중복충전 사고 기준).
- 모든 테이블 **RLS enable** — API는 전부 `supabaseAdmin` 사용.
- 결과표는 `docs/DESIGN_SYSTEM.md`(H.DOT 토큰) + `app/pet/result/PetResultClient.tsx` 스크롤 내러티브 패턴 준수. 시니어 가독성(큰 글씨·고대비·한 번에 하나).
- 명리 fabrication 0 — LLM은 엔진이 준 사실만 해석. 홍란/천희·과숙살·고신살·상부살 금지.
- 여명 안전장치(§ 스펙 6): 이혼·사별·외도 예언 금지, 극(剋)=소통패턴 재해석, 만혼=향후 창 필수.
- Gemini 프롬프트 수정 시 `prompts/history/`에 버전 저장.
- 작업 브랜치: `feat/marriage-luck-test` (이미 생성됨, main 기준).
- 스펙 원본: `docs/superpowers/specs/2026-07-18-marriage-luck-test-design.md`.

---

## File Structure

**신규 생성:**
- `lib/marriage-facts.ts` — 결정론 엔진 + 타입 (`MarriageFacts`, `deriveMarriageFacts`)
- `lib/marriage-facts.test.ts` — 엔진 유닛테스트
- `lib/marriage-grade.ts` — 연애운 점수 → 결혼운 등급 밴드 결정론 매핑
- `lib/marriage-grade.test.ts` — 매핑 유닛테스트
- `lib/marriage-prompt.ts` — Gemini 프롬프트 빌더 (상태 적응형)
- `lib/marriage-postprocess.ts` — 품질 가드 (차별화·근거태그·여명 안전장치·금지신살)
- `lib/marriage-postprocess.test.ts` — 가드 유닛테스트
- `lib/marriage-consistency.ts` — 메인 result와 등급/사실 불일치 검증 helper
- `lib/marriage-consistency.test.ts` — 일관성 유닛테스트
- `lib/share-marriage.ts` — OG 공유 카드 (share-yearly 미러)
- `supabase/migrations/20260718_marriage_results.sql` — 테이블 + unlocks + RLS
- `app/api/marriage/from-primary/route.ts` — primary에서 사실 조립
- `app/api/marriage/start/route.ts` — 결과 row 생성(teaser)
- `app/api/marriage/analyze/route.ts` — 멱등 차감 + Gemini + postprocess + 환불
- `app/api/marriage/results/route.ts` — 단건 fetch
- `app/api/marriage/list/route.ts` — 목록
- `app/marriage/page.tsx` — 진입 클라이언트
- `app/marriage/input/page.tsx` — 관계상태 4분법 프리필+원탭 확인
- `app/marriage/result/page.tsx` + `app/marriage/result/MarriageResultClient.tsx` — 결과표

**수정:**
- `lib/constants/coins.ts` — `MARRIAGE_COST = 10` 추가
- `app/menu/page.tsx`(또는 `MenuDrawer.tsx`) — 검사 카드/엔트리 추가
- `app/page.tsx` — 홈 검사 카드 1개 추가

---

## Interfaces (핵심 타입 — 여러 태스크가 공유)

```ts
// lib/marriage-facts.ts 가 export
export type MaritalStatus = "솔로" | "연애중" | "기혼" | "다시 혼자";

export interface SpouseStarHit {
  pillar: "year" | "month" | "day" | "hour";
  source: "천간" | "지장간";
  star: "정관" | "편관" | "정재" | "편재";
}

export interface TimingWindow {
  year: number;          // 서기 연도
  age: number;
  triggers: Array<"세운합일지" | "배우자성투출" | "도화홍염">;
  isPast: boolean;       // 올해 기준 과거인지
}

export interface MarriageFacts {
  sex: "male" | "female";
  maritalStatus: MaritalStatus;
  dayStem: string;                 // 일간 한자 (예: "癸")
  dayBranch: string;               // 일지 한자 (예: "未")
  spouseStarType: "관성" | "재성"; // 여=관성, 남=재성
  spouseStars: SpouseStarHit[];    // 원국 전체에서 탐지된 배우자성
  spouseStarAbsent: boolean;       // 무관/무재
  gwansalHonjap: boolean;          // 배우자성 정+편 혼재
  spousePalaceHiddenStars: string[]; // 일지 지장간 십성 (배우자 숨은 성격)
  dayBranchHap: string[];          // 일지가 낀 합 (문자쌍)
  dayBranchChung: string[];        // 일지가 낀 충
  dayBranchGongmang: boolean;      // 일지 공망
  dohwa: boolean;                  // 도화 존재
  hongyeom: boolean;               // 홍염 존재
  timingWindows: TimingWindow[];   // 향후+최근 인연/결혼 활성 시기
  daeunSpouseYears: Array<{ startAge: number; endAge: number; star: string }>; // 무관/무재 폴백용
}

export function deriveMarriageFacts(
  enriched: EnrichedSajuData,   // from lib/utils/saju-enrichment
  fortune: FortuneResult | null, // from lib/utils/saju-fortune
  sajuData: SajuData,            // from lib/utils/saju
  sex: "male" | "female",
  maritalStatus: MaritalStatus,
  currentYear: number,
): MarriageFacts;
```

기존 엔진 프리미티브(확인됨, 재사용):
- `getTenStar(dmElement, dmYinYang, targetElement, targetYinYang): string` → `"정관(正官)"` 형식. `lib/utils/saju-enrichment.ts`.
- `STEM_ELEMENT[stem] = { element, yin_yang, korean }`, `BRANCH_INFO[branch].jijanggan = [{stem, weight}]`.
- `getPairRelation(branchA, branchB): { type: string; ... }` — 합/충 판정.
- `EnrichedSajuData.shinsal.matches[]` = `{ key, label, type, detectedAt: PillarPosition[] }`. 공망 key=`"gongmang"`, 도화 label 포함 `"도화"`, 홍염 label 포함 `"홍염"`.
- `EnrichedSajuData.relationships = { hap: string[], chung: string[], hyung: string[] }`.
- `FortuneResult.seun: SeunEntry[]{ year, age, stem, branch, tenStar, twelveStage }`, `.daeun.pillars: DaeunEntry[]{ startAge, endAge, stem, branch, tenStar }`.
- 조립: `calculateSaju(y,m,d,h,min,{birthLocation})` → `enrichSajuData(saju,{isTimeUnknown})` → `calculateFortune({...})`. 참조 구현 `lib/analysis.ts:2354-2372`.

---

## Task 1: 결정론 엔진 `deriveMarriageFacts` — 배우자성·배우자궁·혼잡

**Files:**
- Create: `lib/marriage-facts.ts`
- Test: `lib/marriage-facts.test.ts`

**Interfaces:**
- Consumes: `EnrichedSajuData`, `SajuData`(saju-enrichment/saju), `getTenStar`, `STEM_ELEMENT`, `BRANCH_INFO`.
- Produces: `MarriageFacts`(위 정의)의 배우자성·혼잡·일지 관련 필드. 타이밍 필드는 Task 2에서 채운다.

- [ ] **Step 1: 실패 테스트 작성** — 여명에서 관성(정관) 탐지 + 관살혼잡 판정

```ts
// lib/marriage-facts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMarriageFacts } from "./marriage-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";

// 일간 甲(목/양). 辛(금/음)=정관, 庚(금/양)=편관 → 관살혼잡. 여명.
const chart: SajuData = {
  year:  { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },       // 辛=정관
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚","壬","戊"] }, // 庚=편관
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },        // 일간 甲, 일지 子
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
};

test("여명: 정관+편관 존재 → 관성 배우자성 탐지 + 관살혼잡", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  assert.equal(facts.spouseStarType, "관성");
  assert.equal(facts.spouseStarAbsent, false);
  assert.equal(facts.gwansalHonjap, true);
  assert.ok(facts.spouseStars.some((s) => s.star === "정관"));
  assert.ok(facts.spouseStars.some((s) => s.star === "편관"));
});

test("남명: 재성이 배우자성", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "male", "기혼", 2026);
  assert.equal(facts.spouseStarType, "재성");
});

test("일지 지장간 십성 산출", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  // 일지 子 지장간 癸(수/음) vs 일간 甲(목/양) → 정인
  assert.ok(facts.spousePalaceHiddenStars.includes("정인"));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --import tsx --test lib/marriage-facts.test.ts`
Expected: FAIL — `deriveMarriageFacts is not a function` / 모듈 없음.

- [ ] **Step 3: 엔진 구현 (배우자성·혼잡·일지 파트)**

```ts
// lib/marriage-facts.ts
import {
  STEM_ELEMENT,
  BRANCH_INFO,
  getTenStar,
  getPairRelation,
  type EnrichedSajuData,
} from "./utils/saju-enrichment";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

export type MaritalStatus = "솔로" | "연애중" | "기혼" | "다시 혼자";
export interface SpouseStarHit { pillar: "year"|"month"|"day"|"hour"; source: "천간"|"지장간"; star: "정관"|"편관"|"정재"|"편재"; }
export interface TimingWindow { year: number; age: number; triggers: Array<"세운합일지"|"배우자성투출"|"도화홍염">; isPast: boolean; }
export interface MarriageFacts {
  sex: "male"|"female"; maritalStatus: MaritalStatus;
  dayStem: string; dayBranch: string;
  spouseStarType: "관성"|"재성"; spouseStars: SpouseStarHit[]; spouseStarAbsent: boolean;
  gwansalHonjap: boolean; spousePalaceHiddenStars: string[];
  dayBranchHap: string[]; dayBranchChung: string[]; dayBranchGongmang: boolean;
  dohwa: boolean; hongyeom: boolean;
  timingWindows: TimingWindow[];
  daeunSpouseYears: Array<{ startAge: number; endAge: number; star: string }>;
}

// "정관(正官)" → "정관"
function bareStar(label: string): string { return label.replace(/\(.*\)/, ""); }

// 일간 기준 target 천간이 어떤 십성인지 (bare)
function tenStarOf(dayStem: string, targetStem: string): string | null {
  const dm = STEM_ELEMENT[dayStem]; const t = STEM_ELEMENT[targetStem];
  if (!dm || !t) return null;
  return bareStar(getTenStar(dm.element, dm.yin_yang, t.element, t.yin_yang));
}

const PILLARS = ["year","month","day","hour"] as const;

export function deriveMarriageFacts(
  enriched: EnrichedSajuData,
  fortune: FortuneResult | null,
  sajuData: SajuData,
  sex: "male"|"female",
  maritalStatus: MaritalStatus,
  currentYear: number,
): MarriageFacts {
  const dayStem = sajuData.day.heavenlyStem;
  const dayBranch = sajuData.day.earthlyBranch;
  const spouseSet = sex === "female"
    ? new Set(["정관","편관"]) : new Set(["정재","편재"]);
  const spouseStarType = sex === "female" ? "관성" : "재성";

  // 1) 배우자성 탐지 (천간 투출 + 지장간)
  const spouseStars: SpouseStarHit[] = [];
  for (const pos of PILLARS) {
    const pillar = sajuData[pos];
    if (!pillar?.heavenlyStem) continue;
    const st = tenStarOf(dayStem, pillar.heavenlyStem);
    if (st && spouseSet.has(st)) spouseStars.push({ pillar: pos, source: "천간", star: st as SpouseStarHit["star"] });
    for (const hidden of pillar.hiddenStems ?? []) {
      const hs = tenStarOf(dayStem, hidden);
      if (hs && spouseSet.has(hs)) spouseStars.push({ pillar: pos, source: "지장간", star: hs as SpouseStarHit["star"] });
    }
  }
  const spouseStarAbsent = spouseStars.length === 0;
  const jeong = sex === "female" ? "정관" : "정재";
  const pyeon = sex === "female" ? "편관" : "편재";
  const gwansalHonjap = spouseStars.some(s => s.star === jeong) && spouseStars.some(s => s.star === pyeon);

  // 2) 일지 지장간 십성 (배우자 숨은 성격)
  const dayHidden = BRANCH_INFO[dayBranch]?.jijanggan ?? [];
  const spousePalaceHiddenStars = dayHidden
    .map(h => tenStarOf(dayStem, h.stem))
    .filter((x): x is string => !!x);

  // 3) 일지 합/충
  const dayBranchHap: string[] = [];
  const dayBranchChung: string[] = [];
  for (const other of PILLARS) {
    if (other === "day") continue;
    const b = sajuData[other]?.earthlyBranch;
    if (!b) continue;
    const rel = getPairRelation(dayBranch, b);
    if (/합/.test(rel.type)) dayBranchHap.push(dayBranch + b);
    if (/충/.test(rel.type)) dayBranchChung.push(dayBranch + b);
  }

  // 4) 일지 공망 / 도화 / 홍염 (enriched.shinsal)
  const matches = enriched.shinsal?.matches ?? [];
  const dayBranchGongmang = matches.some(m => m.key === "gongmang" && m.detectedAt?.includes("day"));
  const dohwa = matches.some(m => m.label.includes("도화"));
  const hongyeom = matches.some(m => m.label.includes("홍염"));

  // 5) 타이밍 — Task 2에서 채움
  const { timingWindows, daeunSpouseYears } = deriveTiming(
    fortune, dayStem, dayBranch, spouseSet, currentYear, spouseStarAbsent,
  );

  return {
    sex, maritalStatus, dayStem, dayBranch, spouseStarType,
    spouseStars, spouseStarAbsent, gwansalHonjap, spousePalaceHiddenStars,
    dayBranchHap, dayBranchChung, dayBranchGongmang, dohwa, hongyeom,
    timingWindows, daeunSpouseYears,
  };
}

// Task 2에서 실제 구현. 여기선 컴파일용 스텁.
function deriveTiming(
  _fortune: FortuneResult | null, _dayStem: string, _dayBranch: string,
  _spouseSet: Set<string>, _currentYear: number, _absent: boolean,
): { timingWindows: TimingWindow[]; daeunSpouseYears: MarriageFacts["daeunSpouseYears"] } {
  return { timingWindows: [], daeunSpouseYears: [] };
}
```

> 구현 주의: `getPairRelation`의 `type` 실제 문자열 값을 확인해 `/합/`·`/충/` 정규식이 맞는지 검증하라(`lib/utils/saju-enrichment.ts:654`). 다르면 정확한 리터럴로 교체.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --import tsx --test lib/marriage-facts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/marriage-facts.ts lib/marriage-facts.test.ts
git commit -m "feat(marriage): 배우자성·배우자궁·관살혼잡 결정론 엔진

같은 원국을 확대해 결혼 영역 사실을 엔진에서 뽑아 fabrication 방지.
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 2: 타이밍 3트리거 + 무관/무재 폴백

**Files:**
- Modify: `lib/marriage-facts.ts` (`deriveTiming` 실제 구현)
- Test: `lib/marriage-facts.test.ts` (타이밍 케이스 추가)

**Interfaces:**
- Consumes: `FortuneResult.seun`/`.daeun.pillars`, `getPairRelation`, 배우자성 Set.
- Produces: `MarriageFacts.timingWindows`, `.daeunSpouseYears`.

- [ ] **Step 1: 실패 테스트 추가**

```ts
// lib/marriage-facts.test.ts 에 추가
import type { FortuneResult } from "./utils/saju-fortune";

const fortune: FortuneResult = {
  daeun: {
    gender: "female", isForward: true, startAge: 5,
    startAgeDetail: { years: 5, months: 0, days: 0 }, daysToTerm: 0,
    pillars: [
      { index: 0, startAge: 25, endAge: 34, pillar: "辛酉", stem: "辛", branch: "酉", tenStar: "정관", twelveStage: "제왕" },
    ],
  },
  seun: [
    // 일간 甲, 일지 子. 丑=子와 육합(子丑合) → 세운합일지. 辛=정관 투출 → 배우자성투출.
    { year: 2027, age: 33, pillar: "辛丑", stem: "辛", branch: "丑", tenStar: "정관", twelveStage: "관대" },
  ],
};

test("타이밍: 세운 지지 일지합 + 배우자성 투출 → 트리거 2종", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, fortune, chart, "female", "솔로", 2026);
  const w = facts.timingWindows.find((x) => x.year === 2027);
  assert.ok(w, "2027 창이 있어야 함");
  assert.ok(w!.triggers.includes("세운합일지"));
  assert.ok(w!.triggers.includes("배우자성투출"));
  assert.equal(w!.isPast, false);
});

test("무관/무재 폴백: 배우자성 없으면 대운 배우자성 구간 수집", () => {
  // 배우자성 없는 차트: 일간 甲, 배우자성(정/편관) 천간·지장간 전무하게 구성
  const noStar: SajuData = {
    year:  { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
    month: { heavenlyStem: "丙", earthlyBranch: "午", hiddenStems: ["丁","己"] },
    day:   { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
    hour:  { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊","乙","癸"] },
  };
  const en = enrichSajuData(noStar, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(en, fortune, noStar, "female", "솔로", 2026);
  assert.equal(facts.spouseStarAbsent, true);
  assert.ok(facts.daeunSpouseYears.length >= 1, "대운 정관(辛酉) 구간이 잡혀야 함");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --import tsx --test lib/marriage-facts.test.ts`
Expected: FAIL — 타이밍 스텁이 빈 배열 반환.

- [ ] **Step 3: `deriveTiming` 구현**

```ts
// lib/marriage-facts.ts — 스텁 deriveTiming 을 아래로 교체
import { DOHWA } from "./utils/saju-enrichment"; // 파일 상단 import 에 합류

function deriveTiming(
  fortune: FortuneResult | null, dayStem: string, dayBranch: string,
  spouseSet: Set<string>, currentYear: number, _absent: boolean,
): { timingWindows: TimingWindow[]; daeunSpouseYears: MarriageFacts["daeunSpouseYears"] } {
  const timingWindows: TimingWindow[] = [];
  const daeunSpouseYears: MarriageFacts["daeunSpouseYears"] = [];
  if (!fortune) return { timingWindows, daeunSpouseYears };

  const dohwaBranch = DOHWA[dayBranch]; // 일지 기준 도화 지지

  for (const s of fortune.seun ?? []) {
    const triggers: TimingWindow["triggers"] = [];
    const rel = getPairRelation(dayBranch, s.branch);
    if (/합/.test(rel.type)) triggers.push("세운합일지");
    if (spouseSet.has(bareStar(s.tenStar))) triggers.push("배우자성투출");
    if (dohwaBranch && s.branch === dohwaBranch) triggers.push("도화홍염");
    if (triggers.length > 0) {
      timingWindows.push({ year: s.year, age: s.age, triggers, isPast: s.year < currentYear });
    }
  }

  for (const d of fortune.daeun?.pillars ?? []) {
    if (spouseSet.has(bareStar(d.tenStar))) {
      daeunSpouseYears.push({ startAge: d.startAge, endAge: d.endAge, star: bareStar(d.tenStar) });
    }
  }

  return { timingWindows, daeunSpouseYears };
}
```

> 주의: `DOHWA` export 위치/형태(`Record<string,string>`, `lib/utils/saju-enrichment.ts:739`)와 `s.tenStar`가 이미 bare("정관")인지 hanja 포함인지 확인해 `bareStar` 적용 일관성 유지.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --import tsx --test lib/marriage-facts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/marriage-facts.ts lib/marriage-facts.test.ts
git commit -m "feat(marriage): 타이밍 3트리거(세운합일지·배우자성투출·도화) + 무관무재 대운 폴백

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 3: 결혼운 등급 결정론 매핑

**Files:**
- Create: `lib/marriage-grade.ts`, `lib/marriage-grade.test.ts`

**Interfaces:**
- Consumes: primary result의 연애운 점수(0~100). `saju_results.full_json` → `scores.연애운`(`lib/resultSchema.ts:3`).
- Produces: `computeMarriageGrade(loveScore: number): { grade: "SS"|"S"|"A"|"B"|"C"; }`.

- [ ] **Step 1: 실패 테스트**

```ts
// lib/marriage-grade.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMarriageGrade } from "./marriage-grade";

test("연애운 점수 → 결혼운 등급 밴드 (결정론)", () => {
  assert.equal(computeMarriageGrade(92).grade, "SS");
  assert.equal(computeMarriageGrade(85).grade, "S");
  assert.equal(computeMarriageGrade(78).grade, "A");
  assert.equal(computeMarriageGrade(62).grade, "B");
  assert.equal(computeMarriageGrade(40).grade, "C");
});

test("경계·범위 밖 방어", () => {
  assert.equal(computeMarriageGrade(90).grade, "SS");   // ≥90
  assert.equal(computeMarriageGrade(150).grade, "SS");  // 클램프
  assert.equal(computeMarriageGrade(-5).grade, "C");
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/marriage-grade.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// lib/marriage-grade.ts
// 결혼운 등급은 개인사주 연애운 점수와 결정론 매핑 — 같은 사람이 연애운 78인데 결혼운 B로
// 튀는 모순 방지. 표시 라벨은 개인사주 displayGrade 격상 체계(SS/S/A/B/C)와 통일.
export type MarriageGrade = "SS" | "S" | "A" | "B" | "C";

export function computeMarriageGrade(loveScore: number): { grade: MarriageGrade } {
  const s = Math.max(0, Math.min(100, Number.isFinite(loveScore) ? loveScore : 0));
  if (s >= 90) return { grade: "SS" };
  if (s >= 82) return { grade: "S" };
  if (s >= 72) return { grade: "A" };
  if (s >= 55) return { grade: "B" };
  return { grade: "C" };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/marriage-grade.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/marriage-grade.ts lib/marriage-grade.test.ts
git commit -m "feat(marriage): 연애운 점수→결혼운 등급 결정론 매핑 (LLM 재량 제거)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 4: 코인 상수 + DB 마이그레이션

**Files:**
- Modify: `lib/constants/coins.ts`
- Create: `supabase/migrations/20260718_marriage_results.sql`

**Interfaces:**
- Produces: `MARRIAGE_COST` 상수, `marriage_results` + `marriage_result_unlocks` 테이블.

- [ ] **Step 1: 코인 상수 추가**

`lib/constants/coins.ts` 4번째 줄(`TODAY_COST` 아래)에 추가:

```ts
export const MARRIAGE_COST = 10; // 결혼운/애정운 심층 검사 = 10알 (사주·yearly 동일, 풀 심층)
```

- [ ] **Step 2: 마이그레이션 SQL 작성** — `20260524_today_results.sql` 미러, `target_date` 제거하고 `marital_status` 추가

```sql
-- supabase/migrations/20260718_marriage_results.sql
-- 결혼운/애정운 심층 검사 결과. today_results 패턴 미러.
-- 차이: target_date 없음(일회성 심층), marital_status(4분법) 추가.

create table if not exists public.marriage_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source_result_id uuid references public.saju_results(id) on delete set null,
  input_hash text not null,
  marital_status text not null,        -- 솔로/연애중/기혼/다시 혼자
  -- 입력 스냅샷 (saju_results 동일 컬럼)
  name text, birth_date date, birth_time text, region text, gender text,
  relationship_status text, employment_status text, calendar_type text, core_fear_axis text,
  -- 사주 캐시 + 결혼 메타
  saju_text text,
  marriage_grade text,                 -- SS/S/A/B/C (연애운 점수 결정론 매핑)
  spouse_star_type text,               -- 관성/재성
  gwansal_honjap boolean,
  spouse_star_absent boolean,
  teaser_json jsonb,
  full_json jsonb,
  unlocked_at timestamptz default now(),
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 같은 입력×같은 관계상태 결과 1건 (관계상태 바뀌면 새 리포트 허용)
create unique index if not exists marriage_results_user_input_status_unique
  on public.marriage_results (user_id, input_hash, marital_status)
  where user_id is not null;

alter table public.marriage_results
  drop constraint if exists marriage_results_user_input_status_uq;
alter table public.marriage_results
  add constraint marriage_results_user_input_status_uq
  unique (user_id, input_hash, marital_status);

create unique index if not exists marriage_results_guest_input_status_unique
  on public.marriage_results (guest_token_hash, input_hash, marital_status)
  where guest_token_hash is not null;

create index if not exists marriage_results_input_hash_idx
  on public.marriage_results (input_hash);

create table if not exists public.marriage_result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.marriage_results(id) on delete cascade,
  input_hash text not null,
  marital_status text not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists marriage_result_unlocks_user_input_status_unique
  on public.marriage_result_unlocks (user_id, input_hash, marital_status);
create unique index if not exists marriage_result_unlocks_order_unique
  on public.marriage_result_unlocks (order_id);
create index if not exists marriage_result_unlocks_result_idx
  on public.marriage_result_unlocks (result_id);

alter table public.marriage_results
  drop constraint if exists marriage_results_owner_check;
alter table public.marriage_results
  add constraint marriage_results_owner_check
  check (user_id is not null or guest_token_hash is not null);

alter table public.marriage_results enable row level security;
alter table public.marriage_result_unlocks enable row level security;

comment on table public.marriage_results is '결혼운/애정운 심층 검사 결과. 관계상태별 row.';
comment on column public.marriage_results.marital_status is '솔로/연애중/기혼/다시 혼자 (검사 내부 4분법).';
comment on column public.marriage_results.marriage_grade is '연애운 점수 결정론 매핑 등급 SS~C.';
```

- [ ] **Step 3: 마이그레이션 적용 확인**

Run: 프로젝트의 마이그레이션 적용 방식대로 실행(예: Supabase 대시보드 SQL 에디터 또는 `scripts/`의 적용 스크립트). 적용 후:
Run(검증): `npx tsx -e "import {supabaseAdmin} from './lib/supabaseAdmin'; supabaseAdmin.from('marriage_results').select('id').limit(1).then(r=>console.log('ok', r.error?.message ?? 'table exists'))"`
Expected: `ok table exists` (또는 빈 결과, 에러 없음).

- [ ] **Step 4: 커밋**

```bash
git add lib/constants/coins.ts supabase/migrations/20260718_marriage_results.sql
git commit -m "feat(marriage): MARRIAGE_COST=10 + marriage_results 테이블(RLS, 4분법 marital_status)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 5: `from-primary` 라우트 — primary에서 사실 조립

**Files:**
- Create: `app/api/marriage/from-primary/route.ts`

**Interfaces:**
- Consumes: `getPrimarySajuData(userId)`(relationshipStatus, gender, birth 포함), `calculateSaju`, `enrichSajuData`, `calculateFortune`, `deriveMarriageFacts`.
- Produces: JSON `{ facts: MarriageFacts, prefillStatus: MaritalStatus, sajuText: string, loveScore: number }`. Task 6/9가 소비.

- [ ] **Step 1: 라우트 구현** (`app/api/today/from-primary/route.ts` + `lib/analysis.ts:2354-2372` 조립 미러)

```ts
// app/api/marriage/from-primary/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { deriveMarriageFacts, type MaritalStatus } from "@/lib/marriage-facts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normGender(g: string): "male" | "female" { return /여|female|f/i.test(g) ? "female" : "male"; }
function prefill(rs: string): MaritalStatus {
  if (rs.includes("연애")) return "연애중";
  if (rs.includes("기혼")) return "기혼";
  return "솔로"; // '다시 혼자'는 저장 3분법에 없음 → 사용자 정정 선택
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const primary = await getPrimarySajuData(session.user.id);
  if (!primary) return NextResponse.json({ error: "먼저 사주 분석을 완료해 주세요." }, { status: 404 });

  const saju = await calculateSaju(
    Number(primary.birthYear), Number(primary.birthMonth), Number(primary.birthDay),
    primary.unknownBirthTime ? undefined : Number(primary.birthHour),
    primary.unknownBirthTime ? undefined : Number(primary.birthMinute),
    { birthLocation: primary.birthLocation },
  );
  if (!saju) return NextResponse.json({ error: "사주 계산에 실패했어요." }, { status: 500 });

  const enriched = enrichSajuData(saju, { isTimeUnknown: primary.unknownBirthTime });
  const gender = normGender(primary.gender);
  let fortune = null;
  try {
    fortune = await calculateFortune({
      birthYear: Number(primary.birthYear), birthMonth: Number(primary.birthMonth), birthDay: Number(primary.birthDay),
      birthHour: primary.unknownBirthTime ? undefined : Number(primary.birthHour),
      birthMinute: primary.unknownBirthTime ? undefined : Number(primary.birthMinute),
      gender, birthLocation: primary.birthLocation,
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: primary.unknownBirthTime,
    });
  } catch (e) { console.error("[MARRIAGE from-primary] fortune 실패", e); }

  const currentYear = new Date().getFullYear();
  const prefillStatus = prefill(primary.relationshipStatus);
  const facts = deriveMarriageFacts(enriched, fortune, saju, gender, prefillStatus, currentYear);

  // 연애운 점수: primary full_json.scores.연애운 (없으면 0 → 등급 C)
  const { data: srcRow } = await supabaseAdmin
    .from("saju_results").select("full_json").eq("id", primary.id).maybeSingle();
  const loveScore = Number((srcRow?.full_json as any)?.scores?.연애운 ?? 0);

  return NextResponse.json({
    facts, prefillStatus, loveScore,
    sajuText: formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime }),
    sourceResultId: primary.id,
  });
}
```

> 확인 필요: `PrimarySajuData`에 `id`·`birthHour`·`birthMinute`·`unknownBirthTime` 필드 존재(`lib/server/get-primary-saju.ts`에서 확인됨). `formatSajuText` export(`lib/utils/saju.ts:560`).

- [ ] **Step 2: 스모크 테스트** (dev 서버 기동 후)

Run: 로그인 세션으로 `GET /api/marriage/from-primary` 호출(브라우저 또는 인증 쿠키 curl).
Expected: `facts.spouseStarType`·`prefillStatus`·`loveScore` 포함 200 JSON. 개인사주 없는 계정은 404.

- [ ] **Step 3: 커밋**

```bash
git add app/api/marriage/from-primary/route.ts
git commit -m "feat(marriage): from-primary — primary 원국에서 결혼 사실 조립(gender·연애운 재사용)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 6: 프롬프트 빌더 `lib/marriage-prompt.ts`

**Files:**
- Create: `lib/marriage-prompt.ts`
- Create: `prompts/history/marriage-v1.md` (프롬프트 스냅샷)

**Interfaces:**
- Consumes: `MarriageFacts`, `loveScore`, `computeMarriageGrade`.
- Produces: `buildMarriagePrompt(facts, grade, sajuText): string` — Gemini system+user 프롬프트.

- [ ] **Step 1: 프롬프트 빌더 작성** (`lib/today-prompt.ts`/`lib/yearly-prompt.ts` 구조 미러)

핵심 요구(프롬프트 본문에 명시):
- **역할/톤**: 두루미 명리학자, 토스풍, 시니어 가독성. "기분 맞춰주는 점집" 아님.
- **입력 사실 주입**: `facts`를 구조화 텍스트로. LLM은 이 사실만 해석(새 명리값 생성 금지).
- **블록 구조**(스펙 §4): 공통 코어(등급 헤드라인·배우자궁·배우자성) → `maritalStatus`별 강조(솔로/연애중/기혼/다시 혼자) → 실천 조언 + 궁합 CTA.
- **차별화 규칙**: "개인사주가 이미 말한 요약 반복 금지. 반드시 한 단계 아래 해상도(어느 기둥·지장간·몇 년)로."
- **여명 안전장치**(sex==='female' 강조): 이혼/사별/외도 예언 금지, 극(剋)=소통패턴 재해석, 만혼=지난 시기는 향후 창과 세트로만, 기혼 도화=매력으로만, 배우자 인격비난 금지.
- **무관/무재**: `spouseStarAbsent`면 "인연이 약하다" 금지 → 배우자궁 대체 판단 + `daeunSpouseYears` 인입 시기로.
- **조언 근거 태그**: 각 실천 조언 문장 끝에 `[근거:일지충]` 형태 태그 부착 지시(postprocess가 검사).
- **출력**: JSON(블록별 키). teaser/full 분리 필드.

```ts
// lib/marriage-prompt.ts (골격)
import type { MarriageFacts } from "./marriage-facts";
import type { MarriageGrade } from "./marriage-grade";

export function buildMarriagePrompt(facts: MarriageFacts, grade: MarriageGrade, sajuText: string): string {
  const factLines = [
    `성별: ${facts.sex === "female" ? "여명(배우자성=관성)" : "남명(배우자성=재성)"}`,
    `관계상태: ${facts.maritalStatus}`,
    `일간/일지(배우자궁): ${facts.dayStem} / ${facts.dayBranch}`,
    `배우자성 탐지: ${facts.spouseStarAbsent ? "없음(무관/무재)" : facts.spouseStars.map(s => `${s.star}(${s.pillar}·${s.source})`).join(", ")}`,
    `관살혼잡: ${facts.gwansalHonjap ? "예" : "아니오"}`,
    `일지 지장간 십성(배우자 숨은 성격): ${facts.spousePalaceHiddenStars.join(", ") || "없음"}`,
    `일지 합/충: 합[${facts.dayBranchHap.join(",")}] 충[${facts.dayBranchChung.join(",")}] 공망:${facts.dayBranchGongmang ? "예" : "아니오"}`,
    `인연 신살: 도화 ${facts.dohwa ? "○" : "×"} / 홍염 ${facts.hongyeom ? "○" : "×"}`,
    `타이밍 창: ${facts.timingWindows.map(w => `${w.year}(${w.triggers.join("+")}${w.isPast ? "·과거" : ""})`).join(", ") || "없음"}`,
    `대운 배우자성 구간: ${facts.daeunSpouseYears.map(d => `${d.startAge}~${d.endAge}세 ${d.star}`).join(", ") || "없음"}`,
    `결혼운 등급(고정): ${grade}`,
  ].join("\n");

  // ↓ 실제로는 today-prompt.ts 처럼 상세 규칙 블록을 문자열로 구성.
  return [SYSTEM_RULES, "===== 사주 원국 =====", sajuText, "===== 결혼 사실(엔진) =====", factLines, OUTPUT_SCHEMA].join("\n\n");
}

const SYSTEM_RULES = `...(위 핵심 요구를 상세 서술; 여명 안전장치·차별화·무관무재·조언 근거태그 포함)...`;
const OUTPUT_SCHEMA = `...(JSON 블록 키 정의: gradeHeadline, spousePalace, spouseStar, [status별 블록], advice[](각 항목 text+근거태그), gunghapCta)...`;
```

- [ ] **Step 2: 프롬프트 스냅샷 저장** — `prompts/history/marriage-v1.md`에 전체 프롬프트 + 설계 의도 기록.

- [ ] **Step 3: 빌더 스모크** — `npx tsx -e`로 더미 facts 넣어 문자열 생성 확인(에러 없이 사실 라인 포함).

Run: `npx tsx -e "import {buildMarriagePrompt} from './lib/marriage-prompt'; console.log(buildMarriagePrompt({sex:'female',maritalStatus:'솔로',dayStem:'甲',dayBranch:'子',spouseStarType:'관성',spouseStars:[],spouseStarAbsent:true,gwansalHonjap:false,spousePalaceHiddenStars:[],dayBranchHap:[],dayBranchChung:[],dayBranchGongmang:false,dohwa:false,hongyeom:false,timingWindows:[],daeunSpouseYears:[]} as any,'B','원국텍스트').slice(0,400))"`
Expected: 사실 라인·규칙 포함 출력.

- [ ] **Step 4: 커밋**

```bash
git add lib/marriage-prompt.ts prompts/history/marriage-v1.md
git commit -m "feat(marriage): 상태적응형 프롬프트 빌더 + 여명 안전장치/차별화/근거태그 규칙 (v1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 7: 품질 가드 `lib/marriage-postprocess.ts`

**Files:**
- Create: `lib/marriage-postprocess.ts`, `lib/marriage-postprocess.test.ts`

**Interfaces:**
- Consumes: LLM 원문(JSON 파싱된 블록), `MarriageFacts`, primary 요약 텍스트(차별화 중복 비교용).
- Produces: `applyMarriageGuards(parsed, facts, primarySummary): { blocks, violations: string[] }` — 위반 문장 제거/치환.

- [ ] **Step 1: 실패 테스트**

```ts
// lib/marriage-postprocess.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMarriageGuards } from "./marriage-postprocess";

const facts: any = { sex: "female", maritalStatus: "기혼", dohwa: true };

test("이혼·사별·외도 예언 문장 제거", () => {
  const parsed = { advice: [{ text: "곧 이혼수가 있습니다.", tag: "[근거:일지충]" }] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("근거 태그 없는 조언 컷", () => {
  const parsed = { advice: [{ text: "대화를 많이 하세요.", tag: "" }] };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.equal(blocks.advice.length, 0);
});

test("금지 신살(과숙살) 언급 제거", () => {
  const parsed = { spousePalace: "과숙살이 있어 외롭습니다.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("금지신살")));
  assert.ok(!blocks.spousePalace.includes("과숙살"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/marriage-postprocess.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// lib/marriage-postprocess.ts
const FORBIDDEN_PREDICTIONS = [/이혼수?/, /사별/, /외도/, /바람(을|이|날)/, /혼자 늙/, /팔자가 세/];
const FORBIDDEN_SHINSAL = [/과숙살/, /고신살/, /상부살/, /홍란/, /천희/];

export interface MarriageGuardResult { blocks: any; violations: string[]; }

export function applyMarriageGuards(parsed: any, facts: any, _primarySummary: string): MarriageGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));

  // 1) 금지 신살 언급 스크럽 (모든 문자열 필드)
  const scrub = (s: string): string => {
    let out = s;
    for (const re of FORBIDDEN_SHINSAL) {
      if (re.test(out)) { violations.push(`금지신살: ${re}`); out = out.replace(new RegExp(re.source, "g"), "").replace(/\s{2,}/g, " ").trim(); }
    }
    return out;
  };
  const walk = (o: any) => {
    if (typeof o === "string") return scrub(o);
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") { for (const k of Object.keys(o)) o[k] = walk(o[k]); return o; }
    return o;
  };
  walk(blocks);

  // 2) 조언: 근거 태그 필수 + 단정 예언 제거
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      if (FORBIDDEN_PREDICTIONS.some(re => re.test(text))) { violations.push(`단정 예언 제거: ${text.slice(0,20)}`); return false; }
      if (!a?.tag || !/\[근거:.+\]/.test(a.tag)) { violations.push(`근거태그 없음 컷: ${text.slice(0,20)}`); return false; }
      return true;
    });
  }

  // 3) 단정 예언: 일반 블록 문자열에서도 문장 제거
  for (const key of Object.keys(blocks)) {
    if (typeof blocks[key] === "string") {
      const kept = blocks[key].split(/(?<=[.!?。])\s+/).filter((sent: string) => {
        if (FORBIDDEN_PREDICTIONS.some(re => re.test(sent))) { violations.push(`단정 예언 제거(${key})`); return false; }
        return true;
      });
      blocks[key] = kept.join(" ").trim();
    }
  }

  return { blocks, violations };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test lib/marriage-postprocess.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/marriage-postprocess.ts lib/marriage-postprocess.test.ts
git commit -m "feat(marriage): 품질 가드 — 단정예언/근거없는조언/금지신살 제거

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 8: 일관성 검증 helper

**Files:**
- Create: `lib/marriage-consistency.ts`, `lib/marriage-consistency.test.ts`

**Interfaces:**
- Consumes: `MarriageFacts`, 결혼운 등급, primary의 연애운 점수/성별.
- Produces: `assertMarriageConsistency({grade, loveScore, facts, primaryGender}): string[]` — 불일치 목록(빈 배열=정합).

- [ ] **Step 1: 실패 테스트**

```ts
// lib/marriage-consistency.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertMarriageConsistency } from "./marriage-consistency";
import { computeMarriageGrade } from "./marriage-grade";

test("등급이 연애운 점수 매핑과 다르면 불일치", () => {
  const issues = assertMarriageConsistency({ grade: "SS", loveScore: 40, facts: { sex: "female" } as any, primaryGender: "female" });
  assert.ok(issues.some(i => i.includes("등급")));
});

test("성별-배우자성 불일치 탐지", () => {
  const issues = assertMarriageConsistency({ grade: computeMarriageGrade(60).grade, loveScore: 60, facts: { sex: "female", spouseStarType: "재성" } as any, primaryGender: "female" });
  assert.ok(issues.some(i => i.includes("배우자성")));
});

test("정합이면 빈 배열", () => {
  const issues = assertMarriageConsistency({ grade: computeMarriageGrade(60).grade, loveScore: 60, facts: { sex: "female", spouseStarType: "관성" } as any, primaryGender: "female" });
  assert.deepEqual(issues, []);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test lib/marriage-consistency.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/marriage-consistency.ts
import { computeMarriageGrade } from "./marriage-grade";

export function assertMarriageConsistency(args: {
  grade: string; loveScore: number; facts: { sex: string; spouseStarType?: string }; primaryGender: string;
}): string[] {
  const issues: string[] = [];
  if (args.grade !== computeMarriageGrade(args.loveScore).grade) {
    issues.push(`등급 불일치: 저장 ${args.grade} vs 연애운(${args.loveScore}) 매핑 ${computeMarriageGrade(args.loveScore).grade}`);
  }
  const expectedStar = args.facts.sex === "female" ? "관성" : "재성";
  if (args.facts.spouseStarType && args.facts.spouseStarType !== expectedStar) {
    issues.push(`배우자성 불일치: ${args.facts.sex}인데 ${args.facts.spouseStarType}`);
  }
  const g = /여|female/i.test(args.primaryGender) ? "female" : "male";
  if (args.facts.sex !== g) issues.push(`성별 불일치: facts ${args.facts.sex} vs primary ${g}`);
  return issues;
}
```

- [ ] **Step 4: 통과 확인** → **Step 5: 커밋** (`node --import tsx --test lib/marriage-consistency.test.ts` PASS 후)

```bash
git add lib/marriage-consistency.ts lib/marriage-consistency.test.ts
git commit -m "feat(marriage): 메인 result 일관성 검증 helper (등급·배우자성·성별)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 9: `analyze` 라우트 — 멱등 차감 + Gemini + 가드 + 환불

**Files:**
- Create: `app/api/marriage/analyze/route.ts`, `app/api/marriage/start/route.ts`

**Interfaces:**
- Consumes: `MARRIAGE_COST`, `buildMarriagePrompt`, `applyMarriageGuards`, `computeMarriageGrade`, `assertMarriageConsistency`, Gemini 호출(`lib/analysis.ts`의 Gemini 클라이언트 패턴), 코인 차감/환불(`lib/today-payment-flow.ts` 미러), `marriage_result_unlocks`(멱등).
- Produces: 저장된 `marriage_results.full_json` + 200 응답.

- [ ] **Step 1: `start` 라우트** — teaser row 생성 (`app/api/today/start` 미러). `marriage_results`에 입력 스냅샷+`marital_status`+`marriage_grade`(computeMarriageGrade) upsert, `teaser_json` 세팅, `full_json` null.

- [ ] **Step 2: `analyze` 라우트 구현** — 순서 고정:
  1. 세션/입력 검증(`marital_status` 4분법 화이트리스트).
  2. **멱등 체크**: `marriage_result_unlocks`에 (user_id,input_hash,marital_status) 존재 && `full_json` 있으면 → 재분석 없이 기존 반환.
  3. 코인 잔액 확인 → **차감**(order_id 생성, unlocks insert; unique 위반 시 이미 결제된 것으로 처리 = 멱등).
  4. `from-primary` 로직으로 facts 재조립(또는 start가 저장한 스냅샷 재사용) → `computeMarriageGrade(loveScore)`.
  5. `assertMarriageConsistency` → 불일치면 `console.error` + 차감 **환불** + 500 한국어 메시지.
  6. `buildMarriagePrompt` → Gemini 호출(`lib/analysis.ts`의 모델/설정 재사용) → JSON 파싱(`lib/json5Utils.ts`).
  7. `applyMarriageGuards` → violations 로깅, blocks 확정.
  8. `marriage_results.full_json` 저장 + 메타 컬럼 갱신.
  9. 실패(파싱/Gemini/저장) 시 **환불** + 한국어 메시지(`error.message` 노출 금지).

핵심 골격:

```ts
// app/api/marriage/analyze/route.ts (핵심 흐름)
import { MARRIAGE_COST } from "@/lib/constants/coins";
// ... imports: session, supabaseAdmin, buildMarriagePrompt, applyMarriageGuards,
//     computeMarriageGrade, assertMarriageConsistency, gemini client, json5 parse

export async function POST(req: Request) {
  // 1) 검증
  const { maritalStatus } = await req.json();
  const ALLOWED = ["솔로","연애중","기혼","다시 혼자"];
  if (!ALLOWED.includes(maritalStatus)) return json(400, "관계 상태를 다시 선택해 주세요.");
  // 2) 멱등: 기존 full_json 있으면 반환
  // 3) 잔액 확인 + 차감(unlocks insert, unique 위반=이미결제)
  // 4) facts 재조립 + grade
  // 5) 일관성 검증 실패 → 환불 + 500
  // 6) Gemini
  let parsed;
  try { parsed = parseJson5(await geminiGenerate(buildMarriagePrompt(facts, grade, sajuText))); }
  catch (e) { console.error("[MARRIAGE analyze] gemini/parse 실패", e); await refund(userId, MARRIAGE_COST, orderId); return json(500, "분석에 실패했어. 알은 환불됐어."); }
  // 7) 가드
  const { blocks, violations } = applyMarriageGuards(parsed, facts, primarySummary);
  if (violations.length) console.warn("[MARRIAGE guards]", violations);
  // 8) 저장
  // 9) 반환
}
```

> 재사용 소스: 코인 차감/환불/order_id·Gemini 호출·JSON 파싱은 `app/api/today/analyze/route.ts` + `lib/today-payment-flow.ts` + `lib/analysis.ts`에서 검증된 함수를 그대로 import. 새 결제 로직 작성 금지(멱등성 사고 방지).

- [ ] **Step 3: 통합 스모크** (dev 서버) — 개인사주 있는 테스트 계정으로:
  1. `POST /api/marriage/start {maritalStatus:"솔로"}` → teaser row.
  2. `POST /api/marriage/analyze {maritalStatus:"솔로"}` → 200 + full_json. 잔액 -10.
  3. 같은 호출 재실행 → 재분석 없이 기존 반환, 잔액 변화 없음(멱등).
  4. 잔액 부족 계정 → 402/한국어 안내, 차감 없음.
Expected: 위 4개 관찰. Vercel 로그 아닌 로컬 콘솔로 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/api/marriage/analyze/route.ts app/api/marriage/start/route.ts
git commit -m "feat(marriage): analyze/start — 멱등 차감·일관성검증·Gemini·가드·환불

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 10: 결과/목록 조회 라우트 + 공유

**Files:**
- Create: `app/api/marriage/results/route.ts`, `app/api/marriage/list/route.ts`, `lib/share-marriage.ts`

**Interfaces:**
- Consumes: `marriage_results` 조회, `share-yearly.ts` 패턴.
- Produces: 결과 단건/목록 JSON, OG 공유 페이로드.

- [ ] **Step 1: `results` 라우트** — `?id=` 또는 최신 1건, 소유권(user_id/guest) 확인 후 `full_json` 반환. (`app/api/today/results` 미러)
- [ ] **Step 2: `list` 라우트** — 내 결혼운 결과 목록(등급·관계상태·created_at). (`app/api/yearly/list` 미러)
- [ ] **Step 3: `share-marriage.ts`** — OG 카드 페이로드(등급·헤드라인). `lib/share-yearly.ts` 미러, 문구만 결혼운.
- [ ] **Step 4: 스모크** — Task 9에서 만든 결과 id로 `GET /api/marriage/results?id=...` 200, `GET /api/marriage/list` 목록 반환.
- [ ] **Step 5: 커밋**

```bash
git add app/api/marriage/results/route.ts app/api/marriage/list/route.ts lib/share-marriage.ts
git commit -m "feat(marriage): results/list 조회 + OG 공유 카드

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 11: 입력 화면 — 관계상태 4분법 프리필 + 원탭 확인

**Files:**
- Create: `app/marriage/page.tsx`, `app/marriage/input/page.tsx`

**Interfaces:**
- Consumes: `GET /api/marriage/from-primary`(prefillStatus), `POST /api/marriage/start`+`analyze`.
- Produces: 결과 페이지로 라우팅(`/marriage/result`).

- [ ] **Step 1: `app/marriage/page.tsx`** — 진입(설명 + "내 사주로 결혼운 보기" CTA). `app/today/page.tsx`/`TodayEntryClient.tsx` 미러. 개인사주 없으면 사주 먼저 안내.
- [ ] **Step 2: `app/marriage/input/page.tsx`** — mount 시 `from-primary` 호출 → `prefillStatus`로 선택 프리필. **4개 큰 버튼**(솔로/연애중/기혼/다시 혼자), 기본 선택=prefill. "이대로 결혼운 보기" 원탭. 확인 시 `start`→`analyze`→결과 이동. 결제 흐름은 `app/today/input/page.tsx` 결제 UI 미러.
  - 시니어 가독성: 버튼 `text-[17px]+`, 고대비, 한 화면 하나의 질문.
  - "결혼=필수" 어투 금지 카피.
- [ ] **Step 3: 수동 검증** — 프리필(개인사주 기혼 계정 → '기혼' 선택됨), '다시 혼자' 정정 가능, 원탭 진행, 잔액 부족 시 충전 유도.
- [ ] **Step 4: 커밋**

```bash
git add app/marriage/page.tsx app/marriage/input/page.tsx
git commit -m "feat(marriage): 진입+입력 화면 — 4분법 프리필 원탭 확인

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 12: 결과표 `MarriageResultClient` (스크롤 내러티브)

**Files:**
- Create: `app/marriage/result/page.tsx`, `app/marriage/result/MarriageResultClient.tsx`

**Interfaces:**
- Consumes: `GET /api/marriage/results`, `full_json.blocks`.
- Produces: 스크롤 결과 화면. `docs/DESIGN_SYSTEM.md` + `app/pet/result/PetResultClient.tsx` 패턴.

- [ ] **Step 1: `page.tsx`** — 결과 id/최신 로드, `MarriageResultClient`에 데이터 전달. `app/today/result/page.tsx` 미러.
- [ ] **Step 2: `MarriageResultClient.tsx`** — 펫 결과표 골격 재사용:
  - `OpeningScene`(min-h-[80~86vh]) = **등급 히어로**(SS~C + gradeHeadline, `font-aggro`).
  - `<section className="px-6 pt-16">` 스택으로 블록: 배우자궁 → 배우자성 → (status별) → 실천 조언 → 궁합 CTA.
  - 강약/안정도 = 펫 `RelationAxis`/게이지 결 재사용.
  - 구조화 텍스트 = 펫 `parseSpec` dot-bullet.
  - 카드형(타이밍 연도·배우자상) = 펫 `SimCard` 결.
  - CTA 버튼 → 궁합/배틀 상품 라우트.
- [ ] **Step 3: 검수** — mp4 아닌 실제 렌더로 겹침/잘림 없음, 시니어 가독성, 4개 상태별 렌더 확인. (스펙 §5.1)
- [ ] **Step 4: 커밋**

```bash
git add app/marriage/result/page.tsx app/marriage/result/MarriageResultClient.tsx
git commit -m "feat(marriage): 결과표 — 등급 히어로+스크롤 섹션(DESIGN_SYSTEM+펫 패턴)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 13: 홈/메뉴 진입점 + 빌드 검증

**Files:**
- Modify: `app/page.tsx`(홈 카드), `app/menu/page.tsx` 또는 `app/MenuDrawer.tsx`(메뉴 엔트리)

**Interfaces:**
- Consumes: 기존 홈/메뉴 카드 컴포넌트 패턴.
- Produces: `/marriage` 진입 카드 1개.

- [ ] **Step 1: 홈 카드 추가** — 기존 검사 카드(today/yearly/battle) 컴포넌트/스타일 재사용, `/marriage`로 링크, "결혼운·애정운" 카피. hover/pressed 상태 포함(컴포넌트 룰).
- [ ] **Step 2: 메뉴 엔트리 추가** — 기존 메뉴 리스트에 동일 톤으로.
- [ ] **Step 3: 빌드 검증** (dev 서버 종료 후)

Run: `npx next build`
Expected: 성공(타입/린트 에러 0). 실패 시 해당 파일 수정 후 재실행.

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx app/menu/page.tsx
git commit -m "feat(marriage): 홈·메뉴에 결혼운 검사 진입 카드 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013yRq2aSMa3QZVMVrwkLDTg"
```

---

## Task 14: 명리 critic 검수 (착수 게이트 최종 확인)

**Files:** 없음(검수). 발견 이슈는 해당 태스크 파일 수정.

- [ ] **Step 1: 실제 케이스 3종 생성** — 서로 다른 원국+상태(솔로 여명 관살혼잡 / 기혼 남명 재성 / 무관 여명 만혼)로 full 리포트 생성.
- [ ] **Step 2: 독립 critic 대조** — 각 리포트를 엔진 facts와 대조: 배우자성·관살혼잡·일지 지장간·타이밍 연도가 리포트 서술과 일치하는가(fabrication 0)? 여명 안전장치 위반(단정/외도암시/배우자비난)? 차별화(개인사주 재탕)? 만혼 향후 창? 근거태그?
- [ ] **Step 3: 발견 이슈 수정** — 프롬프트(Task 6)/가드(Task 7) 보강 후 재생성.
- [ ] **Step 4: 게이트 확인** — 스펙 §9 4개(엔진 선행·차별화·4분법·여명 안전장치) 충족 서면 확인.
- [ ] **Step 5: 커밋**(수정 있었을 경우) + 브랜치 완료 처리(finishing-a-development-branch).

---

## Self-Review

**스펙 커버리지:**
- §2 입력 4분법 프리필 → Task 5(prefill)+11 ✓
- §3 엔진 모듈(배우자성·혼잡·지장간·합거충거·공망·타이밍·무관무재) → Task 1+2 ✓
- §4 블록/등급 결정론/근거태그/궁합CTA → Task 3(등급)+6(프롬프트)+7(태그)+12(CTA) ✓
- §5 기술스택/테이블/결제/공유 → Task 4+9+10 ✓
- §5.1 결과표 디자인 → Task 12 ✓
- §6 차별화/일관성/여명안전장치/기혼범위 → Task 6+7+8 ✓
- §7 멱등·환불·일관성·critic·가독성 → Task 9+8+14 ✓
- §8 범위밖(홈리디자인·펫) → Task 13은 카드 1개만 ✓

**플레이스홀더 스캔:** 결정론 로직(Task 1-3,7,8)은 완전 코드. Task 6 프롬프트 본문/Task 9-12 보일러플레이트는 "정확한 미러 소스 파일 + 델타"로 지정(기존 검증 패턴 재사용이 이 코드베이스 규칙, CLAUDE.md "광범위 리팩토링 금지"). 각 미러 태스크는 스모크/수동 검증 스텝으로 마감.

**타입 일관성:** `MarriageFacts`·`MaritalStatus`·`MarriageGrade`·`deriveMarriageFacts`·`computeMarriageGrade`·`applyMarriageGuards`·`assertMarriageConsistency` 시그니처가 태스크 간 일치.

**착수 전 검증 필요(구현자 확인 항목):** `getPairRelation().type`의 합/충 리터럴, `DOHWA` export·형태, `seun.tenStar`/`daeun.tenStar`의 hanja 포함 여부, `PrimarySajuData` 필드명(birthHour 등). 각 태스크 주석에 명시.
