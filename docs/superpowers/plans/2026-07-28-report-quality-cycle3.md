# 심층 리포트(결혼·재물·커리어) 3차 품질 사이클 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실사용 15건 검수(결혼5·재물5·커리어5)에서 확정된 결함 9종 중 1차 범위(①궁위 fabrication ②가드 치환 비문 ③지시어 노출 ⑤등급 노출 + 싸게 붙는 ⑥⑦⑧⑨ 일부)를 제거한다. ④advice/블록 패러프레이즈 반복은 다음 사이클로 미루되, 이번에 **측정 도구만** 만든다.

**Architecture:** 결정론으로 잡을 수 있는 것(가드 정규식·투출어휘 검증·연도 화이트리스트·등급-grip 간극 감지)은 전부 postprocess/facts 층에서 잡고 유닛테스트로 검증한다. LLM 행동 변화(표현 규칙·예시 교체·톤 조율)는 프롬프트에서 고치고 **반드시 실 Gemini 배치 생성으로 눈검수**한다. 이 구분이 이 계획의 뼈대다.

**Tech Stack:** Next.js 15 + TypeScript, Gemini API(`callGemini` in `lib/analysis.ts` — **Claude 아님**), Supabase. 유닛테스트 = `node --import tsx --test lib/<파일>.test.ts` (`node:test` + `node:assert/strict`).

**Branch:** `fix/report-quality-cycle3` (origin/main 4920f51 기준, 체크아웃 완료). main 머지/배포는 운영자 명시 허용 필요.

---

## 검증 방법 이원화 (전 Task 공통 원칙)

| 변화 종류 | 검증 방법 | 이유 |
|---|---|---|
| **결정론 변화** (가드 정규식, 투출어휘 검증기, 연도 화이트리스트, factBlock 라인 추가, UI 태그 매핑) | 유닛테스트 (실패 케이스 = 이번 검수의 실제 사고 문장을 fixture로 박제) | 코드가 직접 결정 — Gemini 불필요 |
| **LLM 행동 변화** (프롬프트 표현 규칙, 예시 교체, 톤 조율, teaser 지시) | **실 Gemini 배치 생성 + 눈검수** (`scripts/enrich-quality-test.mts`, `scripts/career-report-batch.ts`) | 프롬프트 준수는 유닛테스트로 검증 불가 — 기존 사이클의 핵심 교훈 |

**실 Gemini 배치는 전부 비용 발생 — 실행 전 운영자 승인 필수** (feedback_generation_approval). 이 계획에서 비용 지점은 Phase 2 검증배치, Phase 4 검증배치, 최종 통합배치 3곳이다(아래 §비용 참조).

---

## 근본원인 확정 결과 (코드 실측 — 2026-07-28)

계획 착수 전 코드를 읽어 브리프의 가설을 검증했다. **추측이 아니라 아래가 확정 사실이다.**

### ① 궁위 fabrication — 가설 "sajuText가 위치를 안 넘겨 LLM이 역산" → **부분 기각, 진짜 병목 별도 확정**

- `lib/utils/saju-enrichment.ts:1458` — sajuText의 십성 라인은 `십성: ${data.tenStars.join(" ")}` 로 **중복제거 나열이 맞고 위치·층위도 없다**(`calculateTenStars`는 천간 3개 + 지지 **본기만**, Set 중복제거). 이의준 사주에서 재성이 목록에 안 뜨는 이유(戊·己가 寅·午의 여기/중기라 본기 아님)도 이것.
- **그러나** 세 검사의 사실 블록은 이미 위치+층위를 정확히 공급한다: `marriage-facts.ts:13` `SpouseStarHit { pillar, source: "천간"|"지장간", star }` → `marriage-prompt.ts:24-29`가 `편재(월주·지장간)` 형태로 프롬프트에 넣는다. wealth(`WealthStarHit`)·career(`CareerStarHit`)도 동일. **이의준 리포트의 "월주에 편재"는 위치 역산 오류가 아니라 facts의 `편재(월주·지장간)` hit를 그대로 받아 층위만 "떠 있다"(투출)로 승격한 것.**
- **진짜 병목 3가지 (전부 코드로 확인):**
  1. **프롬프트의 좋은 문장 예시가 투출 어휘를 프라이밍**: `marriage-prompt.ts:206` "배우자성이 **월주에 떠 있어**", `wealth-prompt.ts:347` "월주에 편재가 **떡 하니 떠 있어**", `wealth-prompt.ts:257` "월주에 편재가 **투출해 있어서**" — 출처(천간/지장간) 조건 없이 위치가 있으면 이 표현을 쓰라고 가르치는 셈.
  2. **출처별 표현 규칙 부재**: "출처가 지장간이면 '떠 있다/투출/뚜렷' 금지" 규칙이 세 프롬프트 어디에도 없다.
  3. **사실 블록 라벨이 자기설명적이지 않음**: `편재(월주·지장간)` — LLM에게 "지장간=겉으로 안 드러남"이라는 해석 지침이 라벨에 없다.
- 부차 요인: sajuText 십성 목록(재성 없음)과 사실 블록(편재 탐지)이 **서로 모순돼 보이는 신호**를 동시에 줌.
- 결론: 수정은 (a) 결정론 투출어휘 가드 신설 (b) 프롬프트 예시·규칙 수정 (c) 사실 블록 라벨 강화 3축. sajuText 자체 변경은 개인사주/yearly/battle 전 파이프라인 파급이라 **하지 않는다**(아래 리스크 참조).

### ② 가드 치환 비문 — 3건 전부 코드 지점 확정

- **"이런 구조(...)이라고 불러"**: `wealth-postprocess.ts:212-217` `scrubGripTerms`가 `재다신약`→`이런 구조` 단순 치환. 원문 "'재다신약(…)**이라고** 불러"에서 받침 있는 '약' 뒤 조사 '이라고'가 모음 '조' 뒤에 남아 비문. career(`career-postprocess.ts:193`)도 동일 구조.
- **"(신금)" 고아 괄호**: `scrubHanja`(`marriage-postprocess.ts:74-83`)가 `申(신금)`에서 한자만 지우면 `(신금)`이 남는데, 후속 정리 정규식은 **빈 괄호만** 지운다 — 내용 있는 고아 괄호는 그대로 출고.
- **"7: 유지"**: `scrubStrayDecimals`의 정수 강도 패턴 `/\s?\d{1,2}\s*(정도|쯤)(으?로|의|는|야|지)?/`(`wealth-postprocess.ts:205`)가 "7:**3 정도로** 유지"의 "3 정도로"를 삼켜 "7: 유지"가 남음. 비율(`:` 뒤 숫자) 문맥 제외 조건이 없다.

### ③ 지시어 노출 — regen note가 기법 이름을 문장으로 주입

- `validateWealthRichness`/`validateMarriageRichness`/`validateCareerRichness`의 미달 메시지에 "**재미 기법(생생한 비유·펀치라인)**도 더 얹어라"가 들어 있고, `qa-regen.ts:77`이 이 문장을 재생성 프롬프트에 그대로 덧붙인다 → 모델이 "펀치라인: …" 라벨을 본문에 새김. marriage-2가 3필드에서 노출된 경위와 일치(richness 미달 → regen note 주입 경로).

### ⑤ 등급 알파벳 노출 — 정규식이 한 방향만 커버

- `GRADE_ALPHA = /(SS|[SABCD])\s*등급(...)?/g` (3파일 공통) — "B등급"은 잡지만 **"등급은 B"** 역방향은 미커버. marriage-4 "등급은 B지만" 통과 경위 확정.

### ⑥ 크로스 유저 클리셰 — **프롬프트 예시 자체가 복제원 (실측 일치)**

- "목돈이 통장에 찍히는 날"(재물 4/5) = `wealth-prompt.ts:212` 예시 "**목돈이 통장에 찍힌 날**" 그대로.
- "인수인계 자료"(커리어 4/5) = `career-prompt.ts:237`의 **안티클리셰 대체 예시** "예: 인수인계 자료를 넘기던 손" — 소진된 4장면을 피하라고 준 예시가 역으로 새 클리셰가 됨.
- "문고리를 네가 잡고"(결혼 2건) = `marriage-prompt.ts:116` 펀치라인 예시 그대로 ("베끼지 마라" 명시에도 복제됨).
- 결론: "그대로 베끼지 마라" 문구는 효과 없음 — **구체 lexical 예시 문구 자체를 제거/추상화**해야 한다.

### ⑦ 근거 없는 "매력의 해"·대운 얼버무림

- `marriage-prompt.ts:138`이 매력부각 트리거를 "매력이 도는 해"로 풀라고 지시 → 모델이 이 표현을 **트리거 없는 해에도** 일반화 적용. 결정론 검증(본문 연도 vs timingWindows 트리거 대조)은 현재 없음.
- wealth-4 대운: 프롬프트 규칙("없는 대운 지어내지 마라")은 있으나 결정론 2차망 없음 — `[대운] 값: 없음`인데 본문에 "39세부터 48세까지 편재 대운" 생성됨.

### ⑧ 등급-grip 온도 충돌 — 구조적으로 독립 확정

- `wealth-grade.ts`: 등급 = 개인사주 재물운 점수 결정론 매핑. `wealth-facts.ts` jaeGrip = weighted 십성 강도 별도 판정. 두 축을 잇는 코드/프롬프트 지시가 전혀 없음 → S등급 + 신약재소 시 본문이 grip 톤("신약한 그릇")으로 기울어 등급과 온도 불일치.

### ⑨ 소소한 것들

- advice `.tag`는 walk 스크럽에서 의도적으로 제외(2026-07-21 상시 재생성 결함 수정) — 그런데 `parseAdviceTag`(3개 result client)가 태그 내용을 **칩으로 그대로 노출** → `[근거:재다신약]`이 유저에게 보임. 수정 지점은 스크럽이 아니라 **렌더 층 매핑**이어야 함(과거 교훈 (d) 유지).
- "5G급"은 이미 프롬프트 금지 목록에 있으나(`wealth-prompt.ts:214`) 누출됨 → 결정론 스크럽 부재.
- teaser "등급은 조금 아쉽지만": teaserSummary 지시가 "등급 결 암시"를 요구하면서 "등급제 메타 언어 금지"는 없음.
- career-2 훈장 명령조: 프롬프트에 advice 어미 지정 없음(본문 어미 규칙만 존재).

---

## 우선순위 판단 — 운영자 방침(①②③⑤ 1차, ④ 차기)에 대한 ⑥⑦⑧⑨ 배치 제안

| 결함 | 배치 | 근거 |
|---|---|---|
| ⑦ 타이밍 fabrication | **1차 (Phase 3)** | ①과 같은 "fabrication" 클래스 — 유료 신뢰 직격. 결정론 연도 화이트리스트로 잡을 수 있어 검증도 유닛테스트(싸다). |
| ⑨ tag 칩 노출·비율/괄호 비문류 | **1차 (Phase 1)** | 전부 결정론·저위험. ②⑤ 가드 작업과 같은 파일을 만지므로 같은 PR이 오히려 싸다. |
| ⑧ 등급-grip 온도 | **1차 (Phase 4)** | 서버 감지 로직은 결정론 5줄(등급×grip 매트릭스), 프롬프트 라인 1개. S/A 등급 유료 유저 불만은 환불 리스크라 미루기 아깝다. 단 톤 검증은 실생성이라 Phase 4(프롬프트 배치)에 편승. |
| ⑥ 클리셰 | **1차 (Phase 4) — 단, 예시 문구 교체까지만** | 근본원인이 "프롬프트 예시 복제"로 확정돼 수정이 국소적(예시 문구 삭제·추상화). 새 금지 패턴 나열은 하지 않는다(프라이밍 역효과 교훈 (c)). 완전한 다양성 엔지니어링(시드 로테이션 등)은 차기. |
| ⑨ 명령조·teaser 메타 | **1차 (Phase 4)** | 프롬프트 한두 줄 — Phase 4 실생성 검증에 무임승차. |
| ④ 패러프레이즈 반복 | **차기 사이클 — 이번엔 측정 도구만 (Phase 5)** | 운영자 방침 유지. 프롬프트로 밀면 richness 하한과 충돌해 튜닝 루프가 길다. 이번에 측정기를 만들어 차기 사이클의 착수 데이터를 확보. |

---

## Global Constraints

- **가드는 "제거"보다 "치환"** — 한국어 조사 파손 리스크(교훈 (a)). 치환 후 조사 정규화까지 책임진다.
- **정규식에 한자 리터럴 금지** — `\uXXXX` 이스케이프만(교훈 (b)). 기존 `career-postprocess.ts:92`의 리터럴 범위(`㐀-鿿`)도 이번에 `\u` 표기로 통일.
- **금지 패턴 무차별 나열 금지** — 상위 패턴만 negative example(교훈 (c)).
- **advice `.tag`는 스크럽 대상에서 계속 제외**(교훈 (d)) — 태그 노출 문제는 렌더 층에서 푼다.
- **3검사 정합**: marriage/wealth/career postprocess는 복제 관계 — 한쪽 가드 수정 시 **세 파일 전수 이식 + 세 테스트 파일 전수 갱신**이 Task 완료 조건(feedback_shared_validator_audit).
- 결제/차감/환불 로직(analyze 라우트의 멱등·orphan 구간)은 **한 줄도 건드리지 않는다.**
- 프롬프트 수정 시 `prompts/history/`에 스냅샷 저장 + 이전 버전 diff 요지(CLAUDE.md 규칙): `marriage-v5.md` / `wealth-v4.md` / `career-v2.md`.
- dev 서버 돌 때 `npx next build` 금지. 배포 전 build 성공 확인.
- 실 Gemini 생성 배치는 **매번 운영자 승인 후 실행.**

---

## 실행자용 코드베이스 지도 (읽기 전용 배경)

| 파일 | 역할 · 이번 사이클 관련 지점 |
|---|---|
| `lib/{marriage,wealth,career}-facts.ts` | 결정론 facts. StarHit에 `pillar`+`source("천간"/"지장간")` 이미 존재. timingWindows·daeun 산출부. |
| `lib/{marriage,wealth,career}-prompt.ts` | 프롬프트 조립. `buildFactBlock`(사실 블록 라벨), SYSTEM_RULES(표현 규칙·좋은 문장 예시), OUTPUT_SCHEMA. |
| `lib/{marriage,wealth,career}-postprocess.ts` | 가드 3형제(복제 관계). `applyXGuards`(scrubHanja/scrubStrayDecimals/scrubGripTerms/scrubGradeAlpha/walk), `validateXRichness`(regen note 문구 — ③ 누출원). |
| `lib/qa-regen.ts` | 공용 재생성 루프. violations+softIssues를 `extra`로 프롬프트에 덧붙임(**여기 문구가 본문에 새는 경로**). |
| `lib/fortune-timeline.ts` | 서버 결정론 타임라인. `sliceWindow` = currentYear−1..+5. Phase 3 연도 화이트리스트의 재료. |
| `app/api/{marriage,wealth,career}/analyze/route.ts` | generateWithQaRegen 배선, guard_violations 감사 기록. **이번 사이클은 라우트 수정 없음이 원칙**(가드/프롬프트 함수 내부만). Phase 3에서 softValidate에 facts를 클로저로 넘기는 1줄 변경만 있음. |
| `app/{marriage,wealth,career}/result/*Client.tsx` | `parseAdviceTag` — 태그 칩 렌더(⑨ 수정 지점, 각 파일 하단 helper). |
| `scripts/enrich-quality-test.mts` | 합성 5명 × 결혼+재물 실파이프라인 배치(운영자 본인 포함). |
| `scripts/career-report-batch.ts` | 커리어 배치(프로덕션 경로 재현, 마크다운 저장). |
| `scripts/wm-guard-stats.mts` | 배포 후 guard_violations 집계(읽기 전용). |
| `scripts/wm-repeat-phrases.mts` | 12자 윈도우 문서빈도 반복구 측정 — ⑥ 전후 비교 도구. |

테스트 실행: `node --import tsx --test lib/<파일>.test.ts`.

---

# Phase 1 — 가드 결함 수정 (②⑤⑨ 결정론 — 전부 유닛테스트 검증)

**목표:** 가드가 위반을 잡고도 비문/노출을 출고하던 3경로 + 역방향 등급 노출 + tag 칩 전문용어 노출을 결정론으로 봉인. **이번 검수에서 나온 실제 사고 문장을 그대로 테스트 fixture로 박제**하는 것이 완료 조건.

### Task 1: 공용 스크럽 모듈 추출 `lib/report-scrub.ts`

**Files:** Create `lib/report-scrub.ts`, `lib/report-scrub.test.ts` / Edit `lib/{marriage,wealth,career}-postprocess.ts`(import로 교체)

**변경 요지:**
- 세 postprocess에 **동일 코드로 3벌 복제**된 도메인 중립 스크럽(`scrubHanja`, `scrubStrayDecimals`, `collapseEchoParens`, `GRADE_ALPHA` 스크럽, grip 치환 팩토리)을 단일 모듈로 추출. 이후 Task 2~5의 수정을 **한 곳에서** 하고 3검사가 자동으로 공유하게 만든다 — 이번 검수에서 확인된 "3벌 드리프트"(career만 한자 리터럴 정규식) 자체가 리스크.
- 도메인 고유 목록(FORBIDDEN_PREDICTIONS, FORBIDDEN_SHINSAL, 재무자문/실행단정 패턴, richness)은 각 파일에 **그대로 남긴다** — 이 Task는 순수 이동+참조 교체, 동작 변화 0.
- 한자 범위는 전부 `㐀-鿿豈-﫿` 이스케이프 표기로 통일(교훈 (b)).

**검증(유닛):** 기존 `lib/{marriage,wealth,career}-postprocess.test.ts` 전체 통과(동작 불변 증명) + 새 `report-scrub.test.ts`에 함수별 기본 케이스. 실생성 불필요.

- [ ] Step 1: 기존 3개 postprocess 테스트 실행해 green 기준선 확보
- [ ] Step 2: `lib/report-scrub.ts` 추출(이동만, 로직 수정 금지) + 3파일 import 교체
- [ ] Step 3: 3개 테스트 재실행 green + `npx tsc --noEmit`(또는 build) 통과

### Task 2: 비율 오폭 수정 — "7:3 정도로" 보존 (②-c)

**Files:** Edit `lib/report-scrub.ts` / Test `lib/report-scrub.test.ts`

**변경 요지:** `scrubStrayDecimals`의 정수 패턴 `\s?\d{1,2}\s*(정도|쯤)…`에 **비율·구간 문맥 제외**를 추가: 직전 문자가 `:`·`~`·`대`·숫자인 경우 미매치(lookbehind `(?<![\d:~대])`). "강도/힘/세력/기운 + 숫자" 패턴은 유지(원래 목적).

**검증(유닛):** fixture — `"투자 비중을 7:3 정도로 유지하는 걸"` → **원문 보존**, `"힘도 5 정도로"` → 기존대로 제거, `"2028년쯤"`·`"34세쯤"` 비파손 회귀 케이스.

- [ ] Step 1: 실패 테스트 작성(위 fixture) → red 확인
- [ ] Step 2: lookbehind 추가 → green

### Task 3: 한자+독음 괄호 unwrap — "(신금)" 고아 괄호 해소 (②-b)

**Files:** Edit `lib/report-scrub.ts` / Test `lib/report-scrub.test.ts`

**변경 요지:** `scrubHanja`의 무차별 제거 **앞단**에 "한자 토큰 + (한글 독음 괄호)" 패턴을 독음으로 unwrap하는 전처리 추가: `/[㐀-鿿豈-﫿]+\s*\(\s*([가-힣][가-힣\s·]{0,8})\s*\)/g` → `$1`. `申(신금)` → `신금`, `巳(사화)와는` → `사화와는`. 정상 뜻풀이 괄호(`편재(유동적인 큰돈)`)는 선행이 한글이라 미매치.

**검증(유닛):** fixture — `"네 배우자 자리는 申(신금)이야"` → `"네 배우자 자리는 신금이야"`, `"巳(사화)와는 합"` → `"사화와는 합"`, `"편재(유동적인 큰돈)"` 무변형, `"홍염살(紅艶殺)의"` → `"홍염살의"`(기존 동작 유지 — 괄호 안이 한자면 기존 경로).

- [ ] Step 1: 실패 테스트(marriage-2 실측 문장 3종) → red
- [ ] Step 2: unwrap 전처리 구현 → green

### Task 4: grip 치환 조사 정합 — "이런 구조이라고 불러" 해소 (②-a)

**Files:** Edit `lib/report-scrub.ts`(치환 팩토리) / Test `lib/report-scrub.test.ts`

**변경 요지 (2단):**
1. **명명 구문 감지 시 절 제거**: grip 용어가 `X(뜻풀이)?(이?라고|이?라)\s*(불러|부른다|부르|하는데|해)` 명명 프레임에 있으면 — 이 문장은 "용어 소개" 자체가 목적이라 치환해도 값어치가 없다 — 해당 **문장을 컷**하고 violation 기록(→ qa-regen 1회 재생성 유도, 문장 컷은 기존 scrubForbiddenSentences와 동일 안전 등급).
2. **일반 위치 치환 후 조사 정규화**: 명명 프레임이 아니면 기존대로 "이런 구조"로 치환하되, 치환 직후 `구조이(라고|라|다)` → `구조$1`·`구조이가` 류 조사 파손을 정규화하는 후처리를 치환 팩토리에 내장(치환어가 모음 종결이므로 "이" 계열 조사만 정리하면 충분).

**검증(유닛):** fixture — 실측 사고 문장 `"명리학에서는 이걸 재다신약(재물 기운은 강한데 일간의 힘이 약함)이라고 불러"` → 문장 컷+violation, `"재다신약이라 관리가 관건이야"` → `"이런 구조라 관리가 관건이야"`(조사 정상), career `관다신약` 동일 케이스.

- [ ] Step 1: 실패 테스트(사고 문장 fixture) → red
- [ ] Step 2: 명명 프레임 컷 + 조사 정규화 구현 → green
- [ ] Step 3: wealth/career 양쪽 GRIP_TERMS로 팩토리 호출되는지 확인(3검사 정합)

### Task 5: 등급 노출 역방향 + teaser 메타 (⑤)

**Files:** Edit `lib/report-scrub.ts` / Test `lib/report-scrub.test.ts`

**변경 요지:** `GRADE_ALPHA`(알파벳→등급 순서)에 더해 **역방향 패턴** `등급[은는이]?\s*(SS|[SABCD])(?![A-Za-z가-힣])` 추가. 역방향 매치는 알파벳만 지우면 "등급은 지만" 비문이 남으므로 **문장 단위 컷 + violation**(regen이 새로 쓰게 — Task 4와 동일 원칙: 조사 파손 위험이 있는 자리는 치환 대신 문장 컷+재생성).

**검증(유닛):** fixture — `"인연의 등급은 B지만 흐름은 좋아"` → 문장 컷+violation, `"B등급다운"` 기존 동작 유지, `"등급은 최상위권이야"`(알파벳 없음) 무변형, `"Business"`류 오탐 없음.

- [ ] Step 1: 실패 테스트(marriage-4 실측 문장) → red
- [ ] Step 2: 역방향 패턴 + 문장 컷 구현 → green

### Task 6: advice tag 칩 렌더 매핑 (⑨-tag)

**Files:** Edit `app/{marriage,wealth,career}/result/*Client.tsx`(각 `parseAdviceTag` 인근) / Create `lib/advice-tag-label.ts` + `lib/advice-tag-label.test.ts`

**변경 요지:** 스크럽은 건드리지 않는다(교훈 (d) — tag 원문은 그대로 저장·유통). **렌더 직전에만** 전문용어→친화 라벨 매핑: `재다신약`→`재물 그릇`, `신약재소`→`차곡차곡형`, `신왕재쇠`→`그릇 키우기`, `관다신약`→`책임 그릇`, `군겁쟁재`→`몫 지키기`, `상관견관`→`소통 결`, `비겁극재`→`곳간 단속`, `충거`→`흔들림 관리` 등(정확한 문안은 feedback_saju_terms의 용어 정책과 맞춰 구현 시 확정, 매핑에 없는 태그는 원문 통과). 매핑 테이블은 `lib/advice-tag-label.ts` 한 곳에 두고 세 클라이언트가 공유.

**검증(유닛):** 매핑 함수 단독 테스트(미등록 태그 원문 통과 포함). UI 확인은 최종 통합배치 후 로컬 화면 1회.

- [ ] Step 1: 매핑 모듈+테스트 작성
- [ ] Step 2: 3개 result client의 칩 렌더에 적용

### Task 7: "5G급"류 유행어 결정론 스크럽 (⑨-슬랭)

**Files:** Edit `lib/report-scrub.ts` / Test

**변경 요지:** 프롬프트 금지가 이미 있는데 새는 **확정 유행어만** 소수 정예로 조용히 치환(재생성 불필요): `5G급`→`빛의 속도로`, `팩폭|팩트폭격`→`직언`, `겉바속촉` 제거식 아님·치환식. 목록은 이번 검수 실측 누출("5G급") + 프롬프트 금지 목록 교집합만 — 무차별 나열 금지(교훈 (c)는 프롬프트 프라이밍 이슈지만, 후처리도 목록 비대화는 유지보수 부채라 동일 원칙 적용).

**검증(유닛):** `"결정 속도가 5G급이야"` → 치환 후 자연문.

- [ ] Step 1: 테스트 → 구현

---

# Phase 2 — 궁위 fabrication 봉인 (① — 결정론 가드 + 프롬프트, 1차 최우선)

**목표:** "지장간에만 있는 십성을 투출처럼 서술"을 (a) 결정론 2차망으로 잡고 (b) 프롬프트 1차망(표현 규칙+예시 수정)으로 발생 자체를 줄인다. 지장간 본기/속결 해석 능력은 정확했으므로 **지장간 언급 자체는 막지 않는다** — 강조어 결합만 막는다.

### Task 8: 투출어휘 결정론 가드 `lib/report-scrub.ts` + 3검사 배선

**Files:** Edit `lib/report-scrub.ts`(검증기 신설), `lib/{marriage,wealth,career}-postprocess.ts`(applyXGuards에서 facts의 StarHit 배열로 호출) / Test `lib/report-scrub.test.ts` + 3개 postprocess 테스트

**변경 요지:**
- 신규 함수 `detectProtrusionFabrication(text, hits: {pillar, source, star}[], starWords: string[]): string[]`:
  1. **층위 승격 감지**: 본문에서 `(년주|월주|일주|시주)` ± 25자 안에 대상 십성(정관·편관·정재·편재)과 투출 어휘(`떠\s*있|투출|뚜렷|떡\s*하니|박혀|또렷이\s*자리`)가 공존하는데, facts에 그 (기둥, 십성) 조합의 `source==="천간"` hit가 **없으면** violation. (어순 양방향 — "월주에 편재가 떠" / "편재가 월주에 뚜렷하게".)
  2. **무근거 위치 감지**: 언급된 (기둥, 십성) 조합이 facts hits에 **아예 없으면**(지장간으로도) 더 강한 violation.
- 처리 방침: violation은 문장 컷이 아니라 **위반 메시지만 기록** → qa-regen 재생성 유도("○○는 월주 지장간에만 있다 — '떠 있다/투출' 대신 '지지 속에 품고 있다'로 다시 써라" 형태의 자기설명 메시지). 재생성 후에도 잔존하면 **표현만 치환**: `뚜렷하게 떠 있|떡 하니 떠 있|투출해 있` → `지지 깊숙이 깔려 있`(동사구 치환이라 조사 안전) — 문장 컷은 spouseStar/jaeseongDiagnosis 핵심 블록을 도려낼 위험이 있어 쓰지 않는다.
- applyXGuards 시그니처는 이미 `facts`를 받고 있으므로(`applyWealthGuards(parsed, facts, …)`) 라우트 변경 없음. marriage=spouseStars(+관성·재성 어휘), wealth=jaeseong, career=gwanseong을 각자 배선.

**검증(유닛):** 이의준 실측 재현 fixture — hits=`[{month,지장간,편재},{day,지장간,정재}]`, 본문 `"월주에 편재가 떡 하니 떠 있으니"` → violation, `"월주 지지 속에 편재가 숨어 있어"` → 통과, `"년주에 정관이 떠 있어"`(hit 자체 없음) → 강한 violation, 천간 투출 실존 케이스 → 통과. 재생성 실패 시 치환 결과 자연문 확인.

- [ ] Step 1: 실패 테스트(이의준 케이스 포함 6 fixture) → red
- [ ] Step 2: 검증기 구현 + 3검사 배선 → green
- [ ] Step 3: 3검사 postprocess 테스트에 각자 도메인 fixture 1개씩 추가(정합 증거)

### Task 9: 프롬프트 — 출처별 표현 규칙 + 예시 조건화 + 사실 라벨 강화

**Files:** Edit `lib/{marriage,wealth,career}-prompt.ts` / Snapshot `prompts/history/{marriage-v5,wealth-v4,career-v2}.md`(Phase 4와 합쳐 1회 저장)

**변경 요지 (3파일 공통 이식):**
1. **사실 블록 라벨 자기설명화**: `formatSpouseStars`/`formatJaeseong`/`formatGwanseong`의 `(월주·지장간)` → `(월주·지장간에 숨음)`, `(월주·천간)` → `(월주·천간에 투출)`. 결정론 문자열 변경이라 유닛테스트 가능.
2. **표현 규칙 신설**(절대 규칙 1 밑에): "출처가 '지장간에 숨음'인 별은 '떠 있다/투출/뚜렷하게 자리잡다'로 쓰지 마라 — 겉으로 드러난 게 아니라 지지 속에 품은 기운이다. '속에 숨어 있다/은은하게 깔려 있다' 결로만 써라. 투출 어휘는 '천간에 투출' 별에만 허용."
3. **좋은 문장 예시 조건화**: "월주에 떠 있어/떡 하니/투출해 있어서" 예시에 "(천간 투출일 때만 이 표현)" 단서 명기 + **지장간 버전 예시 1개 추가**(예: "월주 지지 속에 편재를 품고 있어 — 겉으로 드러내진 않는데, 판이 커지면 그 감각이 올라오는 타입이야" 결).

**검증:** ①번(라벨)은 유닛(프롬프트 스냅샷 문자열 검증 — 기존 `*-prompt.test.ts`에 추가). ②③은 **LLM 행동 → Phase 2 검증배치**(아래) 눈검수.

- [ ] Step 1: 라벨 변경 + 프롬프트 테스트 갱신
- [ ] Step 2: 표현 규칙·예시 3파일 이식(문안 통일)

### Task 10: 【★비용·승인 필요】 Phase 2 검증배치 — fabrication 재현 사주로 실생성

**변경 요지:** 검수 15건 중 fabrication 7건의 사주(이의준 포함 — "지장간에만 재성/관성" 구조)를 `enrich-quality-test.mts`/`career-report-batch.ts`의 인물 배열에 추가해 **결혼·재물·커리어 각 5건 내외 실생성**. 확인 항목: (a) 투출어휘 가드 violation률과 재생성 후 잔존률 (b) 눈검수 — 지장간 별 표현이 자연스러운지(과교정으로 "숨어 있다"가 어색하게 도배되지 않는지) (c) 기존 리포트 대비 풍성함 하락 없는지.

**검증(실생성+눈검수):** fabrication 어휘 0건 + 지장간 서술 자연스러움 합격이 Phase 2 완료 조건. 실패 패턴 발견 시 Task 8 치환어/Task 9 문안 조정 후 재배치(재승인).

- [ ] Step 1: 운영자에게 배치 실행 승인 요청(예상 호출: ~15건 × qa-regen 최대 2회)
- [ ] Step 2: 배치 실행 → 산출 마크다운 눈검수 → 결과 요약 보고

---

# Phase 3 — 타이밍 fabrication 봉인 (⑦ — 결정론 연도 화이트리스트)

**목표:** "매력의 해" 무근거 삽입과 빈 대운 얼버무림을 결정론 2차망으로 잡는다.

### Task 11: 연도·대운 주장 검증기 `lib/report-scrub.ts` + softValidate 배선

**Files:** Edit `lib/report-scrub.ts`, `lib/{marriage,wealth,career}-postprocess.ts`(validateXRichness와 나란한 `validateXTimingClaims` 신설), `app/api/{marriage,wealth,career}/analyze/route.ts`(softValidate 클로저에 facts 전달 — 각 1줄) + 배치 스크립트 동일 배선 / Test 3개 postprocess 테스트

**변경 요지:**
1. **연도 화이트리스트**: 본문 산문에서 `(19|20)\d{2}년` 전수 추출 → 허용집합 = `facts.timingWindows[].year` ∪ 타임라인 창(currentYear−1..+5 — `fortune-timeline.ts` sliceWindow와 동일 상수) ∪ 대운 구간을 연도로 환산한 범위. 밖의 연도 → soft violation("본문의 2035년은 엔진 값에 없다 — [타이밍 창]에 있는 연도로만 다시 써라").
2. **매력 표현 트리거 대조(결혼 전용)**: `매력(이|을).{0,10}(도|부각|살아나|빛나)` ± 20자 안의 연도가 트리거에 `도화홍염` 없는 해면 violation.
3. **대운 무근거 주장**: facts 대운 배열이 비었는데 본문에 `\d{1,2}세(부터|에서).{0,8}\d{1,2}세.{0,6}대운` 또는 `(정재|편재|정관|편관)\s*대운` 패턴 → violation.
- 전부 **soft(재생성 유도) 전용** — 최종 출고는 막지 않는다(richness와 동일 등급). 잔존 시 guard_violations로 감사만.

**검증(유닛):** marriage-0/1/3·wealth-4 실측 케이스 fixture — `"2035년은 네 매력이 부각되는 해야"`(트리거 없음) → violation, 트리거 있는 해 → 통과, `"39세부터 48세까지 편재 대운을 지나왔거나"`(대운 빈 배열) → violation, 정상 timingWindows 인용 → 통과, 대운 범위 안 연도 → 통과(오탐 방지).

- [ ] Step 1: 실패 테스트(실측 4 fixture + 오탐 방지 3 fixture) → red
- [ ] Step 2: 검증기 구현 + 3검사 softValidate 배선(라우트 1줄씩) → green
- [ ] Step 3: Phase 4 통합배치에서 실생성 잔존률 확인(별도 배치 없음 — 무임승차)

---

# Phase 4 — 프롬프트 품질 일괄 (③잔여·⑥·⑧·⑨ — 실생성 검증)

**목표:** LLM 행동 변화를 한 번에 묶어 프롬프트 버전 1회 올리고, 실생성 1회로 함께 검증한다(배치 비용 절약 + 교훈 "일괄 렌더").

### Task 12: regen note·프롬프트 지시어 누출 봉인 (③)

**Files:** Edit `lib/{marriage,wealth,career}-postprocess.ts`(richness 메시지), `lib/report-scrub.ts`(라벨 스크럽) / Test

**변경 요지:**
1. `validateXRichness` 메시지에서 기법 라벨 제거: "재미 기법(생생한 비유·펀치라인)도 …" → "아직 얇은 블록은 이 사람 사주에서 나온 새 그림 한 장면을 더 얹어라" 식 — **모델이 라벨로 베낄 명사를 문장에서 제거**.
2. 결정론 안전망: 문장/블록 서두의 `(펀치라인|비유|장면|훅|반전)\s*[:：]` 라벨을 조용히 strip(스크럽 — 뒤 본문은 보존).

**검증:** ②는 유닛(`"펀치라인: 네가 찾는 그 듬직한 어깨"` → `"네가 찾는 그 듬직한 어깨"`). ①은 Phase 4 통합배치에서 richness 미달을 인위 유발(합성 케이스 maxAttempts 조작 또는 하한 임시 상향)해 regen 경로 눈검수 1회.

- [ ] Step 1: 라벨 스크럽 테스트 → 구현
- [ ] Step 2: 3검사 richness 메시지 리라이트(문안 통일)

### Task 13: 클리셰 복제원 제거 (⑥)

**Files:** Edit `lib/{marriage,wealth,career}-prompt.ts`

**변경 요지:**
1. **복제원 확정 3구절 교체**: wealth "목돈이 통장에 찍힌 날"(212행), career "인수인계 자료를 넘기던 손"(237행), marriage "문고리를 네가 잡고 있어"(116행) — 구체 lexical 예시를 **기법 설명형**으로 바꾼다("그 사람 십성·오행에서 나온 순간 하나를 장면으로" — 명사구 예시 없이). "그대로 베끼지 마라"는 실측상 무력하므로 문구 자체를 없애는 게 유일한 확실한 수단.
2. **상위 반복구만 negative**: 이번 검수 최다 반복 2~3개("목돈이 통장에 찍히는", "인수인계 자료", "결혼까지 진지하게 고민해볼 만한 무게감")만 "이미 소진된 표현" 목록으로 명시(교훈 (c) — 소수 정예).
3. career 장면 지시에 **situation 조건** 명기: "장면은 [커리어 사실]의 situation·직업 상태에 실제로 존재할 수 있는 순간만"(진로탐색 취준생에게 인수인계 방지 — 절대 규칙 7 grounding과 결선).

**검증(실생성):** Task 16 통합배치 후 `scripts/wm-repeat-phrases.mts`를 배치 산출물 대상으로 돌려 30%+ 반복구 감소 확인(현행 대비) + 눈검수.

- [ ] Step 1: 3파일 예시 교체 + negative 소수 정예 반영

### Task 14: 등급-grip 온도 조율 (⑧)

**Files:** Edit `lib/{wealth,career}-prompt.ts`(buildFactBlock + 규칙), (marriage는 grip 축이 없어 제외 — 해당 없음 확인 후 필요시 동일 패턴) / Test `*-prompt.test.ts`

**변경 요지:**
- **서버 결정론 감지**(프롬프트 조립 시): 등급 ∈ {SS,S,A} ∧ grip ∈ {재다신약, 신약재소}(career: 관다신약·신약관소) → factBlock에 조율 라인 추가: `등급-그릇 온도 조율(서버 계산값): 등급은 상위권인데 그릇 신호는 차분한 편 — 본문 전체 온도는 등급(강점·기회)을 기준으로 잡고, 그릇은 '더 오래 가기 위한 관리 포인트' 한 축으로만 짚어라. '그릇이 종지/작다' 류 하향 비유로 리포트 전체를 끌고 가지 마라.` 반대 방향(등급 C × 신왕재왕)도 대칭 라인.
- 감지 함수는 순수 함수로 분리해 유닛테스트(매트릭스 전 조합).

**검증:** 감지 로직=유닛. 톤 반영=Task 16 통합배치에 **S등급×신약재소 재현 사주(wealth-3 사주)** 포함해 눈검수 — "S 받은 유저가 읽어도 온도 일치" 합격 기준.

- [ ] Step 1: 감지 함수+테스트 → factBlock 라인 추가
- [ ] Step 2: 프롬프트 규칙 문안(두 파일 대칭 이식)

### Task 15: advice 어미·teaser 메타 (⑨ 잔여)

**Files:** Edit `lib/{marriage,wealth,career}-prompt.ts`

**변경 요지:**
1. advice 지시에 어미 규칙 1줄: "각 항목은 '~해봐/~해둬/~챙겨' 결의 친구 반말 — '~하라/~해라/~두어라' 훈장 명령조 금지."
2. teaserSummary 지시에: "'등급'이라는 단어 자체를 쓰지 마라(등급제 메타 노출 금지) — 결만 암시."

**검증(실생성):** Task 16 통합배치 눈검수(advice 어미 전수 + teaser 15건 "등급" 단어 0건).

- [ ] Step 1: 3파일 문안 반영 + 프롬프트 스냅샷 저장(`prompts/history/marriage-v5.md`·`wealth-v4.md`·`career-v2.md` — Phase 2 Task 9 변경분 포함, 이전 버전과 diff 요지 필수)

### Task 16: 【★비용·승인 필요】 Phase 4 통합 검증배치

**변경 요지:** `enrich-quality-test.mts`(합성 5명 — 운영자 본인 포함) + `career-report-batch.ts`에 wealth-3(S×신약재소)·진로탐색 취준생 케이스를 추가해 **3검사 × 5~7건 실생성**. 체크리스트:
- ① 투출어휘 위반 0 (Phase 2 회귀 확인)
- ③ "펀치라인:" 류 라벨 0
- ⑥ wm-repeat-phrases 30%+ 반복구 현행 대비 감소, "목돈이 통장/인수인계/문고리" 0
- ⑦ 화이트리스트 밖 연도 잔존 0
- ⑧ S×신약계 케이스 온도 눈검수 합격
- ⑨ advice 어미·teaser "등급" 0
- 회귀: richness 미달률·블록 길이·재미(눈검수)가 현행 대비 하락하지 않을 것

**검증(실생성+눈검수):** 위 체크리스트 전 항목. 미달 항목은 해당 Task로 돌아가 수정 후 부분 재배치(재승인).

- [ ] Step 1: 배치 스크립트에 재현 케이스 추가(코드 — 무비용)
- [ ] Step 2: 운영자 승인 → 배치 실행(예상 호출: ~20건 × 최대 2회)
- [ ] Step 3: 체크리스트 결과 보고 → 합격 시 Phase 4 완료

---

# Phase 5 — ④ 패러프레이즈 반복: 측정 도구만 (이번 사이클은 수정 없음)

**목표:** 12자 문자열 겹침(wm-repeat-phrases)이 못 잡는 "의미 단위 재탕"을 측정할 도구를 만들어, 차기 사이클의 착수 데이터(현행 baseline)를 확보한다. **프롬프트·가드 수정은 하지 않는다**(운영자 방침).

### Task 17: 의미 중복 측정기 `scripts/wm-semantic-dup.mts`

**변경 요지 — 2단 측정(외부 의존 0 우선):**
1. **문장 단위 char-bigram 코사인** (의존성 0, 결정론): 각 리포트를 문장으로 쪼개 (a) advice text ↔ 본문 5블록 문장 최대 유사도 (b) 블록 간 문장쌍 유사도 분포를 계산, 0.55+ 쌍을 리포트당 카운트. 패러프레이즈("겉은 화려, 정착은 안정감" 4회 변주)는 어휘가 겹치는 경우가 많아 상당 부분 잡히지만, **완전 동의어 치환은 못 잡는다** — 한계를 출력에 명시.
2. **LLM-judge 옵션 플래그**(`--judge`, 비용 발생·승인 필요): Gemini Flash에 "이 advice가 본문 결론의 재탕인지 / 새 실행 정보인지" 판정을 위임(리포트당 1호출, 프로덕션 40건 표본 ≈ 40호출 — Flash라 비용 미미하나 승인 대상). wealth-0 "자동 이체 격리" 같은 모범 사례를 few-shot 기준으로.
- **임베딩 API 대안 비용 명시**: Gemini embedding(text-embedding) 사용 시 문장당 1호출로 정밀하지만 신규 API 면(surface) 추가 + 호출량이 judge 방식보다 크다(리포트당 문장 수십 개). 차기 사이클에서 judge 방식이 부족할 때만 검토 권고.
- 프로덕션 게이트(softValidate 편입)는 이번에 **하지 않는다** — 측정 신뢰도 검증 전 게이트화는 오탐 재생성 비용만 키운다.

**검증(유닛+실측):** 코사인 계산 유닛테스트(동일문=1.0, 무관문<0.3, marriage-0 실측 4회 반복 결론 fixture가 0.55+로 잡히는지). 프로덕션 최근 40건 read-only 실측 1회(무비용) → baseline 수치를 차기 사이클 메모에 기록.

- [ ] Step 1: 코사인 측정기+유닛테스트
- [ ] Step 2: 프로덕션 40건 baseline 실측(read-only) → 결과 기록
- [ ] Step 3(선택·승인 필요): --judge 40건 1회 돌려 코사인과 판정 일치율 확인

---

## 리스크 · 롤백

| 지점 | 리스크 | 완화 · 롤백 |
|---|---|---|
| Task 1 공용 모듈 추출 | 이동 중 미세 동작 변화 → 3검사 동시 회귀 | 이동만/수정 금지 분리 커밋 + 기존 테스트 green을 이동 커밋의 게이트로. 롤백 = 해당 커밋 revert(라우트 무변경이라 안전) |
| Task 4·5 문장 컷 확대 | 컷이 과하면 블록이 얇아짐(F-2/richness 걸림) | 컷은 전부 violation 기록 → qa-regen 1회 재생성이 선방어. postGuard `validateXBlocks(minAdvice:1)` 기존 안전망 유지. 배포 후 `wm-guard-stats.mts`로 컷 빈도 감시 — 특정 패턴 오탐 급증 시 해당 정규식만 revert |
| Task 8 투출어휘 가드 | 오탐(정당한 천간 투출 서술을 위반 처리)→ 불필요 재생성 비용 | 판정 근거가 facts hit라 오탐은 "±25자 근접 매칭"의 우연 결합뿐 — fixture에 오탐 케이스 포함. 잔존 시 처리를 문장 컷이 아닌 어구 치환으로 제한(본문 보존) |
| Task 11 연도 화이트리스트 | 대운 나이→연도 환산 경계(세는나이) 오차로 오탐 | 환산 로직은 `fortune.seun`의 (year, age) 쌍에서 역산(자체 계산 금지 — 기존 값 재사용). 경계 ±1년 여유. soft 전용이라 최악도 재생성 1회 |
| Phase 2·4 프롬프트 수정 | 3검사 문안 드리프트 / 한쪽만 반영 | 각 Task 완료 조건에 "3파일 diff 대조" 명시. 프롬프트 스냅샷(prompts/history)에 3파일 동시 저장 |
| 프롬프트 변화의 부작용(재미·풍성함 하락) | 규칙 추가가 표현을 위축시킬 수 있음 | Task 10/16 배치에서 richness·눈검수 회귀 항목 명시. 하락 시 규칙 문안을 금지형→유도형으로 완화 |
| 기존 저장 리포트 | 이번 수정은 신규 생성에만 적용 — 이미 출고된 15건 결함은 남음 | 스코프 밖(과거 grandfather 정책과 동일). 필요 시 운영자 판단으로 해당 유저 재생성은 별도 결정 |

**배포 전 점검 항목:** (1) `node --import tsx --test` 대상: report-scrub·3 postprocess·3 prompt·advice-tag-label 전부 green (2) dev 서버 종료 확인 후 `npx next build` 성공 (3) Task 16 통합배치 체크리스트 합격 (4) 3검사 프롬프트/가드 diff 전수 대조(정합) (5) 배포 후 24~48h `wm-guard-stats.mts`로 신규 violation 패턴·재생성 attempts 분포 확인 (6) 프롬프트 스냅샷 3종 커밋 포함.

---

## Gemini 비용 발생 지점 (전부 운영자 승인 후 실행)

| 지점 | 규모(호출 수 추정) | 목적 |
|---|---|---|
| Task 10 (Phase 2 검증배치) | ~15건 × qa-regen 최대 2회 = 최대 30호출 | 투출어휘 가드·표현 규칙 실증 |
| Task 16 (Phase 4 통합배치) | ~20건 × 최대 2회 = 최대 40호출 | 프롬프트 품질 일괄 + Phase 2/3 회귀 |
| Task 17 Step 3 (선택, Flash judge) | ~40호출(Flash) | ④ 측정기 교차검증 — 선택 |

유닛테스트·baseline 실측(read-only DB)·빌드는 전부 무비용.

---

## 최종 검증 (전체 완료 후)

- [ ] 이번 검수 15건의 사고 문장 전부가 유닛 fixture로 박제돼 red→green 이력 존재
- [ ] Task 16 통합배치 체크리스트 전 항목 합격 보고
- [ ] `wm-repeat-phrases.mts` 전후 비교 수치 기록(⑥)
- [ ] `wm-semantic-dup.mts` baseline 수치 기록(④ 차기 사이클 인계 데이터)
- [ ] 프롬프트 스냅샷 3종 + 본 계획서 대비 미이행 항목 유무 self-review
- [ ] main 머지·배포는 운영자 명시 승인 후 (feedback_git_push)

## 운영자 결정 대기 항목

1. **⑦⑧⑨⑥의 1차 편입 승인** — 위 배치 제안대로 갈지, ①②③⑤만으로 좁힐지.
2. **Task 10 / Task 16 배치 실행 승인**(비용) — 각 시점에 별도 요청.
3. **Task 6 태그 친화 라벨 문안** — 구현 시 후보안 제시 후 확정.
4. **기출고 15건 소급 처리 여부** — 이번 스코프 밖, 별도 판단.
