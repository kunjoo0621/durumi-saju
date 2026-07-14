# 반려동물 궁합 Phase 2 — 결과 화면 레이아웃/시각 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 펫 궁합 결과 화면을 "똑같은 다크 카드 10장 세로 stack"에서 **두루미 본 서비스(개인 사주·배틀)의 세련된 결**로 통일한다. 시니어용 단순화가 아니다 — 개인 사주 결과가 이미 갖춘 시각 언어(등급 배지 SVG+글로우, 레이더 차트, 아코디언 리듬, 액센트 컬러, 진입 모션)를 펫에 이식하는 것이다.

**Architecture(근본 원인):** 개인 사주 결과는 `components/result/`의 공유 결과 컴포넌트(OverallGradeBadgeSlot·CategoryRadarChart·SectionList 등)로 조립되는데, **펫 결과(`app/pet/result/PetResultClient.tsx`)는 이 공유 컴포넌트를 단 하나도 안 쓰고** 로컬 Gauge(2px 얇은 바)·ManualRow·AffectionFlow만으로 만들었다. 해법 = 공유 컴포넌트를 **확장만(파괴 변경 금지)** 해서 펫이 소비하게 하고, 펫 고유 개념(양방향 정·실세·manual 7행)은 로컬에 남기되 본 서비스 시각 문법(액센트 바, duotone 아이콘, title-3, 차트 카드)으로 재스타일한다.

**Tech Stack:** Next.js 15 + React 18 + TypeScript, Tailwind (docs/DESIGN_SYSTEM.md 토큰), @phosphor-icons/react. 코드만 — LLM/이미지 생성 없음(무료 작업).

## 범위 / 비범위

| 구분 | 내용 |
|---|---|
| ✅ 범위 | `app/pet/result/PetResultClient.tsx` + `app/pet/result/share/[id]/SharePetCompatClient.tsx` 레이아웃/시각 전면 리디자인 |
| ✅ 범위 | 공유 컴포넌트 **additive 확장**: CategoryRadarChart(범용 축), SectionList(메타 오버라이드) — 기본 동작 불변 |
| ✅ 범위 | `app/dev/pet-result-ui` 데모 페이지 신설 (mock 데이터, prod 404) — 검증용 |
| ❌ 비범위 | 콘텐츠 글 재작성 (Phase 1 Track A 완료), 일러스트 생성 (Track B 별도) |
| ❌ 비범위 | 데이터 모양 변경 — API 응답·`PetCompatResult` 스키마·`PET_COMPAT_SCORING_VERSION`·DB 전부 불변 |
| ❌ 비범위 | manual 7행 **컨셉 폐기 금지** — 7행 사용설명서 컨셉 유지, 디자인만 개선 (스펙시트식 재구성 OK) |
| ❌ 비범위 | 개인 사주·배틀·투데이·이어리 화면의 시각 변경 (공유 컴포넌트 확장 시 렌더 결과 0 변화 보장) |

## Global Constraints

- 작업 위치: `~/projects/durumi-saju-pet`, 브랜치 `feat/pet-resume` (PR #84 누적)
- 공유 컴포넌트(`components/result/*`)는 **확장만** — 기존 props 시그니처·기본 렌더 결과 유지. 소비자 = 사주(ResultTable→result/share/my/dev)·투데이(SectionList)·이어리(SectionList) 전수 확인
- 일러스트 hero 위치 유지 — Track B의 관계 일러스트(1:1)가 그대로 들어올 자리
- share 페이지 정합성 유지 — 결제 결과 페이지와 share teaser가 같은 시각 언어
- dev 서버 돌 때 `npx next build` 금지, 배포 전 build 필수
- 커밋 메시지에 "왜 바꿨는지" 필수

---

## 1. 전수 검토 결과표 (2026-07-14 실측)

### 1-1. 화면 × 공유 컴포넌트/시각 패턴 매트릭스

| 시각 요소 | 사주 (`app/result` → ResultView/ResultTable) | 배틀 (`components/battle/*`) | 투데이 (`app/today/result/[id]`) | 이어리 (`app/yearly/result/[id]`) | **펫 (`app/pet/result`)** |
|---|---|---|---|---|---|
| 등급 배지 (SVG+글로우) | ✅ `OverallGradeBadgeSlot` 120px + rank-*.svg (ResultTable:142) | ✅ rank SVG 52px×2 + radial glow (BattleHero:87) | — (weather 아이콘 120px가 대체) | — (weather chip이 대체) | ❌ **텍스트 chip만** (`{grade}등급` 11px, PetResultClient:124) |
| 지표 차트 (레이더/펫탈) | ✅ `CategoryRadarChart` 5각형 + glow + 등급색 라벨 + 480ms rAF (ResultTable:175) | ✅ `BattleRadarChart` 이중 레이더 아코디언 (BattleHero:208) | ✅ `ScoresBar` 라벨+바+수치 (primary/70) | ✅ 월별 흐름 카드 (mood 오행색) | ❌ **h-2 얇은 바 3개** (white/80 단색, Gauge:318) |
| 섹션 아코디언 (액센트 바+duotone 아이콘) | ✅ `SectionList` (좌측 w-1 액센트 바, SECTION_META 컬러) | ✅ 동일 패턴 자체 구현 (Simulations #F59E0B, FinalVerdict #FF6B6B) | ✅ `SectionList` initialExpandedCount=1 | ✅ `SectionList` | ❌ **접기 없음, 아이콘=이모지, 전 카드 동일 톤** |
| 카드 리듬 (hero→차트→아코디언 다양성) | ✅ 원국카드→등급카드(#141414)→레이더→아코디언 | ✅ hero(승자 그라디언트 워시)→스와이퍼→아코디언들 | ✅ hero→MoodGauge→ScoresBar→아코디언 | ✅ hero→월별(가로스크롤+row)→아코디언 | ❌ **rounded-[24px] bg-tertiary 카드 10장 반복** |
| 등급/액센트 컬러 | ✅ GRADE_COLORS + 섹션별 액센트 (#60A5FA/#4ADE80/#F87171…) | ✅ A=#FF6B6B B=#A855F7 + 등급색 | ✅ 오행색 (saju-wood/fire/earth) | ✅ 오행색 + luckyMeta 컬러 glow | ❌ **hero의 grade.bg 한 번뿐, 본문 무채색 (white opacity)** |
| 타이포 위계 | ✅ title-3 헤더 / aggro hero / 16px 본문 | ✅ 22px aggro quip / 44px aggro 스코어 | ✅ 22px aggro / 메타 grid | ✅ 24px aggro / 18px 섹션 헤더 | △ hero만 aggro, **섹션 제목이 body-2(15px) text-secondary** — 본문보다 약함 |
| 진입/차트 모션 | ✅ animate-fadeIn + 레이더 rAF 480ms | ✅ fadeIn + 이중레이더 rAF | ✅ `durumi-stagger` 순차 진입 | ✅ `durumi-stagger` | ❌ **없음** (바 width transition뿐) |
| 분포 차트 | (`OverallDistributionChart` — 현재 소비자 dev/과거뷰) | — | — | — | ❌ |

핵심: **펫은 공유 결과 컴포넌트 사용 0건.** `components/result/` 11개 중 어느 것도 import하지 않는다 (PetResultClient.tsx import부 실측: Header·FullScreenLoading·grade-colors·gradeSystem만).

### 1-2. 공유 컴포넌트 props 실측 (재사용 판정 근거)

| 컴포넌트 | props (실측) | 펫에 그대로 맞나 |
|---|---|---|
| `OverallGradeBadgeSlot` | `grade: "S"~"D"`, `badgeSrc?`, `size?(48~220 clamp)` | ✅ **그대로.** 펫 `LabelGrade`(pet-compat.ts:61) = 동일 5등급, `getGradeBadge()` 그대로 사용 가능. SS 표기는 내부 `safeDisplayGrade`가 처리 |
| `CategoryRadarChart` | `categories: {key: CategoryKey; score; grade}[]` — **CategoryKey가 "재물운"~"대인운" 5개 리터럴로 하드코딩** (CategoryRadarChart.tsx:7,19) | ⚠️ **확장 필요.** 축 이름·개수 고정 + 라벨 2행이 등급 표시 전제. 범용 축 prop 추가(additive) 필요 |
| `CategoryPetalChart` / `ScoreGrid` | 동일하게 5개 키 하드코딩. 꽃잎 fill이 밝은 단색(수치를 안색으로 못 읽음) | ❌ 미채택 — 같은 확장 비용인데 레이더가 본 서비스 현역(ResultTable이 쓰는 건 Radar), 펫탈은 등급 대비 표현력이 낮음 |
| `OverallDistributionChart` | `percentileRank`, `markerLabel`, `gradeCutoffs` | ⚠️ **조건부.** props는 채울 수 있음(펫도 `COMPOSITE_GRADE_CUTOFFS` 단일 소스, pet-compat-scoring.ts:15) — 하지만 `percentileRankFromComposite`의 분포 곡선은 **개인 사주 분포로 캘리브레이션**된 것. 펫 composite 분포 미실측 상태에서 "상위 X%"를 찍으면 데이터 과장(feedback_data_reporting 위반). → **기본 미적용**, 후속에 펫 분포 실측 후 재검토 |
| `SectionList`/`SectionHeader`/`SectionBody` | `sections: {icon(이모지); title; content}[]`, `initialExpandedCount` — 아이콘 메타가 `SECTION_META`+`EMOJI_TO_KEY` 전역 맵 경유, 미등록 이모지는 회색 "관계" 폴백 (section-icons.ts:82) | ⚠️ **확장 필요.** 펫 섹션(판정·시뮬·타임라인)용 아이콘/라벨/액센트가 전역 맵에 없음. 이모지 전역 맵 오염 대신 **섹션별 meta 오버라이드 prop**(additive)이 안전. 주의: futureLine이 쓰던 "📍"는 이미 turningpoint에 매핑되어 있어 이모지 재사용 충돌 |
| `ResultView`/`ResultTable` | AnalysisResult(사주 전용 tier/scores/sections) 전제 | ❌ 데이터 모양이 달라 통째 재사용 부적합 — 하위 부품 단위로 재사용 |
| `ShareCTA` | 개인 사주 share 전용 고정 문구 | ❌ 펫 share CTA는 현행 유지 |

---

## 2. 개선 포인트 Top 5 (실측 근거)

**(a) 지표 시각화 — 얇은 바 → 레이더.**
사주는 5각 레이더(#FF6B6B 글로우 + 축 라벨에 등급색 + 480ms rAF, CategoryRadarChart.tsx:136-254), 배틀은 이중 레이더. 펫은 `h-2` 바 3개(white/80)가 전부(PetResultClient.tsx:318-323) — 유료 리포트의 "분석당했다" 감각이 없다.

**(b) 등급 배지 — 텍스트 chip → 배지 SVG+글로우.**
사주 hero는 `OverallGradeBadgeSlot`(rank-s.svg 120px, GRADE_GLOWS radial), 배틀도 양쪽 52px 배지+radial glow. 펫은 `px-2.5 py-1 rounded-lg text-[11px]` 텍스트 라벨뿐. 등급 relabel(SS 격상) 프로젝트로 만든 배지 자산을 펫만 안 쓴다.

**(c) 섹션 단조로움 — 동일 카드 10장 → 리듬.**
사주·투데이·이어리는 `SectionList` 아코디언(좌측 액센트 바 + duotone 아이콘 28px + title-3 + 라벨 chip + 접이 모션), 배틀은 같은 문법의 자체 카드(Simulations amber, FinalVerdict red). 펫은 `rounded-[24px] bg-background-tertiary p-6` 열 장이 시각적으로 구분 불가 — 게다가 **다른 화면 카드가 전부 `bg-background-secondary`(#18181B)인데 펫만 한 단계 밝은 `tertiary`(#27272A)**를 카드 배경으로 써서 결 자체가 어긋난다 (DESIGN_SYSTEM.md §3-3: tertiary는 "3차 배경, 입력필드" 용).

**(d) 컬러·타이포 위계 실종.**
펫 파일 상단 주석 "emerald/rose 금지 → 게이지·강조는 단색(white opacity)"이 과잉 적용되어 본문이 완전 무채색. 본 서비스는 등급색(GRADE_COLORS)·섹션 액센트(#60A5FA/#4ADE80/#F59E0B/#F87171)·오행색을 절제 있게 쓴다. 타이포도 펫 섹션 제목이 `text-body-2 text-text-secondary`(15px 회색)로 본문(body-1)보다 약함 — 다른 화면은 `text-title-3 text-text-primary`(19px). 아이콘도 펫만 이모지(🐾👑⚡📛), 나머지는 phosphor duotone.

**(e) 공유 컴포넌트 재사용 0 + 모션 부재.**
(a)~(d)의 공통 원인. 진입 모션(`durumi-stagger`·`animate-fadeIn`)과 차트 rAF 애니메이션(전 화면 표준, DESIGN_SYSTEM.md §6-2)도 함께 누락됐다.

---

## 3. 반영 설계 — 섹션별 재구성

새 화면 구조 (위→아래). `main`에 `durumi-stagger` + 루트에 `animate-fadeIn` 적용:

```
① HERO         일러스트(위치 유지) + OverallGradeBadgeSlot + label_text + headline + composite
② 궁합 레이더   CategoryRadarChart(범용 축 4개) — 호흡·사랑·충성·조화
③ 관계 역학     실세 tug-bar + 양방향 정(AffectionFlow) 통합 카드 (펫 고유, 로컬 재스타일)
④ 사용설명서    manual 7행 — 스펙시트 리스타일 (컨셉 유지)
⑤ 판정·시뮬    SectionList (meta 오버라이드): 판정 2 + 시뮬 3 + 앞으로의 너희
⑥ VERDICT      finalLine 마무리 카드 (등급색 글로우)
⑦ 면책/메타    disclaimer(D등급) + scoring 버전 — 현행 유지
```

### ① HERO — 배지·워시·위계

- 컨테이너: `rounded-3xl p-6 md:p-8` + `#141414`(사주 등급 카드와 동일) + **등급색 그라디언트 워시**(배틀 패턴 이식: `linear-gradient(180deg, {grade.main}1A 0%, {grade.main}0D 40%, transparent 70%)` — BattleHero.tsx:64). 현행 flat `grade.bg` 전면 배경보다 세련되고 등급 신호는 유지.
- 일러스트: **현 위치(hero 내 상단, aspect-square rounded-2xl) 유지** — Track B 관계 일러스트가 그대로 들어옴. `illustration_url` null이면 현행처럼 생략.
- 배지: 일러스트 아래(또는 null일 때 그 자리)에 `OverallGradeBadgeSlot grade={label_grade} badgeSrc={getGradeBadge(label_grade)} size={96}` + `{safeDisplayGrade}등급 · {composite}점` 한 줄 (사주 ResultTable:148-155 문법).
- 타이틀: `label_text` — `font-aggro text-[24px]`(이어리 hero와 동일 급), 등급색 대신 `text-text-primary`(등급색은 워시+배지가 담당, 텍스트까지 칠하면 과함).
- headline: `text-[14.5px] text-text-secondary leading-[1.75]` (이어리 description 문법).
- composite 56px 거대 숫자는 배지+`· NN점`으로 흡수하고 제거 (중복 위계 정리). "상위 X%"는 §1-2 판정대로 **표기하지 않는다**.

### ② 궁합 레이더 — CategoryRadarChart 범용화

- 축 4개 (전부 "높을수록 좋음"으로 정규화):
  - 호흡 = `sync_score` / 사랑 = `lover_score` / 충성 = `loyalty_score` / **조화 = 100 − conflict_score** (라벨 보조문구로 "어긋남 NN"을 정직하게 병기)
  - **실세(ruler)는 레이더에서 제외** — ruler는 "높을수록 좋음"이 아니라 방향값(≥50 펫 우위)이라 레이더 면적 문법과 충돌. ③ 관계 역학으로 이동.
- 컴포넌트 확장 (additive): `CategoryRadarChart`에 범용 축 타입 추가:
  ```ts
  export type RadarAxis = { key: string; label?: string; score: number; grade?: string; subLabel?: string };
  type Props = { categories?: CategoryItem[]; axes?: RadarAxis[] };  // 기존 categories 시그니처 유지
  ```
  - `axes` 미전달 시 기존 `categories`→5키 정렬 경로 그대로 (렌더 결과 0 변화).
  - `axes` 전달 시: 축 개수 N 지원(angleStep=360/N — 내부 수식은 이미 `orderedCategories.length` 기반이라 대부분 그대로), 라벨 2행째는 `grade` 없으면 등급 tspan 생략하고 점수(또는 subLabel)만.
  - 4축이면 정사각 다이아몬드 — 시각 확인 후 필요 시 각도 오프셋 조정(-90 유지: 위·좌우·아래).
- 카드 래퍼는 컴포넌트 내장(#141414 rounded-3xl) 그대로 + 위에 펫용 헤더("궁합 리포트" title-3) 추가.

### ③ 관계 역학 — 펫 고유, 로컬 유지 + 재스타일

- AffectionFlow(양방향 정)는 **펫 고유 개념이라 공유화하지 않고 로컬 유지**. 단 재스타일:
  - 카드: `bg-background-secondary rounded-3xl border border-white/8 p-6` (표준 차트 카드).
  - 헤더: phosphor duotone(예: `ArrowsLeftRight`/`Heart`) + `text-title-3 text-text-primary` (영문 ALL-CAPS 보조라벨 "AFFECTION FLOW"류는 제거 — 본 서비스 어디에도 없는 문법).
  - 바: white/85 → `bg-primary/70`(투데이 ScoresBar:36과 동일 강조), 열세측은 white/25. verdict 문장은 유지.
- **실세(ruler) tug-bar 신설**: 좌(너) ↔ 우(펫 이름) 양끝 라벨 + 중앙 50 눈금 + 마커가 ruler_score 위치로 700ms 이동. 기존 Gauge의 "실세 지수" desc 로직(≥50 펫 우위) 재사용. 이 카드가 기존 "관계 지표" 게이지 3개 카드를 대체(sync·conflict는 ②레이더로, ruler는 여기로 — 정보 손실 0).

### ④ 사용설명서 — manual 7행 스펙시트 (컨셉 유지)

- 컨셉·7행·문구 전부 유지. 디자인만:
  - 카드: `bg-background-secondary rounded-3xl border border-white/8 p-6` 단일 카드.
  - 헤더: duotone `ClipboardText` + `{pet.name} 사용설명서` title-3 + 우측 caption "제품 사양" (영문 "PRODUCT MANUAL" 대체 — 시니어 시청자·본 서비스 톤).
  - 행: 현행 "카드 안 미니카드 7장"(secondary-in-tertiary 이중 네스팅) → **`divide-y divide-white/5` 스펙시트 행**(이어리 MonthRow 문법): 좌측 고정폭 라벨(`text-[12px] text-text-tertiary`) + 우측 값(`text-[15px] text-text-primary leading-[1.6]`).
  - highlight 행(권장 보호자 모드): 좌측 `w-1` 액센트 바(#F59E0B류 1색) + `bg-white/[0.03]` 틴트 — SectionList 액센트 문법 재사용.

### ⑤ 판정·시뮬·타임라인 — SectionList 재구성

- `SectionList`에 additive 확장: `ResultSection`에 선택 필드 `meta?: { Icon; label; color; bg; accent }` 추가. 있으면 `SECTION_META[resolveKey(icon)]` 대신 사용 (기존 소비자 sections에는 meta가 없으므로 렌더 결과 0 변화). 전역 `SECTION_META`/`EMOJI_TO_KEY` 오염 없음(📍 충돌 회피).
- 펫 섹션 6개 구성 (PET_SECTION_META를 펫 로컬 상수로):
  | 섹션 | 제목 | 아이콘(duotone) | 액센트 | 기본 상태 |
  |---|---|---|---|---|
  | ownerVerdict | 너에게 솔직히 | Megaphone | #F87171 (warning 결) | 펼침 |
  | petVerdict | {pet.name}에 대해 | PawPrint | #4ADE80 | 펼침 |
  | 시뮬 ×3 | {sim.scene} | GameController/House/Confetti류 | #F59E0B (배틀 시뮬과 동일) | 접힘 |
  | futureLine | 앞으로의 너희 | MapPin | #A855F7 (turningpoint 결) | 접힘 |
- `initialExpandedCount=2` (판정 2개 펼침 — 유료 핵심 콘텐츠는 바로 보이게, 시뮬·미래는 열어보는 재미).
- 본문은 SectionBody 일반 경로(문단 분리 16px/1.75) 그대로 — locked 기능 미사용.

### ⑥ VERDICT — finalLine

- 유지하되: `rounded-3xl bg-background-secondary border border-white/8` + 등급색 radial glow(`GRADE_GLOWS[grade]` — OverallGradeBadgeSlot에서 export 중) 은은하게 + caption "두루미의 한 줄" (한글) + aggro 20px. 공유 캡처의 마침표 역할 유지.

### share 페이지 (`SharePetCompatClient.tsx`)

- 데이터 props 불변. 시각만 동기화: hero ①과 동일 처리(워시+배지), Mini 5칸 그리드는 유지하되 카드 토큰(`bg-background-secondary rounded-2xl border border-white/8`)과 duotone 아이콘으로 재스타일, VERDICT ⑥ 동일. 레이더는 share에 넣지 않음(teaser는 가볍게 — 현행 정보량 유지).

---

## 4. 재사용 vs 신규 판단 요약

| 구분 | 대상 | 판단 |
|---|---|---|
| **그대로 재사용** | `OverallGradeBadgeSlot`, `GRADE_GLOWS`, `getGradeBadge/getGradeColor`, `safeDisplayGrade`, `durumi-stagger`, `animate-fadeIn` | 수정 0 |
| **공유 확장 (additive)** | `CategoryRadarChart` — `axes?` prop (기본 경로 불변) | 소비자 = ResultTable 1곳. dev/result-ui로 회귀 검증 |
| **공유 확장 (additive)** | `SectionList`/`SectionHeader` — 섹션별 `meta?` 오버라이드 | 소비자 = ResultTable·today·yearly 3곳. meta 미전달 시 기존 경로 |
| **로컬 유지 + 재스타일** | AffectionFlow(양방향 정), 실세 tug-bar(신설), ManualRow→스펙시트 행, VERDICT 카드, PET_SECTION_META | 펫 고유 개념 — 소비자 1곳이라 공유화 이득 없음 |
| **삭제** | 로컬 `Gauge`(얇은 바 3개 카드) | ②레이더+③tug-bar가 정보 전부 흡수 |
| **미적용** | `OverallDistributionChart`(분포 미실측), `CategoryPetalChart`/`ScoreGrid`(레이더로 충분), `ResultView`/`ResultTable` 통째 재사용(데이터 모양 상이) | 근거 §1-2 |

사이드이펙트 가드: 공유 컴포넌트 2건 다 "새 optional prop, 미전달 시 기존 코드 경로 그대로" 원칙. 기존 호출부는 한 줄도 안 바뀜.

---

## 5. 작업 태스크 분해

### Task 0 — dev 데모 페이지 (검증 인프라 먼저)
- [ ] `app/dev/pet-result-ui/page.tsx` 신설: `app/dev/result-ui/page.tsx` 패턴 복제(prod `notFound()`), mock `PetCompatResult`+지표점수(`lib/mockPetResult.ts` 신설 — S등급·B등급 2케이스, illustration_url 유/무 2변형)로 리디자인 대상 본문을 렌더
- [ ] 현행 화면 **before 스크린샷** 확보 (webapp-testing 스킬 / Playwright, 640px 뷰포트)
- 검증: `npx tsx`로 mock 타입체크, dev 서버에서 페이지 열림

### Task 1 — CategoryRadarChart 범용 축 확장 (공유, 최고 리스크 먼저)
- [ ] `axes?: RadarAxis[]` prop 추가 — 내부 `orderedCategories`를 축 배열로 일반화, grade 없으면 등급 tspan 생략, N축 지원
- [ ] **회귀 0 검증**: `/dev/result-ui` 전/후 스크린샷 픽셀 비교(개인 사주 5각형 불변), `npx tsc --noEmit`
- 파일: `components/result/CategoryRadarChart.tsx`

### Task 2 — SectionList meta 오버라이드 (공유)
- [ ] `ResultSection`에 `meta?` 추가, `SectionItem`→`SectionHeader`가 meta 있으면 전역 맵 대신 사용
- [ ] 회귀 검증: `/dev/result-ui` 아코디언 + today/yearly 결과 화면 1건씩 육안(액센트 바 색·라벨 chip 불변)
- 파일: `components/result/SectionList.tsx`, `SectionHeader.tsx`

### Task 3 — 펫 HERO + 레이더 + 관계 역학 (본체 전반부)
- [ ] HERO ① 구현 (워시·배지·타이포·일러스트 위치 유지·56px 숫자 제거)
- [ ] 레이더 ② — `axes` 4축(호흡·사랑·충성·조화=100−conflict) 연결
- [ ] 관계 역학 ③ — 실세 tug-bar 신설 + AffectionFlow 재스타일, 기존 Gauge 카드 삭제
- 파일: `app/pet/result/PetResultClient.tsx`
- 검증: dev 데모에서 S/B 2케이스 + 일러스트 유/무 스크린샷, 등급색 워시가 5등급 전부 정상(getGradeColor 순회)

### Task 4 — 사용설명서 + 판정 SectionList + VERDICT (본체 후반부)
- [ ] manual ④ 스펙시트 리스타일 (7행·문구 불변)
- [ ] 판정·시뮬·futureLine ⑤ — PET_SECTION_META 상수 + SectionList(meta, initialExpandedCount=2)로 교체
- [ ] VERDICT ⑥ + disclaimer/메타 ⑦ 정리, `main`에 durumi-stagger·루트 fadeIn
- 파일: `app/pet/result/PetResultClient.tsx`
- 검증: 시뮬 0건·disclaimer 유/무 엣지 렌더, 접기/펼치기 모션, 모바일 375px 폭 겹침 없음

### Task 5 — share 페이지 동기화
- [ ] `SharePetCompatClient.tsx` hero·Mini·VERDICT 재스타일 (props·정보량 불변)
- 검증: 비로그인 접근 유지, 본 결과 페이지와 결 일치 스크린샷

### Task 6 — 최종 검증 + 회귀 매트릭스
- [ ] `npx next build` 성공 (dev 서버 내리고)
- [ ] **after 스크린샷** — before와 나란히 운영자 보고 (feedback_show_results_desktop: 산출물 직접 보여주기)
- [ ] 실화면 검증: dev 세션 쿠키로 실제 pet 결과 1건(운영자 테스트 데이터) 열어 API→렌더 전 구간 확인
- [ ] 회귀 매트릭스 전수: `/result`(개인)·`/battle/result`·`/today/result/[id]`·`/yearly/result/[id]`·`/result/share/*`·`/dev/result-ui` 각 1회 육안 — 공유 컴포넌트 확장 여파 0 확인
- [ ] 커밋 (왜 바꿨는지 포함) — feat/pet-resume 누적, 머지/배포는 운영자 게이트

순서 의존성: Task 0 → 1·2(병렬 가능) → 3 → 4 → 5 → 6. Task 1·2가 앞인 이유 = 공유 컴포넌트 회귀가 최대 리스크라 초기에 격리 검증.

---

## 6. 회귀 불변 (깨면 안 되는 것)

1. **Track A 콘텐츠**: 판정문·manual 문구·라벨은 서버/LLM 산출물 그대로 표시 — 프론트에서 텍스트 가공 추가 금지 (기존 whitespace-pre-line 유지)
2. **Track B 일러스트**: hero 내 일러스트 슬롯(1:1, rounded-2xl) 위치·비율 유지 — 관계 일러스트가 코드 변경 없이 들어와야 함. null 허용 분기 유지
3. **share 페이지**: URL·props·비로그인 접근·정보량 불변 (시각만)
4. **데이터 모양**: API 응답 스키마·`PetCompatResult`·scoring v4·DB 불변. 프론트 전용 변경
5. **공유 컴포넌트 소비자 회귀 0**: ResultTable(사주 result/share/my/dev)·today·yearly — 새 prop 미전달 경로가 기존 코드와 동일함을 Task 1·2에서 각각 증명 후 진행
6. **결제/복구 플로우**: PetResultClient의 fetch·인증 리다이렉트·에러 분기 로직은 손대지 않음 (JSX만 교체)

## 7. 비범위 재확인

- 콘텐츠 글 재작성 ❌ (Track A 완료) / 일러스트 생성 ❌ (Track B) / 점수·등급 로직 ❌ / DB·API ❌
- 이 계획은 **레이아웃·시각 전용**이다.
