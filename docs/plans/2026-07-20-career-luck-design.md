# 커리어운(career-luck) 유료 심층 리포트 — 구현 계획서

- 작성일: 2026-07-20
- 브랜치: **main 최신에서 신규 `feat/career-luck-test`** (feedback_branch_strategy)
- 가격: 코인 10알 (`CAREER_COST = 10`, 기존 유료와 동일 — `lib/constants/coins.ts`의 `MARRIAGE_COST`/`WEALTH_COST` 패턴)
- 선행 문서: `docs/plans/2026-07-18-wealth-luck-test-design.md`, `docs/plans/2026-07-18-marriage-luck-test-design.md`

---

## 0. 개요 — 무엇을, 어떤 기준 코드로 찍는가

> **✅ 확정 결정 (운영자 승인, 2026-07-20)**
> 1. **기준 코드 = origin/main**, 신규 브랜치 `feat/career-luck-test`. 코인 10알(기존 유료 동일).
> 2. **포지셔닝** = "어떤 그릇으로 어느 길을 가야 하는가"(官·食傷·印). 재물운(돈 축적)과 질문 자체가 다름.
> 3. **상황 4분법** = ①어떤 일이 맞을까(진로) ②지금 여기서 잘 될까(현직) ③옮겨야 하나(이직) ④내 사업 해도 될까(독립).
> 4. **등급** = `full_json.scores.직장운` → 결혼운과 **동일 컷** 상속(SS≥90). SS는 희귀 등급으로 의도적 유지, 새 채점 금지.
> 5. **착수 시점** = 지금 즉시(enrich 이미 main 병합 완료, 재포팅 리스크 없음).
> 6. **에셋 생성(배경·포스터·TTS 등)** 은 별도 승인 단계로 분리(feedback_generation_approval).

커리어운은 재물운(wealth)·결혼운(marriage)과 동일한 "심층 검사" 정형 패턴의 3번째 복제다.
**포지셔닝: "어떤 그릇으로 어느 길을 가야 하는가"** — 官(조직·직위), 食傷(재능·독립), 印(인정·자격).
재물운과의 경계: 둘 다 "사업" 얘기가 나오지만 **재물운은 '사업하면 돈이 붙나'(재성·그릇·손재), 커리어운은 '네 기질이 조직형이냐 독립형이냐'(관·식상 배치)** 로 질문 자체가 다르다. 이 경계는 Phase 2 프롬프트의 "이 검사의 위치" 블록과 절대 규칙에 명문화한다.

### ★기준 코드 = origin/main (치명 주의사항)

로컬 워킹카피는 현재 `feat/wealth-luck-test` 브랜치인데, **origin/main이 이미 훨씬 앞서 있다**(실측 `git diff HEAD origin/main` 확인). main에는 재물운 출시 후 품질 사이클이 전부 반영돼 있다:

| main에만 있는 것 | 커밋 | 커리어운에 미치는 영향 |
|---|---|---|
| 자체입력(self) 경로: `lib/self-input.ts` + `app/wealth/{self,teaser}/page.tsx` + `store/useWealthStore.ts` | (wealth-marriage 통합 허브 머지) | 커리어도 primary/self 2-경로로 처음부터 설계 |
| QA 재생성 루프 `lib/qa-regen.ts` (가드 위반 시 위반 목록 붙여 1회 재생성) | pet에서 일반화 | analyze 라우트가 이걸 쓰는 형태로 미러 |
| 서버 결정론 타임라인 `lib/fortune-timeline.ts` (`buildWealthTimeline`/`buildMarriageTimeline`) + 결과 화면 "날씨 타임라인" | be197b3 등 | `buildCareerTimeline`을 **이 파일에 추가**(새 파일 아님) |
| 프롬프트 고도화: 궁위(宮位) 번역·naturalFit(예스맨 방지)·냉철+재미 규칙·수치/한자/용어명 노출 금지·`{{CURRENT_YEAR}}` 치환·분량 상향(350~500/400~550) | 4d27a11, 56d76da, 56dfc7c, a18faf7, 4f71269 | career-prompt는 main의 wealth-prompt 최신판을 미러 |
| 후처리 고도화: 한자 스크럽·소수점(강도값) 스크럽·`validateWealthRichness`(5블록 총량 1900자 soft 하한) | 56d76da 등 | career-postprocess에 그대로 상속 |
| "내 결과" 통합 (`app/my/results/page.tsx` 탭: saju/yearly/marriage/wealth/today/pet/battle) | 3f6b550 | **career 탭 추가 필수** (CS 재발 차단 취지) |
| SCORING_VERSION 18 (tenStarsFull·C컷 50) | PR#85 | 등급 입력값(직장운 점수)의 산식 기준 |

**로컬 구버전(wealth-luck-test 시점)을 보고 복제하면 self 경로·QA루프·타임라인·품질 규칙이 전부 빠진 반쪽 상품이 나온다.** 모든 파일 미러의 기준은 `origin/main`이다.

### 재물운 대비 차이 요약 표

| 축 | 재물운 (wealth) | 커리어운 (career) |
|---|---|---|
| 핵심 질문 | 돈이 어떻게 들어오고 담기나 | 어떤 그릇으로 어느 길(조직/독립/전문/자격)을 가나 |
| 주 십성 | 재성(정재·편재) | **관성(정관·편관)** + 식상(식신·상관) + 인성(정인·편인) |
| 유형 4분류 | 정재우세/편재우세/재성혼재/무재 | 정관우세/편관우세/**관살혼잡**/무관 |
| 그릇 4상한 | 신왕재왕/신왕재쇠/재다신약/신약재소 (`jaeGrip`) | **신왕관왕/신왕관쇠/관다신약/신약관소** (`careerGrip` — 신약인데 官 과다 = 압박·번아웃 신호) |
| 보조 신호 | 식상생재, 군겁쟁재, 겁재 탈재, 재고 | **관인상생**(관∧인), **상관견관**(위치 기반 극), 인성 부재(독학·실전형), 무관(자유형) |
| 사용자 선택 4분법 | 재물 관심사(interest) | **상황(situation)**: ①어떤 일이 맞을까(진로) ②지금 여기서 잘 될까(현직) ③옮겨야 하나(이직) ④내 사업 해도 될까(독립) |
| 등급 입력 점수 | `full_json.scores.재물운` (clamp 35~95) | `full_json.scores.직장운` (**clamp 35~90** — 리스크 §8-1 참조) |
| 등급 컷 | 90/82/72/55 → SS/S/A/B/C | **동일 상속** (`computeWealthGrade` 미러, 신규 채점 없음) |
| 세운 트리거 | 재성투출/식상투출/비겁손재·조력 | **관성투출/인성투출/식상투출** (비겁은 v1 제외 — §Phase1-B5) |
| 안전장치 도메인 | 재무자문 금지, 손익 단정 금지 | **퇴사·이직·창업 실행 단정 지시 금지**, 해고·좌천 예언 금지, 특정 회사·시험 합격 보장 금지 |
| 테이블 | `wealth_results`/`wealth_result_unlocks` | `career_results`/`career_result_unlocks` |
| DB 메타 컬럼 | wealth_grade, jaeseong_type, jaeda_shinyak, sikssang_saengjae, gunggeob_jaengjae, jae_grip | career_grade, gwanseong_type, gwanda_sinyak, gwanin_sangsaeng, sanggwan_gyeongwan, career_grip |

---

## 1. 의존성/블로커 점검 결과 (실측)

### 1-1. 직장운 스코어는 존재하고 경로도 확정 ✅
- `lib/utils/saju-scoring.ts:19` — `export type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운"`.
- 직장운 산식(같은 파일 236~254행, main v18 기준): `정관 +8, 편관 +5, 인성 +4, 관인상생(관∧인) +7, 식신 +3, 신강 +3, 합 +2, 균형 +3 / 상관 -5, 상관견관(상관∧관성) -5, 비겁과다 -5, 편관∧충형 -4, 충 -2, 형 -2, 오행결핍 -3, 신약 -3` + 신살(장성 +4, 괴강 +3, 학당 +3, 월지공망 -3).
- 개인사주 저장 경로: `full_json.scores.직장운` (`extractWealthScore`가 읽는 `scores.재물운`과 동일 구조 — `wealth-grade.ts:20-28` 패턴 그대로 `extractCareerScore` 가능). number 또는 `{score}` 두 형태 방어도 동일 상속.

### 1-2. ★직장운 clamp 상한이 90 — SS 밴드가 사실상 소멸
`saju-scoring.ts`(main): `scores.재물운 = clampInt(…, 35, 95)`, `scores.직장운 = clampInt(…, 35, 90)`.
재물운 컷을 그대로 상속하면(SS ≥ 90) **직장운은 정확히 90점일 때만 SS**다. 단, 결혼운도 같은 조건(연애운 clamp 35~90)으로 이미 출시된 전례가 있어 블로커는 아니고 **알고 가는 트레이드오프**다. **[확정 2026-07-20] 운영자 승인 = 결혼운과 동일 컷 유지·새 채점 금지, SS는 희귀 등급으로 의도적 유지**(§8-1).

### 1-3. 결제·충전 인프라 준비돼 있음 ✅
- `hooks/useCharge.ts:72` `SUCCESS_PAGE_RETURNS`, `app/coins/charge-success/page.tsx:22` `RETURN_WHITELIST` + `PATH_LABELS`("/wealth": "재물운 보기")가 화이트리스트 방식 — `/career`, `/career/input`(+self 경로면 `/career/teaser`) 추가만 하면 됨.
- `spend_coins` RPC·`refundCoins`(`lib/server/session-helpers`)·orphan unlock 멱등 환불 패턴은 main의 `app/api/wealth/analyze/route.ts`에 완성돼 있음(`refundWealthUnlock`: order_id 삭제=원자적 승자 → 환불, 3분 grace 409).

### 1-4. share 페이지는 wealth/marriage에도 아직 없음 (helper만 존재)
`lib/share-wealth.ts`/`share-marriage.ts`는 존재하지만 소비하는 `app/**/share/[id]` 페이지가 없다(실측: `getSharedWealthResult` grep 결과 정의 파일뿐. share 라우트는 battle/result/yearly만 존재). → `lib/share-career.ts`는 운영자 확정 복제 표면이므로 동일 패턴으로 만들되, **소비 페이지 부재 상태도 동일하게 미러**(OG 공유 페이지는 3검사 공통 후속 과제로 §8에 기록).

### 1-5. 시간 미상(unknownBirthTime) 처리 인프라 상속 ✅
facts 조립은 `enrichSajuData(saju, { isTimeUnknown })` 경유라 시주 없는 차트도 동작. main 프롬프트의 "재료가 적어도 하한 채우기"(시주 없으면 있는 국면만 서술) 규칙을 커리어 버전으로 상속.

### 1-6. 진행 중 브랜치와의 충돌 — 해소됨 ✅
당초 `feat/wealth-marriage-enrich`가 wealth 표면을 계속 바꿔 재포팅 리스크를 우려했으나, **실측 결과 이미 origin/main에 병합됨**: `git rev-list --left-right --count origin/main...feat/wealth-marriage-enrich` = `3	0`(enrich 미반영 커밋 0, 파일 diff 없음). enrich 품질 사이클이 전부 main에 있어 재포팅 없음. **[확정 2026-07-20] origin/main 기준 즉시 착수**.

---

## Phase 1: `lib/career-facts.ts` — 커리어 명리 엔진 (가장 핵심)

### (a) 만들 파일
- `lib/career-facts.ts` (신규 — `lib/wealth-facts.ts`(main) 골격 미러 + `lib/marriage-facts.ts`의 위치 극 판정 이식)
- `lib/career-facts.test.ts` (신규 — `wealth-facts.test.ts`의 node:test 스타일, 고정 차트 fixture)
- `scripts/career-mc.mts` (신규 — 1,000명 몬테카를로 발화율. ※wealth-facts.ts:154 주석이 참조하는 `wealth-mc.mts`는 리포에 없다(실측) — 커리어는 스크립트를 커밋해 재실행 가능하게 남긴다)

### (b) 핵심 로직

**B1. 타입 (운영자 확정 4분법·명리 축 반영)**
```ts
export type CareerSituation = "진로 탐색" | "현직 성장" | "이직 고민" | "독립·사업";
// UI 라벨(질문형)과 분리: ①어떤 일이 맞을까 ②지금 여기서 잘 될까 ③옮겨야 하나 ④내 사업 해도 될까
// DB·API 화이트리스트 값은 위 명사형 4개(문자열은 wealth ALLOWED_INTEREST처럼 3곳 정확 일치:
// career-facts 타입 / api start·analyze ALLOWED_SITUATION / UI OPTIONS.value)

export interface CareerStarHit { pillar: "year"|"month"|"day"|"hour"; source: "천간"|"지장간"; star: "정관"|"편관"; }
export type CareerGrip = "신왕관왕" | "신왕관쇠" | "관다신약" | "신약관소";

export interface CareerFacts {
  situation: CareerSituation;
  dayStem: string;
  gwanseong: CareerStarHit[];                    // 관성 위치 목록(궁위 번역용)
  gwanseongType: "정관우세" | "편관우세" | "관살혼잡" | "무관";
  gwanseongAbsent: boolean;                      // 무관 = 자유형(조직 얽매임 약함) 서술 폴백
  gwanseongStrength: number;                     // weighted (v2 가중 모델 상속)
  siksinStrength: number;  sanggwanStrength: number; // 식신/상관 분리 — 전문가 심화형 vs 독립·창의형
  siksangType: "식신우세" | "상관우세" | "식상혼재" | "무식상";
  inseongStrength: number;                       // 정인+편인 weighted
  inseongAbsent: boolean;                        // 인성 부재 = 독학·실전형
  strengthLevel: string;                         // enriched.strength.result 재사용(재계산 금지)
  careerGrip: CareerGrip;                        // (신강/신약) × (weighted 관성 강/약) 4상한
  gwandaSinyak: boolean;                         // careerGrip === "관다신약" 파생만(단일 진실원)
  gwaninSangsaeng: boolean;                      // 관인상생: 관성·인성 둘 다 의미 있는 강도
  sanggwanGyeongwan: boolean;                    // 상관견관: 위치 기반 극(아래 B4)
  yongshinFavorsCareer: boolean;                 // 억부용신이 관성 오행 또는 인성 오행
  timingWindows: CareerTimingWindow[];           // 트리거: 관성투출/인성투출/식상투출
  daeunCareerYears: Array<{ startAge: number; endAge: number; star: string }>; // 관성 대운
}
```

**B2. 가중 모델 — wealth v2 그대로 상속** (`wealth-facts.ts:101-152`)
- `STEM_WEIGHT=3`, 지장간 `[본기2, 중기1.5, 여기0.5]`, 월지 ×1.5, day 천간(일간 자신) 제외.
- `collectWeightedHits`/`sumWeight`/`tenStarOf`/`bareStar`를 그대로 복제(공유 함수로 뽑지 않음 — "광범위 리팩토링 금지" 원칙, wealth start 라우트 주석과 동일 근거).
- 관성 오행 = `CONTROLLED_BY` 방향(일간을 극하는 오행)이지만 **오행 산수를 직접 하지 않는다** — `getTenStar` 결과 문자열("정관"/"편관")로만 집계(wealth가 재성을 집계하는 방식 그대로, fabrication 0).

**B3. careerGrip 4상한 + 임계값 (MC 튜닝 필수)**
- `STRONG_LEVELS = {극왕, 태강, 신강, 중화신강}` (`saju-enrichment.ts:399` `StrengthLevel` 8단계 실측 — wealth-facts.ts:89와 동일 셋).
- 관성 "강" 컷은 **신강/신약 모집단 분리**(wealth의 `JAE_STRong_THRESHOLD_WHEN_STRONG=4.5 / WHEN_WEAK=8` 교훈: 단일 임계는 죽은 밴드를 만든다). 초기값은 재물 값을 복사하되 **`scripts/career-mc.mts` 1,000명 분포로 반드시 재튜닝** — 관성은 재성과 슬롯 점유 패턴이 달라(신약 모집단은 관성이 강한 경향 — 관성이 일간을 극해 신약의 원인이 되기 때문) 컷이 그대로 맞을 가능성이 낮다. 합격 기준: 4상한 각각 ≥8%, 어느 신호도 90%+ 과발화 없음.
- 관살혼잡 판정: `hasJeonggwan && hasPyeongwan` (marriage `gwansalHonjap` — `marriage-facts.ts:170` 동일 로직). 단 **프롬프트에서 "밀도/수" 서술 금지 규칙 상속**(3a48370이 결혼운에서 잡은 관살혼잡 누수 — 커리어는 "방향 혼선: 안정과 승부 두 갈래 기운이 같이 있어 커리어 방향이 왔다갔다하기 쉬움"으로만 재해석).

**B4. 상관견관 — 처음부터 위치 기반 극 판정 (버그 선반영 ①)**
wealth `bigeopTaljae`(3c2f614)·marriage `spouseStarDamaged`(15b41fc)는 둘 다 출시 후에 "존재·강도만 보고 위치 극을 안 봐서 개인사주 메인 리포트와 모순"을 사후 수정한 커밋이다. 커리어는 같은 클래스의 버그를 **처음부터 반영**한다:
- `detectSanggwanGyeongwan`: **공격자 천간 = 상관 단독**(day 제외)이 관성을 정기/중기로 담은 지지를 개두 또는 인접 기둥에서 누르면 true. `ADJACENT_PILLARS`·`branchHasStrong*`(정기·중기만, 여기 제외) 패턴은 `marriage-facts.ts:53-111` 그대로 이식.
- ★marriage 여명은 공격자셋에 식신을 포함했지만(`SIKSSANG_SET` — 브리프 사정) **커리어는 상관 단독**으로 간다. 근거: 정통 명리에서 정관을 상하게 하는 건 상관(傷官)이고, 식신은 오히려 편관을 제압하는 길신(식신제살)이라 커리어 맥락에서 공격자로 묶으면 명리적으로 틀린다. 개인사주 채점(`직장운 -= 5 if 상관∧관성`)도 상관만 본다 — 3-layer 방향 정합.
- ★충거(沖去)는 v1에서 **의도적으로 제외**. 5e4de62(결혼운 충거 이중계상 → 발화율 ~50% 인플레 → 사후 축소)의 교훈: 근거 얇은 충 판정은 과발화 인플레만 만든다. 커리어 v1은 극(상관견관)만으로 시작하고, 필요하면 MC 실측 후 v2에서 "관성을 정기로 담은 지지의 충"으로 한정해 추가.

**B5. 타이밍 — 트리거 3종 + 대운**
`deriveTiming`은 `wealth-facts.ts:373-406` 미러:
- 세운 트리거: `관성투출`(정관·편관 — 자리·직책·평가 기운), `인성투출`(정인·편인 — 자격·문서·공부·인정), `식상투출`(식신·상관 — 새 판·전환·독립 에너지).
- ★비겁 트리거는 v1 제외 — 커리어에서 비겁은 "동료·경쟁" 서사인데 트리거 4종이 되면 거의 매년이 트리거가 돼(십성 10개 중 6개 커버) 타이밍의 희소가치가 죽는다. 3종(6/10)도 wealth(6/10: 재성2+식상2+비겁2)와 동일 커버리지다.
- ★식상투출의 해석 분기는 프롬프트 규칙으로: 상관견관=예 ∧ 상황 ②(현직)면 "조직 마찰·말이 앞서기 쉬운 해 — 문서로 남기고 한 템포 늦추기", 상황 ④(독립)나 무관이면 "판을 새로 짜는 에너지가 실리는 해". 라벨 자체는 반전하지 않는다(wealth 비겁손재/조력처럼 라벨을 두 개로 쪼개면 프롬프트·타임라인 힌트 테이블·MC까지 조합이 배로 늘어남 — 해석 분기가 결정론 사실(상관견관·situation)에 이미 근거하므로 안전).
- `daeunCareerYears`: 관성(정관/편관) 대운 구간 — wealth `daeunWealthYears` 미러. `bareStar` no-op 안전장치 유지.

**B6. 간극 감지 `detectSituationStructureGap` — wealth `detectInterestStructureGap`(main) 미러**
서버 결정론으로 감지하고 LLM은 풀이만(false negative 방지 — wealth-prompt.ts:50-53 주석 근거). 최소 콤보:
| 상황 | 구조 | 간극 메시지 골자 |
|---|---|---|
| ①진로 탐색 | 관살혼잡 | 방향 혼선 구조 — 두 갈래(안정/승부)를 다 쥐려다 흔들리기 쉬움, 기준 하나 세우기 |
| ②현직 성장 | 상관견관=예 | 조직 안에서 잘 되고 싶은데 구조는 규율과 마찰하는 기운 — 승진 저항 신호를 관리 관점으로 |
| ②현직 성장 | 무관 | 조직 성취를 원하는데 조직 인연 자체가 헐거운 구조 — 직함보다 실력·전문성 축 제안 |
| ③이직 고민 | 정관우세 ∧ 상관견관=아니오 | 옮기고 싶어하는데 구조는 안정·누적형 — 옮김 자체보다 조건 재협상이 결에 맞을 수 있음 |
| ④독립·사업 | 무식상 ∨ (정관우세 ∧ 식상 약) | 독립 의지 vs 구조는 조직·체계형 — 완전 독립보다 조직 낀 확장(사내독립·파트너십)이 자연스러움 |
| ④독립·사업 | 관다신약 | 키우기 전에 그릇(일간 힘)부터 — wealth "신약 그릇" 콤보(3a48370 확장분) 미러 |
- 중복 콤보 제외 처리(wealth-prompt.ts:79-83의 "같은 뜻 문장 중복 방지" 주석)도 상속.

**B7. `naturalFitLabel` 커리어판 (main 예스맨 방지 로직 미러)**
구조가 지지하는 길: 관다신약/신약관소 → "기반 다지기 우선" > 관인상생 → "자격·인정으로 미는 조직·전문가 길" > 상관우세∧무관 or 식상강∧관약 → "독립·자기 판" > 정관우세 → "조직 안 누적" > 편관우세 → "돌파·승부 무대". 사용자 situation과 일치하면 "일치 — 자연스럽게 확인", 다르면 "구조 신호는 X쪽" 소프트 신호(부정·단정 금지 규칙과 세트).

**B8. 불변식 런타임 가드 (wealth-facts.ts:293-306 미러)**
- `gwandaSinyak === (careerGrip === "관다신약")` 위반 시 throw.
- `sanggwanGyeongwan && gwanseongAbsent` 동시 발화 금지(관성이 없는데 관을 극할 수 없음 — 정의상 branchHasStrong가 false를 보장하지만 회귀 가드로 명시).

### (c) 완료 기준
1. `npx tsx --test lib/career-facts.test.ts` 전부 통과 — fixture 최소 6종: 정관우세 신강 / 편관우세 신약(관다신약) / 관살혼잡 / 무관 / 상관견관 위치 극 양성 / 상관 존재하되 비인접(음성 — 위치 판정 확인).
2. `scripts/career-mc.mts` 1,000명: careerGrip 4상한 각 ≥8%(죽은 밴드 없음), 상관견관 5~35%, 관인상생 10~50%, 무관 5~25% 범위 확인(범위 밖이면 임계 재튜닝 후 재실행, 수치 기록).
3. `npx tsc --noEmit` 통과.
4. 운영자 본인 사주(1995-06-21 계미, user_saju_chart.md)로 facts 1회 실행 → 개인사주 리포트의 직장운 서술과 방향 모순 없는지 육안 대조(3c2f614이 잡았던 "메인과 정반대 결론" 회귀 사전 차단).

---

## Phase 2: `lib/career-grade.ts` + `lib/career-prompt.ts`

### (a) 만들 파일
- `lib/career-grade.ts` + `lib/career-grade.test.ts`
- `lib/career-prompt.ts` + `lib/career-prompt.test.ts` (main의 `marriage-prompt.test.ts` 패턴)
- `prompts/history/career-v1.md` (CLAUDE.md 규약 — 프롬프트 버전 스냅샷, wealth-v1.md 형식)

### (b) 핵심 로직

**grade** — `wealth-grade.ts` 전체 미러:
- `computeCareerGrade(careerScore)`: 컷 90/82/72/55 동일 상속(운영자 확정 3).
- `extractCareerScore(fullJson)`: `scores.직장운` 읽기, **결측=null 반환**(0으로 뭉개기 금지 — 889b83d F-3 선반영). number/`{score}` 두 형태 방어 동일.

**prompt** — main `lib/wealth-prompt.ts` 최신판(궁위·naturalFit·냉철+재미·`{{CURRENT_YEAR}}` 포함) 구조 미러:
1. **factBlock**: situation / 직업 상태(primary만, self는 미제공) / 일간 / 관성 탐지·유형 / **관성 궁위 해석**(년=초년·집안, 월=사회활동기·직장 무대, 일지=중년·내 자리, 시=말년·후반 커리어 — wealth `PILLAR_DOMAIN` 미러) / 관성·식상(식신·상관 분리)·인성 강도(수치 노출 금지 단서) / 신강약 / **그릇 뜻풀이만**(`careerGripPlain` — "신왕관쇠" 같은 용어명을 factBlock에 아예 넣지 않는 main 방식: 용어 오기·노출 원천 차단) / 관인상생·상관견관·무관·인성부재 여부 / 타이밍 창·관성 대운 / 간극 감지 / naturalFit / 등급(서버 확정, 변경 금지).
2. **절대 규칙 (wealth 9종 구조 상속 + 커리어 치환)**:
   - 규칙 1(입력 사실 외 명리값 생성 금지): 일주 파생 신살 fabrication 금지 목록(괴강살·백호살·양인살·12운성·공망·원진·삼재) **그대로 유지**(3a48370). ★커리어 특별 경고 추가: 괴강·장성·학당은 개인사주 채점에는 존재하지만 이 facts 블록에는 없다 — "괴강이라 리더십" 류 서술 절대 금지(LLM이 커리어 맥락에서 가장 끌어오고 싶어 할 신살).
   - 규칙 2(차별화+타이밍): "개인사주 직장운 요약 재탕 금지, 진짜 새 정보는 궁위+타이밍" — 재물운과의 차별화 문장 추가: "돈이 붙는지는 재물운 검사의 몫이다. 이 리포트는 돈 얘기로 새지 말고 길·기질·자리 얘기만 하라"(경계 명문화, 운영자 확정 1).
   - 규칙 3(숙명론 금지 커리어판): "승진 못할 팔자"·"조직생활 못한다"·"백수 팔자"·"사업하면 망한다" 금지. **관다신약 재해석**(wealth 재다신약 3-2 미러): "관을 감당하는 그릇이 관건 — 책임·압박이 큰 자리일수록 회복 루틴과 페이스 관리가 필요한 구조"로 번역, "번아웃 온다" 단정 금지. **상관견관 재해석**: "윗사람과 부딪힌다/잘린다" 금지 → "정해진 틀보다 자기 방식이 앞서는 기질 — 말을 문서로, 반박을 제안으로 바꾸면 강점" 재해석(15b41fc의 여명 안전 재해석과 동일 클래스). 무관 재해석: "조직 못 붙어있는다" 금지 → "직함보다 실력이 명함인 자유형".
   - 규칙 4(타이밍 프레임): 승진·합격·이직 성사를 단정 금지("올해 반드시 승진" 금지), 실패·해고 단정도 금지. "살펴볼 시기/점검할 시기" 프레임 강제.
   - 규칙 5(경계 — 재무자문의 커리어판): **퇴사·이직·창업의 실행을 단정 지시하지 마라**("지금 회사 그만둬라"·"당장 창업해라" 금지 — 인생 중대 결정 단정은 손익 단정보다 신뢰 리스크가 큼). 특정 회사명·기관명, "OO시험 합격한다" 보장 금지. 직업 '군'의 결(사람 상대/혼자 파는/틀 있는/판 짜는)까지는 이 상품의 본질이므로 허용 — 특정 직업 하나를 못박는 단정("너는 간호사 해야 돼")은 금지.
   - 규칙 6(간극 짚기)·규칙 7(직업 상태 grounding — situation과 이중 grounding, §8 열린 질문 2 참조)·규칙 8(상관견관=예이면 "조직운 완벽" 순수 긍정 금지 — wealth 겁재 탈재 규칙 8 미러).
   - main 추가 규칙 전부 상속: 관심사(상황) vs 구조 정직(naturalFit), 수치 노출 금지, 세는나이, 한자 병기 금지, 그릇 용어명 노출 금지, 타이밍 충실도(`{{CURRENT_YEAR}}`/`{{PREV_YEAR}}` 치환 — `buildCareerPrompt(facts, grade, sajuText, employmentStatus?, currentYear)` 시그니처).
   - "냉철+재미" 블록 + "좋은 문장 예시" 블록(커리어 도메인 예문으로 재작성 — 예시 복붙 금지 규칙 포함).
3. **출력 스키마 (9키 — wealth와 동일 골격, 렌더러 미러 최소화)**:
   `teaserSummary / gradeHeadline(35자 한 문장) / gwanseongDiagnosis(관성 진단+궁위) / careerGripDiagnosis(그릇 진단) / workStyle / riskAndPace / timingFlow / advice[{text, tag:"[근거:...]"}] / yearlyCta`.
   상황별 3블록 분기(wealth 관심사 분기 미러): ①진로=맞는 일의 결/무리 없는 선택 기준/방향이 열리는 시기, ②현직=이 조직에서 내 무기/승진·평가 리스크 관리(상관견관 핵심 근거)/힘 실리는 시기, ③이직=옮김의 결(누적형 vs 전환형)/타이밍 리스크/움직이기 좋은 시기 vs 다질 시기, ④독립=자기 판을 짜는 힘(식상)/감당 가능한 속도(careerGrip)/판 벌이기 좋은 시기.
   분량: main 상향치 상속(진단 2블록 각 350~500자, 상황 3블록 각 400~550자, 하한 강제 문구 포함).

### (c) 완료 기준
1. `career-grade.test.ts`: 컷 경계값(89/90, 81/82, 71/72, 54/55)·결측 null·`{score}` 형태 — `wealth-grade.test.ts` 미러 통과.
2. `career-prompt.test.ts`: 빌더 출력에 (i) 그릇 용어명(신왕관쇠 등) 미포함 (ii) `{{CURRENT_YEAR}}` 잔존 없음 (iii) 간극 감지 문자열이 상황×구조 조합대로 나오는지 스냅샷.
3. `prompts/history/career-v1.md` 저장(이전 버전 없음 → wealth-v1 대비 델타 표 포함).
4. 운영자 사주로 프롬프트 1회 조립해 육안 검수(Gemini 호출은 Phase 6에서).

---

## Phase 3: `lib/career-consistency.ts` + `lib/career-postprocess.ts` — 알려진 버그 선반영

### (a) 만들 파일
- `lib/career-consistency.ts` (+ 테스트)
- `lib/career-postprocess.ts` + `lib/career-postprocess.test.ts`
- `lib/fortune-timeline.ts`에 `buildCareerTimeline` 추가(기존 파일 수정 — wealth/marriage 빌더와 나란히. 무드: 관성투출=강세, 인성투출=강세, 식상투출=보통(상관견관 보유자 분기는 프롬프트/힌트에서), 트리거 없는 해는 `CAREER_YEAR_HINT`(십성별 기본 힌트) — `WEALTH_YEAR_HINT` 미러. 반복 힌트 ALT 변주 테이블 상속)

### (b) 핵심 로직

**consistency** — `assertCareerConsistency` (`wealth-consistency.ts` 미러):
- `grade !== computeCareerGrade(careerScore).grade` → issue.
- `gwanseongType === "무관"` ↔ `gwanseong.length === 0` 양방향.
- `gwandaSinyak !== (careerGrip === "관다신약")` → issue.
- `sanggwanGyeongwan && gwanseongAbsent` → issue.
- analyze에서 **Gemini 호출 전** 검증 실패 시 환불(wealth analyze 5단계 순서 그대로).

**postprocess** — main `wealth-postprocess.ts` 최신판 미러:
- `FORBIDDEN_PREDICTIONS` 커리어판(문장 단위 컷): `/잘린다|해고|짤리|퇴출/`, `/승진.{0,6}(못|안\s*된|불가)/, /(백수|무능|무직).{0,4}팔자/`, `/조직생활.{0,6}못/`, `/(사업|창업|장사).{0,6}(망한|망해|망할)/`, `/평생\s*(승진|출세|성공).{0,4}(못|없)/`, `/반드시\s*(승진|합격|성공)/`, `/무조건\s*(승진|합격|성공|잘\s*된)/`, `/(당장|지금)\s*(퇴사|그만둬|사표)/`, `/좌천/`, `/직장운.{0,5}(없|약[하한해]|부족)/` 등. ★작성 후 **프롬프트가 명시한 금지 예시 문장 전수를 정규식이 실제로 잡는지 probe 테스트**(1b2bef5 선반영 — "프롬프트는 금지했는데 정규식은 통과"가 재물운 실제 갭이었음).
- 오탐 방지 negation: "퇴사하라는 뜻이 아니"·"그만두지 마" 류 부정형 보존(1b2bef5의 `FINANCIAL_ADVICE_NEGATION` 클래스 — 인접 한정형으로, bare `/아니/` 금지).
- `FORBIDDEN_SHINSAL` 동일 계승 + 괴강살·백호살·양인살(3a48370) — 커리어는 괴강 누출 위험이 특히 높음(§Phase2 규칙 1).
- 한자 스크럽(`HANJA_RE`)·소수점/필러 스크럽(`scrubStrayDecimals`)·재귀 walk 전부 상속.
- `REQUIRED_TEXT_BLOCKS`: ★**gradeHeadline minLen은 8** — 결혼운의 80을 복사하면 정상 출력 전부 반려되는 포팅 함정(wealth-postprocess.ts:72-74 주석이 명시한 사고 — 889b83d F-2). 나머지 블록 80/teaser 10/yearlyCta 30 상속.
- `validateCareerRichness`: 5블록 총량 1900자 soft 하한 + 재생성 안내문(궁위·타이밍으로만 채우라는 문구) 미러.

**알려진 버그 선반영 총괄표** (전부 `git show`로 실측한 커밋 — 커리어에서 "처음부터 반영"으로 전환):

| # | 원 커밋 | 재물운·결혼운에서 터졌던 것 | 커리어 선반영 위치 |
|---|---|---|---|
| 1 | 889b83d B-1 | orphan unlock을 환불 없이 삭제→재차감(크래시 사용자 이중결제) | Phase 4: main analyze의 `refundWealthUnlock` 멱등 패턴(삭제=원자 승자·3분 grace 409·loser 직접환불) 그대로 미러 |
| 2 | 889b83d F-2 | LLM 스키마 미검증→빈 유료 리포트 + gradeHeadline minLen 80 복사 함정 | Phase 3: `validateCareerBlocks`(minLen 8) + 가드 후 재검증 minAdvice 1 |
| 3 | 889b83d F-3 | 점수 결측을 0→C등급으로 뭉개 잘못된 유료 리포트 | Phase 2: `extractCareerScore` 결측 null → start/analyze 500, 결제 차단 |
| 4 | 889b83d N-1 | consistency가 항등식이라 무의미 | Phase 4: 결제 전 저장등급(teaser) vs 재계산 등급 비교 409 게이트 |
| 5 | 1b2bef5 | 프롬프트 금지 예시가 정규식에 실제 안 걸림 + 면책 문장 오탐 | Phase 3: 금지 예시별 probe 테스트 + 인접 한정 negation |
| 6 | 3c2f614 / 15b41fc | 존재·강도만 보고 위치 극을 안 봐 개인사주와 모순(겁재 탈재/배우자성 손상 사후 추가) | Phase 1 B4: 상관견관을 처음부터 개두·인접 위치 판정으로 설계 |
| 7 | 5e4de62 | bare 일지충 이중계상으로 충거 발화율 ~50% 인플레 | Phase 1 B4: 충거 자체를 v1 제외(추가 시 "관성 정기 보유 지지의 충"으로 한정) |
| 8 | 3a48370 | 일주 파생 신살(괴강·백호·양인·12운성 등) fabrication 2차 누수 | Phase 2 규칙 1 금지 목록 + Phase 3 FORBIDDEN_SHINSAL |
| 9 | 23c633f / e1d139d / 7eb4d70 | 존댓말 어미·gradeHeadline 장문·UI 하드코딩 해요체 | Phase 2 프롬프트(반말 100%·35자 한 문장) + Phase 5 UI 문구 전부 반말로 초안 |
| 10 | 56d76da / 4d27a11 / a18faf7 / be197b3 | 한자 병기·게이지 수치 누출·용어명 오기(신왕재쇠→신왕재소)·연도 썩음·지난 대운 노출·반복 힌트 | Phase 2~3: main 최신판 미러로 자동 상속(한자/소수점 스크럽·gripPlain·CURRENT_YEAR 치환·filterUpcomingDaeun·ALT 힌트) |

### (c) 완료 기준
1. `career-postprocess.test.ts`: 금지문구 probe(프롬프트 금지 예시 전수) + 면책·부정형 보존 + 신살 스크럽 + gradeHeadline 8자 통과·80자 미반려 — wealth 68케이스 규모 미러.
2. `assertCareerConsistency` 4개 축 단위테스트.
3. `buildCareerTimeline` 단위테스트(`fortune-timeline.test.ts`에 추가 — 트리거 매핑·지난 대운 필터·ALT 변주).

---

## Phase 4: API 5개 라우트 + DB + charge 화이트리스트

### (a) 만들/고칠 파일
- `app/api/career/start/route.ts`, `analyze/route.ts`, `results/route.ts`, `list/route.ts`, `from-primary/route.ts` (신규 — **main의 `app/api/wealth/*` 미러**)
- `supabase/migrations/20260720_career_results.sql` (신규 — `20260718_wealth_results.sql` 미러 + `guard_violations jsonb` 컬럼을 처음부터 포함해 별도 파일 불필요, 사전순 함정(20260718_wealth_guard_violations.sql 주석의 적용 순서 사고)도 원천 회피)
- `lib/constants/coins.ts`: `CAREER_COST = 10` 추가
- `hooks/useCharge.ts:72` `SUCCESS_PAGE_RETURNS` + `app/coins/charge-success/page.tsx:22` `RETURN_WHITELIST`·`PATH_LABELS`에 `/career`, `/career/input`, (self 경로) `/career/teaser` 추가
- `lib/share-career.ts` (신규 — `share-wealth.ts` 미러, §1-4 전제)

### (b) 핵심 로직 (main wealth 라우트의 고정 순서 그대로)
- **start**: source primary|self 분기(`normalizeSelfInput`/`computeSelfSaju`/`deriveSelfScores` 재사용 — `lib/self-input.ts`는 공용이라 수정 불필요) → facts+grade → `teaser_json = { grade, gwanseongType, situation }` → upsert(`onConflict: "user_id,input_hash,situation"`, **full_json은 payload 제외** — 재진입 시 null 덮어쓰기 사고 방지 주석 상속). 점수 결측 500.
- **analyze**: ①situation 화이트리스트 → ②멱등 체크(unlock∧full_json → reused) → ②-1 orphan(3분 grace 409 / 초과 시 `refundCareerUnlock` 멱등 환불 후 fall-through) → ②-2 결제 전 등급 게이트(결측 500·teaser 등급 불일치 409) → ③`spend_coins`+unlock insert(23505 loser는 직접 `refundCoins` — 삭제 게이트 못 타는 이유 주석까지 상속) → ④facts 재조립(self는 selfComputed 재사용) → ⑤consistency 실패 시 환불 → ⑥⑦`generateWithQaRegen`(validate→guards→richness softValidate) → 가드 후 `validateCareerBlocks(minAdvice:1)` 재검증 → `buildCareerTimeline` 병합(가드 뒤 — LLM 산문 아님) → ⑧저장(update 0건=row 소실도 환불) → guard_violations best-effort 기록.
- **results**: user_id 스코프 + `?id=` — teaser/completed 분기(full_json null 기준), existence oracle 방지 404. SELECT 컬럼은 career 메타(career_grade, gwanseong_type, gwanda_sinyak, gwanin_sangsaeng, sanggwan_gyeongwan, career_grip).
- **list**: 컬럼만 select(등급이 컬럼에 있어 full_json 파싱 불필요), `unlocked: full_json !== null`. `error.message` 노출 금지(CLAUDE.md).
- **from-primary**: 대표사주 → 원국·facts(situation 임시값 "진로 탐색")·careerScore 반환. wealth와 동일하게 gender는 fortune 계산에만.
- DB: unique(user_id, input_hash, situation) + guest 인덱스 + unlocks(order_id unique) + RLS enable — wealth SQL 구조 그대로, 컬럼명만 치환.

### (c) 완료 기준
1. `npx next build` 성공 (dev 서버 중이면 build 금지 — feedback_nextjs_build_dev_conflict).
2. 결제 시나리오 표(889b83d 검증 9종 미러) 수동/스크립트 점검: 정상 결제 / 재열람 멱등 / 동시 요청 loser 환불 / orphan 3분 내 409 / orphan 초과 환불 후 재결제 / Gemini 실패 환불 / 가드 후 빈 블록 환불 / row 소실 환불 / 잔액 부족 402 — 전부 "알 1 = 리포트 1".
3. 마이그레이션을 Supabase에 적용하고 upsert/unlock unique 제약 실동작 확인.

---

## Phase 5: UI (entry/input/self/teaser/result) + share + 배경/포스터

### (a) 만들/고칠 파일
- `app/career/page.tsx` (★main의 `app/wealth/page.tsx`처럼 **requireSession 없음** — 비로그인 진입 허용, 로그인은 제출 시점)
- `app/career/CareerEntryClient.tsx` (main WealthEntryClient 2-경로 미러: primary 지름길 `/career/input` + 자체입력 `/career/self`, `AboutCard` 3축 value — ①타고난 커리어의 결(정관·편관) ②관을 감당하는 그릇(신강약) ③자리가 열리는 때(세운))
- `app/career/input/page.tsx` (primary 경로: 상황 4분법 원탭 + 잔액 체크→충전 시트→afterCharge 자동 재시도 — wealth/input 미러)
- `app/career/self/page.tsx` (`SajuInputFlow` `skipQuestions={["relationshipStatus","employmentStatus","coreFearAxis"]}` + 상황 4분법 스텝 → `/career/teaser`. `trackName="career"`)
- `app/career/teaser/page.tsx` (self 미리보기: 원국 무료 공개+등급 잠금+결제 CTA — wealth/teaser 미러. ★selfInput은 useInputStore에서 useMemo 단일 파생으로 start·analyze 동일 객체 전달 — inputHash 생명선 주석 상속)
- `app/career/result/page.tsx` + `CareerResultClient.tsx` (main WealthResultClient 미러: OpeningScene(bg-career)→게이지 2종→진단 2블록→날씨 타임라인(`FortuneWeatherTimeline` **인라인 복제** — main도 wealth/marriage 각자 인라인, 공유 컴포넌트 신설 금지 원칙)→상황별 카드 3장→advice→yearlyCta→재열람 안내→하단 sticky. 게이지: "관성 강약"=gwanseongType+careerGrip 성분, "관을 담는 그릇"=careerGrip 4포지션 — **원시 점수 없이 결정론 값만으로**, fabrication 0 주석 체계 상속. 하단 면책: "본 리포트는 명리 해석 콘텐츠이며 직업·진로에 대한 전문 상담이 아닙니다" — wealth 재무자문 면책의 커리어판, 결정론 하드코딩)
- `store/useCareerStore.ts` (situation persist — useWealthStore 미러)
- `app/my/results/page.tsx`: `Tab`에 `"career"` + `/api/career/list` fetch + 카드(`href=/career/result?id=` — 3f6b550 패턴)
- `app/menu/page.tsx` 심층 풀이 카드 1개 + `app/page.tsx` 심층검사 섹션에 커리어 포스터 카드 추가 (main의 marriage/wealth 카드 나란히)
- 에셋: `public/images/career/bg-career.webp`(결과 히어로 추상 배경)·`career-poster.webp`(홈 섹션 포스터) — **★생성은 유료 파이프라인이므로 별도 승인 단계로 분리**(feedback_generation_approval). 승인 전까지는 wealth 배경을 플레이스홀더로 두지 않고 **배경 img 없이 그라디언트만**으로 커밋(잘못된 톤 고착 방지).

### (b) 핵심 로직
- 모든 하드코딩 문구 반말(7eb4d70 선반영), 사주 전문용어 UI 노출 최소화(feedback_durumi_saju_jargon — 게이지 verdict는 "자리 기운이 뚜렷해" 류 일상어), 토스풍 기존 톤(feedback_durumi_ui_style).
- 상황별 카드 라벨 테이블(`INTEREST_CARD_LABELS` 미러 — 4상황 × {eyebrow, heading, 3블록 제목}).
- 등급 역매핑 `CAREER_TO_INTERNAL_GRADE`(SS→S…C→D) — WealthResultClient:84 미러.

### (c) 완료 기준
1. `npx next build` 성공, 모바일 뷰포트(390px) 육안 검수(teaser 잠금/completed/에러/비로그인 4상태).
2. 충전→복귀 자동 재시도(afterCharge) 동작 확인(Mock 결제).
3. my/results 커리어 탭에서 재열람 확인.
4. 에셋 승인·생성 완료 후 배경/포스터 교체 커밋(별도).

---

## Phase 6: 테스트 + 품질 critic 루프 (출시 게이트)

### (a) 만들/고칠 파일
- `scripts/career-mc.mts`(Phase 1에서 생성 — 최종 수치 재실행·기록)
- critic 산출물은 파일로 커밋하지 않고 검토 로그로만

### (b) 핵심 작업
1. **공유 검증 helper 3-layer 정합 전수 점검** (feedback_shared_validator_audit):
   - 층1(개인사주): `saju-scoring.ts` 직장운 ↔ 층2(등급): `extractCareerScore`→`computeCareerGrade` ↔ 층3(심층 facts): careerGrip·상관견관 방향성.
   - 점검 항목: `resultSchema.ts`의 `AnalysisScores`/`normalizeScores`가 직장운 키를 그대로 통과시키는지, `quality-gate.ts`·`analysis-postprocess.ts` 등 공유 후처리가 career full_json을 건드릴 일이 없는지(테이블 분리라 없음 — grep으로 확인), my/results·useCharge·charge-success 화이트리스트 누락 없는지.
   - 상관견관 방향 정합 케이스: 개인사주가 상관견관 감점(존재 기반)인데 심층이 "아니오"(위치 기반)인 차트 → 프롬프트가 "조직운 완벽" 순수 긍정으로 쓰지 않는지(규칙 8이 커버하는지) 실차트로 확인.
2. **facts 발화율 몬테카를로**: `career-mc.mts` 1,000명 최종 실행 — Phase 1 (c)2 합격 범위 재확인, 수치를 계획서 대비표로 기록.
3. **실측 리포트 생성 + 독립 critic** (feedback_article_quality_critic·feedback_deep_report_quality_loop 패턴):
   - 실사주 5명(운영자 본인 포함) × 상황 4종 중 대표 조합으로 full_json + guard_violations 수집.
   - 독립 critic 관점: ①명리 정확성(facts 값과 산문 모순 0, fabrication 0) ②AI 슬롭·클리셰·반복 ③재물운 리포트와의 차별성 — **같은 원국의 재물운 결과와 문장·논지 겹침 검사**(특히 상황④ 독립·사업 vs 재물 관심사 사업·수입: "돈 얘기"로 새면 실패) ④분량 하한·반말 100%·용어 노출 0.
   - adversarial probe: 금지문구 세트(잘린다/승진 못한다/당장 퇴사/반드시 합격 등 16종+)를 가드에 통과시켜 전부 컷되는지(889b83d probe 방식).
4. guard_violations 실측 분포 확인(재생성 루프 후 잔존 위반이 많으면 프롬프트 보강 1사이클).

### (c) 완료 기준
- 위 1~4 전부 통과 + `npx tsc --noEmit`·`npx next build`·전체 career 단위테스트 통과.
- 출시(main 머지·배포)는 운영자 명시 승인 필요(feedback_git_push). 배포 전 2차 영향 전수 검증(feedback_deploy_checklist): 코인·charge-success·my/results·menu·홈 랜딩.

---

## 8. 리스크 & 열린 질문

1. **[확정 — 운영자 승인 2026-07-20] 직장운 상한 90 → SS 희귀 등급, 결혼운과 동일 컷 유지**(§1-2). 정확히 90점만 SS = 결혼운(연애운 상한 90)과 동일 조건. 세 검사(재물·결혼·커리어) 등급 기준을 통일해 "같은 사람인데 검사마다 등급 상이" 혼란을 차단하는 게 우선. SS는 "극소수 희귀 등급"으로 의도적으로 둔다. 컷·채점 변경 없음. (상한 95 상향은 3검사 동시 개편 시점의 v2 후보로만 남김.)
2. **situation vs employmentStatus 이중 grounding**: primary 경로 사용자가 employmentStatus="직장인"인데 상황 ①(진로 탐색)을 고르면 충돌처럼 보일 수 있다. 계획은 "situation을 1순위 grounding, employmentStatus는 예시 톤 보조"로 프롬프트에 우선순위를 명시하는 것 — 문구 시안 검토 요청.
3. **상관견관 공격자셋 = 상관 단독**(Phase 1 B4): marriage(식신 포함)와 다른 선택의 명리 근거(식신제살은 길신)를 취했다. 이견 있으면 구현 전 확정 필요(feedback_raise_concern_first).
4. **식신제살·살인상생 등 편관 구제 구조는 v1 미포함**: 편관우세 신약(관다신약)의 "구제" 서사를 v1은 관인상생 하나로만 커버한다. MC에서 관다신약 발화가 크면 v2 후보.
5. **[해소 — 실측 2026-07-20] enrich는 이미 main에 병합됨, 지금 착수 확정**(§1-6): `git rev-list --left-right --count origin/main...feat/wealth-marriage-enrich` = `3	0`(main만 앞섬, enrich 미반영 커밋 0, 파일 diff 없음). enrich의 품질 사이클(4f71269·a18faf7 등)이 전부 origin/main에 들어가 있어 **재포팅 리스크 없음**. 기준 origin/main에서 `feat/career-luck-test` 신규 브랜치로 즉시 착수.
6. **share OG 페이지 부재는 3검사 공통**(§1-4): `share-career.ts` helper만 만들고 소비 페이지는 wealth/marriage와 함께 공통 후속으로.
7. **yearlyCta 연결**: 커리어 결과 → "올해 자리 흐름" yearly CTA는 wealth 문구 미러로 두되, yearly 상품이 커리어 월별 흐름을 실제 담보하는지 문구 과약속 여부 검수 필요.
8. **취준생 타깃과 기존 독자층**: 상황 ①·③은 2040 직장인 결이 강한데 주 독자는 35~54 여성(feedback_durumi_youtube_audience는 유튜브 기준이지만 서비스 톤 참조). 시니어 가독성 규칙은 유지하되 상황별 예시 장면의 연령 편향을 critic 항목에 포함.
