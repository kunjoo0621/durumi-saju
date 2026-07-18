# 재물운 심층 검사 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 결혼운(1호)이 **검증된 템플릿**이므로 각 태스크는 대응 `marriage-*` 파일을 읽어 미러 + 재물 델타 적용. 파일럿보다 저위험이라 태스크 통합(8개).

**Goal:** 개인사주와 동일 원국을 확대해 재물 영역만 심층 분석하는 독립 유료 검사(2호)를, 결혼운 패턴을 복제해 추가한다.

**Architecture:** 결정론 엔진(`deriveWealthFacts`)이 재성·재를감당·식상생재·군겁쟁재·재고·타이밍을 뽑고 → Gemini가 조합 해석 → postprocess가 차별화·재물 안전장치·근거태그를 강제. 라우트·테이블·결제·결과표·배경은 `marriage-*`/`app/marriage/*`를 그대로 미러.

**Tech Stack:** Next.js 15 + TS, Gemini(NOT Claude), Supabase(RLS, supabaseAdmin), Zustand, Tailwind. 유닛테스트 = `node --conditions=import --import tsx --test <file>`.

## Global Constraints

- Gemini API (Claude 아님). API 에러=한국어만, `error.message` 노출 금지, `console.error`.
- 배포 전 `npx next build` 성공. dev 서버 돌 때 build 금지.
- 코인 **멱등 차감 + 실패 환불** — 결혼운 `app/api/marriage/analyze/route.ts`의 `refundAndCleanup` 흐름 그대로(무료리포트·환불파밍 방지, 1:1 차감:환불). 새 결제 로직 작성 금지.
- 모든 테이블 RLS enable, supabaseAdmin.
- fabrication 0 — LLM은 엔진 사실만 해석. 근거 얇은 흉살·공포성 신살 금지.
- **재물 안전장치(스펙 §6)**: 숙명론·공포·서열화 금지("가난할 팔자/거지 사주/돈복 없다"), 재다신약=그릇 관리로 재해석, 투자 손실 단정 금지, **재무자문 아님**(종목·상품 권유 금지).
- 결과표 = `docs/DESIGN_SYSTEM.md` + `app/marriage/result/MarriageResultClient.tsx` 스크롤 내러티브. 시니어 가독성.
- 브랜치: `feat/wealth-luck-test` (결혼운 위 스택). 라이브/유료/프로덕션(마이그레이션 적용·Gemini 스모크·시각 QA·명리 critic)은 defer.
- 스펙: `docs/superpowers/specs/2026-07-18-wealth-luck-test-design.md`.

---

## Interfaces (핵심 타입)

```ts
// lib/wealth-facts.ts
export type WealthInterest = "목돈 모으기" | "투자로 불리기" | "사업·수입 키우기" | "지출·빚 관리";
export interface WealthStarHit { pillar: "year"|"month"|"day"|"hour"; source: "천간"|"지장간"; star: "정재"|"편재"; }
export interface WealthTimingWindow { year: number; age: number; triggers: Array<"재성투출"|"식상투출"|"비겁손재">; isPast: boolean; }
export interface WealthFacts {
  interest: WealthInterest;
  dayStem: string;
  jaeseong: WealthStarHit[];              // 재성 탐지
  jaeseongType: "정재우세"|"편재우세"|"재성혼재"|"무재";
  jaeseongAbsent: boolean;
  strengthLevel: string;                  // judgeStrength 결과 (신강/신약 등)
  jaeToGamdang: "강"|"중"|"약";            // 재를 감당하는 그릇 (신강신약 × 재성량)
  jaedaShinyak: boolean;                   // 재다신약
  sikssangSaengjae: boolean;               // 식상생재
  gunggeobJaengjae: boolean;               // 군겁쟁재
  jaego: boolean;                          // 재고(財庫) 유무
  yongshinFavorsWealth: boolean;           // 용신이 재/식상
  timingWindows: WealthTimingWindow[];
  daeunWealthYears: Array<{ startAge: number; endAge: number; star: string }>;
}
export function deriveWealthFacts(enriched, fortune, sajuData, interest: WealthInterest, currentYear: number): WealthFacts;

// lib/wealth-grade.ts — 재물운 점수 → 등급 (marriage-grade 동일 로직)
export function computeWealthGrade(wealthScore: number): { grade: "SS"|"S"|"A"|"B"|"C" };
```

재사용 프리미티브(결혼운에서 검증): `getTenStar`(정재/편재=일간이 극하는 오행 음양별), `STEM_ELEMENT`, `BRANCH_INFO`, `judgeStrength`(신강신약), `calculateTenStars`, `determineYongshin`, `getPairRelation`, `FortuneResult.seun/daeun.pillars[].tenStar`(bare 한글), `bareStar` 패턴. 조립 참조 `app/api/marriage/from-primary/route.ts`.

---

## Task 1: 엔진 `deriveWealthFacts` + 유닛테스트

**Files:** Create `lib/wealth-facts.ts`, `lib/wealth-facts.test.ts`

**Interfaces:** Produces `WealthFacts` (위). 템플릿 = `lib/marriage-facts.ts`(읽고 미러). 재물 델타:
- 배우자성(관/재 성별분기) → **재성 고정**(정재/편재, 성별 무관). `getTenStar`로 정재/편재 판별.
- `jaeseongType`: 정재만=정재우세, 편재만=편재우세, 둘다=혼재, 없음=무재.
- `jaeToGamdang`: `judgeStrength`의 신강/신약 × 재성 개수 → 신강&재유=강, 신약&재다=약(=`jaedaShinyak=true`), 그 외=중.
- `sikssangSaengjae`: 십성에 식신/상관 존재.
- `gunggeobJaengjae`: 비견/겁재 2개+ AND (재성 약 또는 무재).
- `jaego`: 일간 기준 재 오행의 墓지(辰戌丑未) 지지 존재 — `BRANCH_INFO` 지장간/12운성으로 파생. (불확실하면 false + console 로그, fabrication 금지)
- 타이밍(`deriveMarriageFacts`의 `deriveTiming` 미러): 재성투출/식상투출/비겁손재 트리거를 `seun`/`daeun` tenStar로. `daeunWealthYears`=대운 tenStar가 재성인 구간.

- [ ] **Step 1: 실패 테스트** — `lib/marriage-facts.test.ts` 패턴. 최소 3 케이스:
  - 정재+편재 존재 → jaeseongType "재성혼재", jaeseongAbsent false.
  - 신약 + 재 과다 차트 → jaedaShinyak true, jaeToGamdang "약".
  - 식신/상관 존재 차트 → sikssangSaengjae true.
  (수동 구성 SajuData 픽스처. 십성 기대값은 실제 STEM_ELEMENT/getTenStar로 검증 후 확정. 어서션 약화 금지.)
- [ ] **Step 2:** `node --conditions=import --import tsx --test lib/wealth-facts.test.ts` → FAIL.
- [ ] **Step 3:** 구현 (marriage-facts.ts 미러 + 위 델타). `getPairRelation().type`=영문 리터럴 주의.
- [ ] **Step 4:** 테스트 PASS.
- [ ] **Step 5:** commit `feat(wealth): 재성·재를감당·식상생재·군겁쟁재·타이밍 결정론 엔진`

## Task 2: 등급 + 일관성 helper

**Files:** Create `lib/wealth-grade.ts`(+test), `lib/wealth-consistency.ts`(+test)

- `computeWealthGrade` = `lib/marriage-grade.ts`의 `computeMarriageGrade` **동일 컷**(≥90 SS/≥82 S/≥72 A/≥55 B/else C), 인자명만 wealthScore. 테스트 동일 경계.
- `assertWealthConsistency({grade, wealthScore, facts})` = `lib/marriage-consistency.ts` 미러. 체크: grade === computeWealthGrade(wealthScore).grade; jaeseongType가 jaeseong 배열과 정합; jaedaShinyak↔jaeToGamdang="약" 정합. (성별-배우자성 체크는 재물엔 없음 → 제거)
- [ ] TDD 각 파일(marriage 대응 테스트 미러) → PASS → commit `feat(wealth): 재물운 등급 결정론 매핑 + 일관성 helper`

## Task 3: 코인 상수 + 마이그레이션

**Files:** Modify `lib/constants/coins.ts`; Create `supabase/migrations/20260718_wealth_results.sql`

- `export const WEALTH_COST = 10;` (MARRIAGE_COST 아래).
- SQL = `supabase/migrations/20260718_marriage_results.sql` 미러. 테이블 `wealth_results`/`wealth_result_unlocks`. 컬럼 델타: `marital_status`→`interest text not null`; meta = `wealth_grade / jaeseong_type / jaeda_shinyak bool / sikssang_saengjae bool / gunggeob_jaengjae bool / jae_grip text`(강/중/약). unique (user_id, input_hash, interest) + order_id unique + owner check + RLS enable(둘 다). **DB 적용은 defer**.
- [ ] 상수 import 확인 `node --import tsx -e "import {WEALTH_COST} from './lib/constants/coins'; console.log(WEALTH_COST)"` → 10. SQL 파일 존재 확인. commit `feat(wealth): WEALTH_COST=10 + wealth_results 테이블(RLS, interest 4분법)`

## Task 4: 프롬프트 빌더 + 품질 가드

**Files:** Create `lib/wealth-prompt.ts`, `prompts/history/wealth-v1.md`, `lib/wealth-postprocess.ts`(+test)

- `buildWealthPrompt(facts: WealthFacts, grade, sajuText): string` — `lib/wealth-prompt.ts` 미러 of `lib/marriage-prompt.ts`. 완전 저술(플레이스홀더 금지). 인코딩:
  - 두루미 톤·시니어 가독성. facts만 해석(새 명리 생성 금지).
  - 블록(스펙 §4): 공통(등급·재성 진단·재를 담는 그릇) → interest별 강조(목돈/투자/사업/지출관리) → 실천 조언(근거 태그) + **CTA=올해의 운세**.
  - 차별화 규칙(개인사주 반복 금지 + 한 단계 아래 해상도).
  - **재물 안전장치(§6)**: 숙명론/공포/서열화 금지, 재다신약=그릇 관리, 투자 손실 단정 금지, 재무자문 아님(종목·상품 금지), 무재=대체경로+대운 입재.
  - 조언 `[근거:...]` 태그.
- `lib/wealth-postprocess.ts` = `lib/marriage-postprocess.ts`(fix 반영본, **재귀 스크럽**) 미러. `applyWealthGuards(parsed, facts, primarySummary)`. 금지 리스트 델타:
  - `FORBIDDEN_PREDICTIONS` = [/가난할 팔자/, /거지 사주/, /돈복(이|은)? 없/, /평생 (돈|재물).{0,4}(못|없)/, /쪽박/, /파산할 (팔자|운명)/, /반드시 손해/, /무조건 (대박|망)/] 등.
  - 재무자문 스크럽: 특정 종목/코인/부동산 상품 권유 문장 제거(휴리스틱 + 로그).
  - 근거태그 없는 조언 컷 + 금지 신살 재귀 스크럽(marriage 로직 계승).
  - 테스트: 숙명론 문장 제거 / 근거태그 없는 조언 컷 / 재무자문 문장 제거 최소 3케이스.
- [ ] tsc + 프롬프트 dry 스모크(`npx tsx -e`) + postprocess 테스트 PASS. commit `feat(wealth): 프롬프트 빌더 + 품질가드(숙명론·재무자문·근거태그)`

## Task 5: from-primary + start + analyze 라우트

**Files:** Create `app/api/wealth/from-primary/route.ts`, `app/api/wealth/start/route.ts`, `app/api/wealth/analyze/route.ts`

- `from-primary` = `app/api/marriage/from-primary/route.ts` 미러. 델타: gender 분기 불필요(로그용만), `deriveWealthFacts(..., interest, ...)` (단 from-primary는 interest 없이 기본값 or teaser용 — 실제 interest는 analyze/start body로). **loveScore→wealthScore**: `normalizeScores(fullJson?.scores).재물운` (marriage가 쓴 `.연애운`을 `.재물운`으로; `lib/resultSchema.ts` 확인). `getSupabaseUserId`·lunar 변환·`error.message` 미노출 그대로.
- `start` = `app/api/marriage/start/route.ts` 미러. body `{ interest }`(4분법 화이트리스트), teaser_json 결정론(grade + jaeseongType), full_json 미포함 upsert.
- `analyze` = `app/api/marriage/analyze/route.ts` **그대로 미러 (refundAndCleanup 포함)**. 델타: `interest` 검증, `computeWealthGrade`, `assertWealthConsistency`, `buildWealthPrompt`, `applyWealthGuards`, `wealth_results` 저장(meta 컬럼). 순서·멱등·환불·23505 처리 동일.
- [ ] `npx tsc --noEmit` clean. 라이브/유료 스모크 defer(운영자 수동 스텝 리포트). commit `feat(wealth): from-primary/start/analyze — 멱등차감·일관성·Gemini·가드·환불`

## Task 6: results/list 조회 + 공유

**Files:** Create `app/api/wealth/results/route.ts`, `app/api/wealth/list/route.ts`, `lib/share-wealth.ts`

- 각각 `app/api/marriage/{results,list}/route.ts` + `lib/share-marriage.ts` 미러. `wealth_results`, 컬럼명 마이그레이션 대조. **소유권 user_id 스코프**(id 조회에 `.eq("user_id", uid)` 필수), `error.message` 미노출(marriage가 고친 yearly 버그 답습 금지).
- [ ] tsc clean. commit `feat(wealth): results/list 조회 + 공유 카드`

## Task 7: 입력 화면 + 결과표 + 배경

**Files:** Create `app/wealth/page.tsx`, `app/wealth/MarriageEntryClient.tsx`→`WealthEntryClient.tsx`, `app/wealth/input/page.tsx`, `app/wealth/result/page.tsx`, `app/wealth/result/WealthResultClient.tsx`; Asset `public/images/wealth/bg-wealth.webp`

- 진입/입력 = `app/marriage/page.tsx` + `MarriageEntryClient.tsx` + `app/marriage/input/page.tsx` 미러. 델타: 4분법 = **재물 관심사**(목돈/투자/사업/지출관리), 프리필 없음(새 질문이라 기본 미선택 or 첫 항목), start→analyze→`/wealth/result`. 402 충전·시니어 가독성·중립 카피.
- 결과표 = `app/marriage/result/{page,MarriageResultClient}.tsx` 미러 → `WealthResultClient.tsx`. 델타: 블록 키 = `buildWealthPrompt` 출력 스키마와 1:1. 게이지 = 재성 강약 + 재를 담는 그릇(`jae_grip` 실데이터, fabrication 0). CTA 버튼 → `/yearly`. `marriage_grade`→`wealth_grade` 표시(내부 등급 역매핑 동일). teaser/full null 가드.
- **배경 `bg-wealth.webp`**: 골드/앰버 추상(동전빛·상승 광맥, 인물·두루미 없음, 하단 여백). OpeningScene에 `bg-love`와 동일 처리(object-top opacity-[0.65] + `from-background-primary/30 via-/20 to-background-primary` 베일). 생성은 컨트롤러가 별도(유료) — 없으면 임시로 배경 없이 글로우만.
- [ ] tsc clean. 시각 수동 QA defer. commit `feat(wealth): 입력·결과표(스크롤 내러티브)+골드 추상 배경`

## Task 8: 홈/메뉴 + 화이트리스트 + 빌드

**Files:** Modify `app/menu/page.tsx`, `app/MenuDrawer.tsx`, `hooks/useCharge.ts`, `app/coins/charge-success/page.tsx`

- `/menu` 카드 1개(결혼운 옆, 골드 액센트, `/wealth` 링크, "재물운" + 서브카피, hover/pressed) + MenuDrawer 엔트리(양 auth 분기). charge-success 화이트리스트에 `/wealth`·`/wealth/input`(useCharge + charge-success 둘 다, 라벨맵 포함).
- [ ] **`npx next build` 성공**(재물 파일 에러 0). 무관 pre-existing 에러면 BLOCKED 리포트. commit `feat(wealth): 홈·메뉴 진입 카드 + charge 화이트리스트`

## Task 9(검수): 명리 critic — 운영자 실행(유료)

- 실제 케이스 3종(정재우세 목돈 / 편재 투자 / 재다신약 지출관리)로 리포트 생성 → 엔진 facts 대조(fabrication 0), 재물 안전장치(숙명론·재무자문) 위반, 차별화, 근거태그 점검 → 수정. **마이그레이션 적용·Gemini 생성 필요 = 운영자/컨트롤러 유료 실행.**

---

## Self-Review

- 스펙 커버리지: §2 입력→T5/T7 · §3 엔진→T1 · §4 블록/등급/CTA→T2/T4/T7 · §5 기술/테이블/결제/배경→T3/T5/T7 · §6 차별화/일관성/안전장치→T2/T4 · §7 멱등·환불·critic→T5/T2/T9 ✓
- 플레이스홀더: 결정론 새 로직(T1 엔진·T4 가드 금지리스트)은 명시. 미러 태스크는 "대응 marriage 파일 + 델타"(검증된 실코드 참조, CLAUDE.md 광범위 리팩토링 금지). 각 미러 태스크 tsc/스모크로 마감.
- 타입 일관성: WealthFacts·WealthInterest·computeWealthGrade·deriveWealthFacts·applyWealthGuards·assertWealthConsistency 일치.
- 착수 전 확인: `normalizeScores(...).재물운` 경로(resultSchema), 재고(財庫) 파생 가능 여부(불가시 false+로그), getPairRelation 리터럴.
