# 반려동물 궁합 Phase 1 — 판정문 콘텐츠 수술 + 관계 일러스트 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유료 리포트의 신뢰(fabrication 0·계산 정확)를 코드로 보장하고, "어느 펫에나 똑같은 클리셰" 판정문을 서버 계산 명리 신호에 앵커된 펫별 고유 콘텐츠로 수술한다. 동시에 펫-혼자 스티커 일러스트를 보호자와의 **관계를 표현하는 픽사풍 소프트 3D 렌더**로 격상한다.

**Architecture:** 근본 원인 = `buildPetCompatUserInfo`(lib/pet-compat.ts:350)가 LLM에 사주 원문+점수만 주고, `extractPetCompatSignals`(lib/pet-compat-saju.ts:241)가 이미 계산한 관계 신호(삼합·충·방합·생극)와 펫 신살/12운성/십성 요약을 **안 넘긴다** → 모델이 명리 대신 트로프(집안 실세·생존형 협상…)로 채우고, 점수를 부정하거나 데이터를 창작(실측: 나비 12운성 태→"양" 창작, 두부 spec "子띠 金" 오류, 보리 ruler 44인데 "실세" 서술). 해법 = ① 신호를 프롬프트에 승격 + 앵커 강제 + 서버 결정론화(spec) + QA 게이트/재생성, ② 라벨 분기에서 아키타입을 동시 결정해 일러스트 장면과 타이틀을 일치시키는 관계 일러스트.

**Tech Stack:** Next.js 15 + TypeScript, **Gemini API** (텍스트 `gemini-2.5-flash` via `callGemini`(lib/analysis.ts:2113), 이미지 `gemini-2.5-flash-image` via `@google/genai`). **Claude API 아님.** Supabase(Storage `pet-illustrations`).

## 범위 / 비범위

| 구분 | 내용 |
|---|---|
| ✅ 범위 ① | 판정문 콘텐츠 수술 — 신호 승격, 앵커 룰, 트로프 블랙리스트, 3중 중복 해소, 종 톤 재정의, spec 서버 결정론화, QA 게이트+재생성 1회 |
| ✅ 범위 ② | 관계 일러스트 — 아키타입 8종, SCENE_BLOCKS, 픽사풍 소프트 3D 스타일, 2단 fallback, 스타일 락 게이트 |
| ❌ 비범위 | **화면 레이아웃 리디자인은 Phase 2 별도 계획** (제품 사용설명서 7행 컨셉은 유지, 디자인만 나중. 목표 결 = 시니어 단순화가 아니라 두루미 본 서비스(사주·배틀)의 세련된 결) |
| ❌ 비범위 | 점수 로직 변경 (`PET_COMPAT_SCORING_VERSION` **4 불변**), DB 스키마 변경 (마이그레이션 없음) |

## Global Constraints

- 작업 위치: `~/projects/durumi-saju-pet` 워크트리, 브랜치 `feat/pet-resume`
- LLM은 Gemini API — Claude API로 착각 금지
- **유료 생성(Gemini 이미지)은 운영자 승인 후에만 실행** (텍스트 dev-test 호출은 통상 운영 비용, 승인 불요)
- 시스템 프롬프트 개편 시 `prompts/history/`에 버전 저장 + 이전 버전과 차이 비교 (CLAUDE.md 룰)
- API 에러 응답에 `error.message` 노출 금지
- dev 서버 돌 때 `npx next build` 금지
- 커밋 메시지에 "왜 바꿨는지" 필수. PR #84가 feat/pet-resume으로 오픈된 상태 — Phase 1 커밋은 같은 브랜치에 누적되어 PR에 합류됨(분리 원하면 운영자가 결정)

## 실측 현황 (2026-07-14, 이 계획의 전제)

| 항목 | 위치 | 상태 |
|---|---|---|
| 신호 계산 | `extractPetCompatSignals` lib/pet-compat-saju.ts:241-337 | 합·삼합·방합·충·형·원진·생극·신살·12운성 전부 계산됨. **점수 계산에만 쓰이고 LLM엔 미전달** |
| userInfo | `buildPetCompatUserInfo` lib/pet-compat.ts:350-411 | 사주 원문(`ownerSajuText`/`petSajuText`)+점수만. l.409 "헤드라인은 labelText를 부연" → 3중 중복 원인 |
| 시스템 프롬프트 | `buildPetCompatSystemPrompt` lib/pet-compat.ts:105-344 | 표현 풀(l.144-162)이 트로프를 떠먹임. 종별 톤(l.165-168) 개=«활발·충성·바보» 정의 빈약. spec은 LLM이 조립(l.219-225) → "子띠 金" 오류 |
| LLM 호출 | `runPetCompatAnalysis` lib/pet-compat.ts:419-457 | temp 0.85, 재시도 없음. scores/grade/labelText 강제 덮어쓰기(l.439-448)는 이미 존재 |
| 후처리 | `postprocessPetCompatResult` lib/pet-compat-postprocess.ts:42-67 | **한자 제거만**. 금지어·트로프·12운성 검증 없음 |
| 라벨 | `pickLabelText` lib/pet-compat-scoring.ts:347-383 | 파일 내부 전용(외부 사용처 없음, grep 확인) → 시그니처 확장 안전 |
| 일러스트 | `buildIllustrationPrompt` lib/pet-compat-illustration.ts:58-73 | 펫-only, "평평한 스티커" 스타일. 관계·아키타입 개념 없음 |
| 일러스트 호출 | app/api/pet-compat/analyze/route.ts:136-153 | LLM과 `Promise.all` 병렬. 실패해도 분석 계속 (`ok:false` 허용) |
| runPetCompatAnalysis 호출부 | analyze/route.ts:137, dev-test/route.ts:45, scripts/test-pet-compat.mts:186 | 3곳 — `PetCompatInput` 필드 추가 시 전부 갱신 |
| 12운성 데이터 | `petTwelveStage` = `enriched.twelveStages?.day?.korean` (pet-compat-saju.ts:319) | `TwelveStageEntry`(saju-enrichment.ts:1242)에 korean/meaning/strength 있음 — 번역에 활용 가능 |
| dev 엔드포인트 | `/api/pet-compat/dev-test` (DB 미접촉·인증 우회·prod 404), `/api/pet-compat/dev-illustration` (multipart 사진 → 실 파이프라인) | 검증에 그대로 사용 |

## 트랙 구조 · 순서 · 의존성

```
Track A (콘텐츠 수술)            Track B (관계 일러스트)
A1 신호 승격 ─┐                  B0 ★스타일 락 게이트 (유료·운영자 승인) ← 맨 앞
A2 앵커 룰   ─┤ 순차              B1 아키타입 시스템 (scoring)
A3 트로프    ─┤ (같은 프롬프트     B2 SCENE_BLOCKS
A4 3중 중복  ─┤  파일이라 순차     B3 3D 스타일 프롬프트 (B0 확정 룩 반영)
A5 종 톤     ─┘  커밋이 안전)     B4 연결 + 2단 fallback
A6 spec 서버화 (A1~A5와 독립)
A7 QA 게이트 (A1·A3에 의존, Track A 마지막)
```

- **A ∥ B 병렬 가능**: Track A는 `pet-compat.ts`/`pet-compat-saju.ts`/`pet-compat-postprocess.ts`, Track B는 `pet-compat-scoring.ts`(pickLabelText 확장)/`pet-compat-illustration.ts`. 파일 겹침 없음.
  - `pickLabelAndArchetype` 확장은 **② 것이고 ①은 scoring을 안 건드림**.
  - 유일한 공유 지점 = `app/api/pet-compat/analyze/route.ts` (A1: signals 전달 1줄, B4: archetype 전달 1줄) — 별개 라인이라 순차 커밋이면 무충돌.
- **B0은 B3 구현 착수 전 필수 게이트** (미검증 3D 스타일을 코드에 박기 전 룩 확정). B1·B2는 B0 대기 없이 진행 가능.

---

## Track A — 판정문 콘텐츠 수술

### Task A1: 신호 승격 — "★관계의 명리 근거(서버 계산)" 블록

**Files:**
- Modify: `lib/pet-compat.ts` — `PetCompatInput`(l.51-57)에 `signals: PetCompatSignals` 필수 필드 추가, 새 함수 `buildRelationSignalBlock(signals): string`, `buildPetCompatUserInfo`(l.350)에서 블록 삽입
- Modify: `app/api/pet-compat/analyze/route.ts:137` — `signals` 전달 (l.117에서 이미 계산됨)
- Modify: `app/api/pet-compat/dev-test/route.ts:45` — `signals` 전달 (l.40에서 이미 계산됨)
- Modify: `scripts/test-pet-compat.mts:186` — `mockSignalsForTest` 결과 전달

**변경 요지:** LLM이 트로프로 채우는 대신 근거로 쓸 재료를 한글로 번역해 명시 전달.

- [ ] **Step 1: `buildRelationSignalBlock` 작성.** 포함 내용:
  - **관계 신호** (true인 것만, 한글 번역): 일지 6합("서로 강하게 끌어당기는 조합"), 삼합("같은 목표를 보는 팀 기운"), 방합("같은 계절 기운, 자연스러운 편안함"), 충("생활 리듬이 정면으로 부딪히는 자리"), 형("잔마찰이 누적되는 자리"), 원진("이유 없이 얄미운데 못 떨어지는 자리"), 일간 생극 5종(saeng_to_pet="보호자가 펫에게 에너지를 주는 방향" 등), 연지 합/충
  - **펫 요약**: 신강약, 십성 그룹 카운트+뜻(관성 n개=규율·복종 기질, 인성=의지, 식상=자유 추구, 비겁=자기 우선), 신살 플래그(도화·홍염/역마/천을귀인 — **있는 것만** 나열), 오행(일간)
  - **12운성**: `signals.petTwelveStage` 이름 그대로 + `★futureLine에는 이 이름("○○")만 사용. 다른 12운성 이름 창작 금지` 지시 (나비 태→"양" 창작 재발 차단). `twelveStages.day.meaning`을 곁들여 번역 부담 감소
  - **점수 해석 가이드**: "ruler ${n} = ${n>=60?"펫 우위":n<=40?"보호자 우위":"대체로 동등"}" 식으로 서버가 해석까지 명시 (보리 ruler 44 → "실세" 모순 차단), lover−loyalty(affectionGap) 방향 명시
  - **신호 부재 케이스**: 합·충 전부 false면 "특별한 합·충 없음 — 무난한 평지 관계로 서술하고 극적인 명리 신호를 창작하지 마" 명시. tier 3·4(petEnriched null)면 "펫 사주 신뢰도 낮음 — 관계 신호 없음, 종 본성과 보호자 사주 중심" 명시
- [ ] **Step 2:** 3개 호출부에 `signals` 전달. 타입 에러로 누락 자동 검출됨(필수 필드).
- [ ] **검증:** `npx tsx`로 `buildPetCompatUserInfo` 단독 실행(mock signals) → 블록 문자열 육안 확인. dev-test 1회 → 응답 `signals`와 생성문 대조(합이 true인데 충 서술 등 역전 없는지).

### Task A2: 앵커 강제 룰 (프롬프트)

**Files:** Modify: `lib/pet-compat.ts` `buildPetCompatSystemPrompt`

**변경 요지:** 생성 텍스트가 서버 신호에서 출발하도록 강제.

- [ ] 시스템 프롬프트에 앵커 섹션 추가:
  - **petVerdict**: 첫 두 문장 = 이 펫의 최강 신호 1개(관계 신호 > 신살 > 십성 순 우선) → **종·품종·나이에 맞는 구체 행동**으로 번역. 신호 이름만 던지고 끝내기 금지
  - **ownerVerdict**: 점수에 실제 반영된 관계 신호 1개에서 출발. **점수 모순 금지 — ruler<50이면 "펫이 실세" 계열 서술 금지, ruler>50이면 "네가 보스" 계열 금지** (신호 블록의 해석 가이드 그대로 따를 것)
  - **simulations**: 3개 중 최소 1개는 신살·십성에서 파생한 장면 (예: 역마 → 현관문 열릴 때, 도화 → 손님 왔을 때)
  - **신살·12운성**: 입력 데이터에 있는 이름만 언급 가능. 데이터에 없는 신살·12운성 이름이 나오면 실패
- [ ] **검증:** dev-test 2회(개·고양이) → petVerdict 도입부가 신호 기반인지, ruler 값과 권력 서술 방향 일치 육안 확인.

### Task A3: 표현 풀 제거 → 트로프 블랙리스트

**Files:**
- Modify: `lib/pet-compat.ts` — l.144-162 [표현 풀] 축소, l.133-141 viral 패턴의 복사성 예시 정리
- Modify: `lib/pet-compat-postprocess.ts` — `TROPE_BLACKLIST` 상수 **여기에 정의** (A7 검증이 쓰고, pet-compat.ts가 import — pet-compat.ts→postprocess 방향 import는 이미 존재(l.7)라 순환 없음. 역방향 value import 금지)

**변경 요지:** 트로프를 떠먹이던 표현 풀을 걷어내고, 소진 표현을 결정론적으로 차단.

- [ ] **Step 1:** [표현 풀] 섹션(l.144-162)에서 문장형 예시·권력/시간/계산/시스템 비유 카탈로그 제거. **신조어 어휘 목록(집사·댕댕이·묘르신 등 l.162)만 유지** (종 어휘 가드가 참조하는 단어들이라 어휘 사전 성격은 필요).
- [ ] **Step 2:** `TROPE_BLACKLIST` 정의 (소진 표현): `집안 실세`(label.text 서버 문자열 "집안 실세와 월급 없는 운영진"은 서버 결정값이라 **검사 대상에서 label.text 제외**), `생존형 협상`, `기준이 흐려지`, `사랑보다 밥`, `사랑보다 츄르`, `만렙`, `언제 그랬냐는 듯`, `와이파이`, `푸시 알림`, `자동 결제`, `필요할 때만`, `5초 단위` 등. 프롬프트에 "다음 표현은 소진됐다 — 쓰면 실패" 목록으로 동일 상수 주입.
- [ ] **Step 3:** 톤 예시(l.122-128의 ✅ 문장들 — 실측상 그대로 복사됨)를 **패턴 서술로 교체**: "✅ 문장 예시" 대신 "관찰 가능한 구체 행동 + 의외의 해석 한 번 비틀기" 같은 구조 설명만.
- [ ] **검증:** dev-test 3펫 배치 → 블랙리스트 매치 0건 (A7 게이트 자동화 전이라 grep로).

### Task A4: 3중 중복 해소 (label / headline / finalLine)

**Files:** Modify: `lib/pet-compat.ts`

- [ ] `buildPetCompatUserInfo` l.409 "헤드라인은 labelText를 부연 설명하는 25~40자" 지시 **제거**.
- [ ] 시스템 프롬프트 JSON 스키마 주석(l.270, l.297)에 역할 분리 명시: `headline` = 이 관계의 **가장 강한 명리 신호 1개**를 진단하는 한 줄(labelText와 단어 겹침 금지), `finalLine` = 판정 전체를 관통하는 **감정의 마무리** 한 줄(labelText·headline과 다른 내용·다른 단어). "세 필드에 같은 비유·같은 핵심 단어 재사용 금지" 룰 추가.
- [ ] **검증:** dev-test 결과에서 3필드 핵심 명사 겹침 육안 확인 (A7의 배치 스크립트에 pairwise 중복률 포함).

### Task A5: 종 톤 재정의 (개 프레임 교체)

**Files:** Modify: `lib/pet-compat.ts` l.165-168 [종별 톤 분리] + 관련 예시

- [ ] 개 = **계산/도도/영업 프레임 금지**. 재정의: "강아지의 사고는 계산이 아니라 **너무 사랑해서 생기는 사고** — 과잉 환영, 참을성 없는 기다림, 온몸으로 하는 표현이 문제를 일으키는 결". 고양이만 계산·시니컬·황제 축 유지.
- [ ] 시스템 프롬프트 내 개 관련 예시(l.140-141, l.157-162의 개 항목)가 계산 프레임을 유도하지 않는지 함께 정리 (A3와 같은 커밋 흐름 가능).
- [ ] **검증:** dev-test 개 케이스 → "영업/협상/계산" 계열 표현 부재, 사랑-과잉 프레임 확인.

### Task A6: manual.spec 서버 결정론화

**Files:**
- Modify: `lib/pet-compat-saju.ts` — 새 함수 `buildPetSpec(pet: PetInput, petEnriched: EnrichedSajuData | null): string` + `BRANCH_ELEMENT`/`BRANCH_ANIMAL` 매핑 상수
- Modify: `lib/pet-compat.ts` — `PetCompatInput`에 `petSpec: string` 추가, `runPetCompatAnalysis`에서 parse 후 `parsed.manual.spec = input.petSpec` **강제 덮어쓰기** (l.439 scores 덮어쓰기 패턴 그대로), 시스템 프롬프트의 spec 조립 지시(l.219-225)를 "spec은 서버 결정값 그대로 옮겨라"로 교체
- Modify: 3개 호출부 (analyze route는 `petCalc.enriched` 보유 l.113, dev-test 동일 l.36, test-pet-compat.mts)

**변경 요지:** "子띠 金" 같은 연지→오행 오류를 LLM 손에서 뺏는다.

- [ ] **Step 1:** 매핑 상수: `BRANCH_ELEMENT` = 子水·丑土·寅木·卯木·辰土·巳火·午火·未土·申金·酉金·戌土·亥水, `BRANCH_ANIMAL` = 子쥐·丑소·寅범·卯토끼·辰용·巳뱀·午말·未양·申원숭이·酉닭·戌개·亥돼지.
- [ ] **Step 2:** `buildPetSpec`: 나이(tier1·2=birthDate 만 나이, tier3=birthYearEstimated 기준 "약 n세", tier4="나이 미상") + 품종(`pet.breed || "믹스"`) + 띠(`getYearBranchHanja`(l.127) → "寅(범)띠 木 기운", tier3은 "(추정)", tier4·연주 미상은 "(띠 미상, 가족 된 날 기준)"). 기존 표기 형식(l.221-225) 그대로 유지.
- [ ] **Step 3:** 덮어쓰기 연결. **주의:** postprocess의 한자 strip은 `manual.spec` 제외 정책(pet-compat-postprocess.ts:13, 45-47) — 서버 spec의 띠 한자 1개가 살아남는 현행 정책 그대로 유지됨.
- [ ] **검증:** `npx tsx`로 `buildPetSpec` 단위 테스트 — 12지 전부 × tier 4종 매트릭스에서 오행 정확(특히 子=水). dev-test 응답 `petSummary.yearPillar`와 spec 대조.

### Task A7: QA 게이트 + 재생성 1회

**Files:**
- Modify: `lib/pet-compat-postprocess.ts` — 새 함수 `validatePetCompatResult(result, ctx: { petTwelveStage: string }): string[]` (위반 목록 반환)
- Modify: `lib/pet-compat.ts` `runPetCompatAnalysis`(l.419) — 재시도 루프
- Modify: `lib/pet-compat.ts` 시스템 프롬프트 — errorSignals 룰 보강

**변경 요지:** 지시-only는 신뢰 불가(한자 사고와 동일 교훈) — 위반을 코드로 검출하고 1회 재생성.

- [ ] **Step 1: `validatePetCompatResult`** — 검사 대상은 **한자 strip 후** 본문 필드(label.text·manual.spec·manual.name 제외):
  - 금지어 정규식: `운명|100%|절대|영원히|무조건|반드시|정답`
  - `TROPE_BLACKLIST`(A3) 검출
  - **12운성 대조**: futureLine에 등장하는 12운성 이름 ∈ {장생,목욕,관대,건록,제왕,쇠,병,사,묘,절,태,양} 중 `ctx.petTwelveStage`와 다른 것 검출. ★한 글자 스테이지(쇠·병·사·묘·절·태·양)는 일반 단어 오매칭("사랑","양치") 위험 → **두 글자 이름은 단순 포함 검사, 한 글자는 "12운성 ○"/"○(운성)"/"○에 들어" 등 문맥 패턴만** 검사(보수적 1차, 오탐<미탐 우선순위를 뒤집지 말 것 — 오탐은 재생성 낭비로 끝나지만 릴리즈 블로킹은 아님)
  - **errorSignals 의료 오인 가드**: 구토·설사·발작·경련·혈뇨 등 의료 증상 어휘 검출 시 위반. 프롬프트에도 "errorSignals는 사주 신호 기반 행동 패턴만. 질병 증상 나열 금지, '진짜 아픈 신호면 사주 말고 병원 먼저' 취지 1문장 포함" 룰 추가
  - 프롬프트에 "manual.errorSignals는 manual.warnings와 내용 겹침 금지" 지시 (자동 검사는 과잉 — 지시+수동 검수)
- [ ] **Step 2: 재생성 루프** — `runPetCompatAnalysis`에서 parse→덮어쓰기(scores·label·spec)→한자 strip→validate. 위반 시 **1회만** 재호출: userInfo에 `★직전 출력이 다음 룰을 위반했다: [목록]. 해당 표현 없이 재작성` 블록을 덧붙여 재생성 후 동일 파이프 재적용. 2차에도 위반이면 `console.warn("[PET_COMPAT][QA]", violations)` 남기고 결과 반환(전면 실패로 유료 분석 죽이지 않음 — 잔존율 관측 후 강화 판단).
- [ ] **검증:** `npx tsx`로 validate 단위 테스트(위반 샘플 주입 — ★한자/CJK 리터럴을 셸 heredoc에 넣지 말 것, 아래 검증 전략 참조). dev-test 배치에서 재시도 발생률 로그 확인 (기대: <30%).

---

## Track B — 관계 일러스트 고도화

### Task B0: ★스타일 락 게이트 (구현 착수 전 · 유료 · 운영자 승인)

**Files:** 코드 머지 없음 — `buildIllustrationPrompt` 3D 시안 프롬프트를 임시 작성해 dev-illustration으로 테스트

- [ ] **Step 1:** 운영자에게 유료 생성 승인 요청 (gemini-2.5-flash-image 4~6장).
- [ ] **Step 2:** 승인 후 두부 사진으로 `POST /api/pet-compat/dev-illustration` (또는 임시 tsx 스크립트로 `generatePetIllustration` 직접 호출) — 3D 시안 프롬프트 1~2종 × 장면 유/무 2케이스 = 4~6장 생성.
  - 시안 핵심: 픽사풍 소프트 3D 렌더, 통통 귀여운 비율, 부드러운 벨벳 질감·소프트 라이팅, **사진 정체성(털색·무늬·품종 특징·표정) 최우선**, 두루미 다크톤(진녹/진회) 배경 유지, 1:1, 텍스트 금지, 보호자는 가장자리 손만
- [ ] **Step 3:** 운영자 룩 확정 → 확정 프롬프트 문안을 B3의 소스로 고정. **정체성이 안 닮으면 플랜B**: 스타일 격상 폭 축소(2.5D 소프트 셰이딩)하고 관계 표현만 도입.
- [ ] 게이트 통과 전 B3·B4 구현 착수 금지 (B1·B2는 진행 가능).

### Task B1: 아키타입 시스템 (`pickLabelText` → `pickLabelAndArchetype`)

**Files:** Modify: `lib/pet-compat-scoring.ts` — l.347-383 확장, `PetCompatComputedScores`(l.103-113)에 `archetype` 추가

**변경 요지:** 같은 점수 분기에서 라벨과 아키타입을 동시 결정 → 타이틀↔그림 일치 보장. **점수·라벨 문자열·분기 조건 무변경 → SCORING_VERSION 4 유지, DB 컬럼 추가 없음**(archetype은 분석 시점에만 사용, 점수에서 결정론적 재현 가능).

- [ ] **Step 1:** `export type PetArchetype = "HARMONY" | "OWNER_DEVOTION" | "PET_DEVOTION" | "PET_THRONE" | "OWNER_MANAGER" | "OFFBEAT" | "ROOMMATE" | "DISTANT_FATE"`.
- [ ] **Step 2:** `pickLabelAndArchetype(grade, scores, species): { text: string; archetype: PetArchetype }` — 기존 분기 1:1 매핑 (라벨 문자열·조건 변경 금지):

| grade | 분기 (기존 그대로) | 라벨 (불변) | archetype |
|---|---|---|---|
| S | sync≥85 && \|gap\|≤15 | 사주가 맞춘 찰떡 인연 | HARMONY |
| S | gap≥25 / gap≤−25 / else | (기존) | OWNER_DEVOTION / PET_DEVOTION / HARMONY |
| A | sync≥75 / gap≥30 / gap≤−30 / conflict≥30 / else | (기존) | HARMONY / OWNER_DEVOTION / PET_DEVOTION / OFFBEAT / HARMONY |
| B | ruler≥70&&gap≥20 / ruler≤30 / gap≥35 / gap≤−35 / else | (기존) | PET_THRONE / OWNER_MANAGER / OWNER_DEVOTION / PET_DEVOTION / ROOMMATE |
| C | ruler≥65&&gap≥20 / conflict≥50 / gap≥30 / else | (기존) | PET_THRONE / OFFBEAT / OWNER_DEVOTION / ROOMMATE |
| D | — | (기존, 종 분기) | DISTANT_FATE |

- [ ] **Step 3:** `computePetCompatScores`(l.389)에서 `archetype` 포함 반환.
- [ ] **검증:** `npx tsx scripts/pet-compat-grade-dist.mts` 재실행 → 등급·라벨 분포가 변경 전과 **완전 동일**(점수 회귀 0 증명). `mockSignalsForTest` 3프리셋의 archetype 스냅샷 기록.

### Task B2: SCENE_BLOCKS — 아키타입별 장면 문안 8종

**Files:** Modify: `lib/pet-compat-illustration.ts` — `const SCENE_BLOCKS: Record<PetArchetype, string>`

**변경 요지:** 점수 축을 시각 언어로 번역. 공통 제약 = **보호자는 화면 가장자리 손/무릎만(얼굴·전신 금지), 펫 화면 점유 60~75%, 소품 1개·모티프 1개 상한**.

- [ ] 축→시각 번역 룰을 주석으로 명시하고 8개 문안 작성: **ruler=수직 구도**(펫 우위=펫이 높은 곳), **affectionGap=뻗는 방향**(매달리는 쪽이 상대를 향해 뻗음), **sync=물리적 거리**, **conflict="귀엽게 삐진" 표정**(부정 묘사 금지):
  - HARMONY: 무릎에 기대 눈높이 맞춤, 가까운 거리, 따뜻한 상호 시선
  - OWNER_DEVOTION: 가장자리 손이 간식/장난감을 내밀고, 펫은 시크하게 반쯤 돌아봄
  - PET_DEVOTION: 펫이 가장자리 손에 몸을 부비며 올려다봄
  - PET_THRONE: 펫이 쿠션 탑 위(수직 우위), 아래 가장자리에서 손이 시중(츄르/브러시)
  - OWNER_MANAGER: 펫이 얌전히 앉고 손이 브러시로 케어하는 정돈된 구도
  - OFFBEAT: 귀엽게 삐진 표정으로 손과 다른 방향을 보지만 꼬리·몸은 손 쪽
  - ROOMMATE: 적당한 거리에서 각자 공간, 슬쩍 서로를 의식하는 시선
  - DISTANT_FATE: 거리가 있지만 창가 빛 아래 손이 조심스레 다가가는 희망적 톤 (D등급 disclaimer 정서와 일치 — 단절감 금지)
- [ ] **검증:** 코드 리뷰(문안이 축 번역 룰·공통 제약 위반 없는지). 실이미지 검증은 B4 후 유료 생성 단계에서.

### Task B3: 3D 귀여운 스타일 프롬프트 (B0 확정 룩)

**Files:** Modify: `lib/pet-compat-illustration.ts` — `buildIllustrationPrompt(petName, petSpecies, petBreed?, archetype?)` (l.58-73)

- [ ] (a) **스타일 격상**: 현행 "평평한 스티커·파스텔"(l.64-69)을 B0 확정 문안으로 교체 — 픽사풍 소프트 3D 렌더·통통 귀여움·부드러운 질감·입체감. (b) archetype 있으면 해당 `SCENE_BLOCK` 주입. 불변 유지: **정체성 최우선(사진의 털색·무늬·품종 특징·표정) > 장면 > 스타일** 우선순위 명시, 1:1, 텍스트 금지, 두루미 다크톤 배경.
- [ ] `archetype` 미전달이면 현행과 같은 펫-only 구도 프롬프트(하위호환 = fallback 프롬프트로 재사용).
- [ ] **검증:** 프롬프트 문자열 단위 확인(archetype 유/무 2케이스). 실이미지는 아래 승인 게이트에서.

### Task B4: 연결 + 2단 fallback

**Files:**
- Modify: `lib/pet-compat-illustration.ts` — `GenerateIllustrationInput`에 `archetype?: PetArchetype`, `generatePetIllustration`(l.79) 내부 2단 시도
- Modify: `app/api/pet-compat/analyze/route.ts:145-151` — `archetype: scores.archetype` 한 줄
- Modify: `app/api/pet-compat/dev-illustration/route.ts` — `archetype` 폼 필드 추가 (테스트용)

- [ ] **2단 fallback**: ① 관계 프롬프트(archetype)로 생성 → 이미지 파트 없음/에러 시 ② 펫-only 프롬프트로 1회 재시도 → 그래도 실패면 `ok:false` (분석은 계속 — 현행 route l.160-162 동작 그대로). **실패율 하한 = 현재 펫-only 보장 수준.**
- [ ] `Promise.all` 병렬 구조(route l.136-153) 무변경 — fallback 재시도는 `generatePetIllustration` 내부라 LLM 대기와 여전히 겹침.
- [ ] **검증(유료·운영자 승인 후):** dev-illustration으로 아키타입 2~3종 × 두부 사진 소수 생성 → 정체성·손만 노출·수직/거리 문법 확인. 전 아키타입 8장 전수는 비용 승인 시에만.

---

## 검증 전략

1. **콘텐츠 배치 검증 (dev-test, DB 미접촉·텍스트라 승인 불요)**
   - 신규 `scripts/pet-content-qa.mts`: dev 서버의 `/api/pet-compat/dev-test`를 6~8케이스 호출 — 개·고양이 × tier1/2/4 × 관계 조합(합·충·극·무신호를 실제 생일 조합으로 유도; `signals` 응답으로 의도 신호 확인) — 결과를 파일 저장 후 검사:
     - **자동**: 금지어 0 · 트로프 블랙리스트 0 · 종 혼입 0 · futureLine 12운성 == `signals.petTwelveStage` · spec 오행 == 서버 매핑 · 본문 한자 잔존 0(spec 제외) · ruler-서술 모순 휴리스틱(ruler<50 && /실세|폐하|묘르신|회장님/) · 케이스 간 문장 pairwise 중복률(펫별 고유성)
     - **수동**: 신호→행동 번역의 자연스러움, label/headline/finalLine 3중 분리, 개 톤(사랑-과잉 프레임), D등급 disclaimer 실출력 1건
   - ★**기존 사고 주의**: 검증 스크립트에서 한자/CJK 정규식을 **셸 heredoc에 넣으면 깨져 한글까지 오매칭**된다. 반드시 `一-鿿` 식 이스케이프를 쓰거나(pet-compat-postprocess.ts:19 `H` 상수 재사용), 필드별 실문자를 그대로 출력해 육안 대조. 스크립트는 heredoc이 아니라 Write로 파일 작성.
2. **점수 회귀 0 증명**: `pet-compat-grade-dist.mts` 전후 분포 동일 (B1 검증 겸용).
3. **일러스트**: B0 스타일 락(맨 앞) → B4 후 소수 유료 생성 — 둘 다 운영자 승인 게이트.
4. **빌드**: dev 서버 내리고 `npx next build` 성공.

## 회귀 불변 (이미 고친 것 안 깨기)

- **종 혼입 가드**: 시스템 프롬프트 l.171-181 + userInfo l.382 블록 유지 — 표현 풀 정리(A3) 때 삭제 금지
- **한자 후처리**(2026-07 사고 수정, 커밋 09508a6): `stripHanjaKeepKorean` 파이프 유지. A7 validate는 strip **후** 텍스트 대상. spec·name 제외 정책 유지
- **신살 scoring v4**: `hasShinsalKey` dual-field(shinsal.matches + pillar12Shinsal) 검출(pet-compat-saju.ts:214-235) 무변경
- **등급 relabel(SS 표기)·라벨 문자열**: `pickLabelAndArchetype`는 분기 조건·labelText 문자열 불변 → share 페이지(`label_text` 사용, app/pet/result/share) 영향 0
- **`PET_COMPAT_SCORING_VERSION` = 4 불변** (점수 로직 무변경 — archetype은 파생 표시값)
- D등급 disclaimer 의무·tier3/4 최저 C 정책(scoring l.134) 무변경
- 일러스트 실패 시 분석 계속(illustration_url=null) 동작 유지

## 리스크 · 롤백

| 리스크 | 대응 |
|---|---|
| 프롬프트 비대화 → 지시 준수 저하 | 표현 풀 제거(A3)로 총량 상쇄. 신호 블록은 지시가 아니라 데이터라 부담 낮음. dev-test 배치로 준수율 실측 |
| 재생성 1회 → 지연 최대 2배(~30s→60s) 일부 케이스 | 재시도율 로그 관측(목표 <30%). analyze는 이미 30s급이라 UX 임계 내. 높으면 프롬프트 보강이 우선, 루프 확대 금지 |
| 3D 스타일이 펫 정체성 훼손 | B0 게이트에서 사전 차단. 플랜B = 2.5D 소프트 셰이딩 + 관계 표현만 |
| 관계 프롬프트로 이미지 실패율 상승 | B4 2단 fallback으로 하한 = 현행 펫-only |
| 트로프 블랙리스트 오탐(정상 문장 차단) | 목록을 소진 표현에 한정. 오탐 비용 = 재생성 1회로 끝(차단 아님) |
| 순환 import (pet-compat ↔ postprocess) | 블랙리스트 상수는 postprocess에 정의, pet-compat이 import (현행 단방향 l.7 유지) |
| 12운성 한 글자 이름 오매칭 | 두 글자=포함 검사 / 한 글자=문맥 패턴 한정 (A7 Step 1) |

**롤백**: 태스크별 독립 커밋 → `git revert` 단위 회수. QA 게이트는 `validate` 호출 1곳 제거로 무력화 가능하게 배치. 일러스트는 route의 `archetype` 한 줄 revert로 펫-only 복귀. 프롬프트는 `prompts/history/` 직전 버전으로 즉시 복원 가능.

## 커밋 전략

- 브랜치: `feat/pet-resume` (PR #84 오픈 중 — 커밋이 PR에 합류됨. 별도 PR 분리 여부는 운영자 결정)
- 태스크당 1커밋, 메시지에 **"왜"** 필수 (예: `fix(pet): 신호 승격 — LLM이 명리 대신 트로프로 채우던 근본 원인(신호 미전달) 제거`)
- 시스템 프롬프트 개편 확정 시 `prompts/history/pet-compat_v0.3_2026-07-14.md` 저장 + v0.2 대비 차이 요약
- **유료 생성(이미지)은 매번 운영자 승인 게이트** (B0, B4 검증)

## 별도 관찰 (스펙 밖 — 이번 구현 아님)

- 검수에서 3펫 모두 lover > loyalty로 보호자 판정이 "네가 더 매달림"으로 수렴하는 경향 지적 → `computeLover`(scoring l.234, 보너스 위주 구조) 분포 점검은 **Phase 1 후속 후보로만 기록** (점수 로직 변경 = SCORING_VERSION bump 필요 사안이라 분리).

## Phase 2 (이 계획 밖)

- 결과 화면 레이아웃 리디자인(사용설명서 7행 컨셉 유지 + 두루미 본 서비스 결로 톤앤매너 통일)은 Phase 2 별도 계획으로 진행.
