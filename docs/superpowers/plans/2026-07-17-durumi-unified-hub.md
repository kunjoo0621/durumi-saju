# 두루미 통합 허브 — 랜딩+메뉴 단일 페이지 디자인 계획

- **작성일**: 2026-07-17
- **상태**: 계획만 (코드 변경 0건). 실행은 태스크 게이트 순서대로.
- **브랜치**: `main` → `feat/unified-hub` (태스크별 커밋 분리)
- **한 줄 요약**: 로그아웃 마케팅 랜딩(`/`)과 로그인 후 서비스 메뉴(`/menu`)의 2단계 구조를 **auth-adaptive 단일 허브 `/`** 로 통합하고, 매거진(`/stories`)·사주사전(`/dict`) 콘텐츠 자산을 진입 화면에 편입해 "보자마자 고르고, 안 고르면 읽는" 한 스크롤 페이지를 만든다. 서비스 카드는 "그림이 판다" 포스터형으로 승격하되, 자극·공포·성인 톤은 절대 따라가지 않는다.

---

## 1. 현재 vs 통합 후 구조 비교

### 1-1. 구조 비교표

| 항목 | 현재 (2단계) | 통합 후 (1허브) |
|------|-------------|----------------|
| 첫 화면 | `/` = 마케팅 랜딩 (`app/page.tsx`, "use client" + Suspense) | `/` = 단일 허브. **서버 컴포넌트 셸 + `HubClient`** 로 분리 |
| 서비스 선택 | `/menu` (`app/menu/page.tsx`, 카드 5장 + 112px 인라인 SVG) | 허브 섹션 ③ 서비스 포스터카드 5장 (최상단 액션) |
| 로그인 후 착지 | `/menu` | `/` (같은 페이지가 auth-adaptive로 변형) |
| 콘텐츠 자산 | 진입 동선에 없음 (`/stories`, `/dict` 고립) | 섹션 ④ 매거진 peek 레일 + ⑤ 사전 개념 그리드로 편입 |
| 결과 예시 이미지 | 랜딩 본문의 주인공 (FeatureCard 4장) | 섹션 ⑥ "이런 결과를 받아요" proof로 강등 (2장) |
| 스티키 CTA | 랜딩에만 (`AnalysisCounter` + "사주 보러가기") | 허브 전체에 auth 분기 CTA (⑧) |
| 유입→분석 클릭 수 | 랜딩 CTA → 로그인 → 메뉴 → 서비스 = **3클릭+2페이지** | 허브 카드 → (로그인) → 서비스 = **1클릭+1페이지** |

### 1-2. 라우팅 변경 상세

| # | 변경 | 방법 (구체) |
|---|------|------------|
| R1 | `/menu` → `/` redirect | `next.config.mjs`의 `redirects()`에 `{ source: "/menu", destination: "/", permanent: false }` 추가. **307(임시)** 로 시작 — 롤백 여지 확보, 안정화 후 308 승격 검토. `app/menu/page.tsx`는 파일 삭제 (redirect가 앞단에서 잡으므로 죽은 코드 잔존 금지). |
| R2 | 코드 내 `/menu` 리터럴 | 실측: `grep -rln '"/menu"' app/ components/` = **20개 파일** (`app/result/ResultClient.tsx`, `app/start/page.tsx`, `app/login/page.tsx`, `components/LoginForm.tsx`, `components/AuthGate.tsx`, `app/battle/input/page.tsx`, `app/today/*`, `app/yearly/*`, `app/pet/*`, `app/my/results/page.tsx`, `components/battle/BattleResultView.tsx` 등). redirect가 전부 커버하므로 **기능은 R1만으로 안전**하지만, 불필요한 307 홉 제거를 위해 별도 커밋으로 `"/menu"` → `"/"` 전수 치환 (T3b). 치환 후 `grep -rn '"/menu"'` 0건 확인. |
| R3 | 랜딩 `callbackUrl` 기본값 | 현재 `app/page.tsx`: `returnTo`(‘/’ 시작일 때만) \|\| `"/menu"`. → 기본값을 `"/"` 로. **returnTo 검증 로직(`startsWith("/")`)은 그대로 보존** (open-redirect 방지). |
| R4 | 로그인 콜백 | `components/LoginForm.tsx` / `app/login/page.tsx`의 `callbackUrl` 기본 `/menu` → `/`. NextAuth 설정(`lib/auth.ts`)에 하드코딩된 `/menu`가 있는지 T3에서 확인 후 동일 치환. |
| R5 | `middleware.ts` | **변경 없음.** `/`, `/menu` 모두 이미 비보호(referrer 캡처만). 보호경로 미로그인 → `/?returnTo=...` 메커니즘은 통합 후에도 그대로 동작 — 허브가 `returnTo`를 받아 로그인 CTA의 callbackUrl로 넘기면 끝. `matcher`에서 `/menu` 항목만 제거(정리). |
| R6 | 페이지 아키텍처 | `app/page.tsx`를 **서버 컴포넌트**로 전환: `getAllStories()`(fs 기반)·사전 슬러그 목록을 서버에서 읽어 props로 주입 → 클라이언트 훅(useSession, useScrollReveal, searchParams)은 신규 `app/HubClient.tsx`("use client")로 이관. Suspense 래핑(searchParams) 유지. |

### 1-3. auth-adaptive 분기 요약 (한 페이지, 두 얼굴)

| 섹션 | 로그아웃 | 로그인 |
|------|---------|--------|
| ① 히어로 | 풀 히어로 (훅 카피 + 포스터) | **축약 히어로** (인사 + 포스터 소형) — 재방문자는 바로 ③이 보여야 함 |
| ③ 서비스 카드 | 클릭 → `/login?callbackUrl={서비스 경로}` | 클릭 → 서비스 직행 (기존 menu 로직 그대로) |
| ⑧ 스티키 CTA | "카카오로 3초만에 시작" | 결과 있음 → "내 결과 보기", 없음 → "사주 시작하기" |
| ②④⑤⑥⑦ | 동일 | 동일 |

---

## 2. 통합 페이지 섹션별 상세 스펙

페이지 셸은 디자인 시스템 그대로: `max-w-[640px] mx-auto`, `bg-background-primary(#09090B)`, sticky Header `z-[100]`, 스티키 CTA `z-[120]`. 섹션 간 `space-y-16`(랜딩 관성), 섹션 페이드인은 기존 `useScrollReveal` 재사용.

### ① 히어로 (훅 + 두루미 포스터) — 기존 재활용

- **목적**: 3초 안에 "여긴 뭐 하는 곳인지 + 톤(귀엽고 진지한 사주)"을 전달.
- **구성**: 기존 랜딩 히어로 이관 — `font-aggro text-[28px]` 훅 "사주 보면 결국 똑같은 말 나오지?" + `/images/landing/section-01.png` + brand radial glow(`rgba(var(--primary),0.22)`). `ShareRewardBanner`도 현 위치(헤더 하단) 유지.
- **auth 분기**: 로그인 시 훅 대신 인사형 1줄(`{name}님, 오늘은 뭘 볼까요?` — `useSession().data.user.name`)로 교체하고 포스터 높이를 절반(`h-[160px]`)으로 축약. 스크롤 0에서 ③ 카드 첫 장이 보이는 것이 목표.
- **시니어 가드**: 훅 28px 유지(≥18px), 이미지 위 텍스트 없음(텍스트는 이미지 밖).
- **카피 방향**: 기존 훅 유지(검증된 카피). 서브카피 1줄만 추가 — "포스터 훅 + 무엇을 얻는지" 예: "AI가 만세력을 계산하고, 결과는 재미있게 풀어드려요."

### ② AnalysisCounter — 실데이터 소셜프루프

- **목적**: 히어로 직후 신뢰 앵커. 가드 5(가짜 소셜프루프 금지)를 실데이터로 충족.
- **구성**: `components/AnalysisCounter.tsx` **수정 없이 그대로** (이미 `/api/stats/analyses` 실측 마일스톤 + 카운트업). 위치만 히어로 바로 아래 본문으로 이동.
- **결정**: 현재는 스티키 CTA 안에 있음 → **본문 ②로 이동하고 스티키에서는 제거.** 이유: (a) 중복 노출 방지, (b) 스티키 높이 절약 = 시니어 시야에서 본문 가림 최소화. 스타일 업그레이드는 폰트만 `text-[13px]` → `text-[15px]` 래퍼로 감쌈(컴포넌트 수정 대신 부모에서 `[&_p]:text-[15px]` 또는 그냥 그대로 사용 — 공용 수정 금지 원칙 우선, 최종은 그대로 사용).

### ③ ★서비스 5장 포스터카드 — 허브의 심장 (menu 편입, 최상단 액션)

- **목적**: "보자마자 고른다". 메뉴 페이지의 유일한 존재 이유를 이 섹션이 흡수.
- **신규 컴포넌트**: `components/hub/ServiceCard.tsx` + `components/hub/ServiceCardList.tsx`. **`app/menu/page.tsx`의 로직을 그대로 이식** (신규 파일이므로 공용 회귀 없음):
  - 사주 카드: `handleSajuClick` — 세션 없으면 `/start`(현행 유지: start는 비보호), 있으면 `/api/results` fetch → 결과 있으면 `/my/results`, 없으면 `/start`. `checking`/`checkError` 상태 UI 포함 이식.
  - yearly: `YEARLY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1"` **피처플래그 분기 보존** (off면 카드 자체 미렌더 → 4장).
  - today: `TODAY_LABEL`("N월 N일") 동적 라벨 + `TODAY_COST`.
  - 배틀: `resetBattle()` → `/battle/input`. 펫: `resetPet()` → `/pet/input` + **NEW 칩 + 취소선 런칭할인가(`PET_COMPAT_COST`→`PET_COMPAT_LAUNCH_COST`) 표기 로직 보존**.
  - 알 가격: `@/lib/constants/coins`의 `SAJU_COST`/`BATTLE_COST`/`YEARLY_COST`/`TODAY_COST`/`PET_COMPAT_*` + `Egg` 아이콘 그대로.
  - **로그아웃 분기(신규)**: 미로그인 클릭 시 `/login?callbackUrl={목적지}` (returnTo 검증 규칙 재사용). 배틀·펫처럼 입력 페이지가 비보호인 경우는 바로 입력으로 보내는 현행 동작 유지.
- **레이아웃**: **세로 스택 유지** (가드 4 — 핵심 서비스 선택에 스와이프 강제 금지). `space-y-4`.
- **Phase A (저위험, 먼저)** — 현행 가로 카드 골격 유지 + 우측 비주얼만 교체:
  - `rounded-2xl bg-background-secondary hover:bg-background-tertiary`(하드코딩 `#141414`/`#1A1A1A` → 토큰 치환), `py-7 pl-8 pr-4 flex items-center`, `active:scale-[0.97]` + cubic-bezier bounce + slideUp 스태거 애니메이션 이식.
  - 우측 112px 인라인 SVG 도형 → **112×140px(4:5) 일러스트 썸네일** (`rounded-xl overflow-hidden`, `next/image`, WebP). 뒤 blur glow는 서비스 틴트색 유지: 사주 `#FF6B6B` / yearly `#F59E0B` / today `#0EA5E9` / 배틀 `#A855F7` / 펫 `#34D399`.
  - 좌측 텍스트: 칩(12px) + 제목 `text-[20px] font-bold`(현 xl=20px 유지, 18px 미만 금지) + 설명 `text-[14px] text-text-secondary` + 알 가격.
- **Phase B (실험, 별도 게이트)** — 대표 1장(개인 사주)만 full-bleed 포스터로:
  - `aspect-[4/5]` 는 세로 스택에서 과도 → **`aspect-[16/10]` 가로 포스터** (4:5 소스를 `object-cover object-top`으로 크롭), `rounded-3xl`.
  - 텍스트는 **이미지에 굽지 않고 코드 오버레이**: 하단 스크림 `bg-gradient-to-t from-black/85 via-black/45 to-transparent` (하단 45% 높이) 위에 제목 `font-aggro text-[24px] text-white` + 설명 `text-[15px] text-white/85` + 가격 칩. 스크림 하단부 `black/85` 위 white = **대비 약 14:1**, `white/85`도 ≥ 8:1 — 4.5:1 실측 게이트 통과 여유.
  - PetResultClient 리디자인(블록 없이 이미지가 hero)의 진입부 버전. A/B는 코드 분기 없이 커밋 단위로 전환 → 스크린샷 비교 후 운영자 판단.
- **카피 방향(칩+설명, 확정 초안)** — 가드 2·3 준수 (공포·서열화·"무료" 없음):

| 서비스 | 칩 | 제목 | 설명 (1줄) |
|--------|-----|------|-----------|
| 사주 | `평생 사주` | 내 사주 분석 | 타고난 기질과 흐름을 5가지 운으로 풀어봐요 |
| 배틀 | `둘이서` | 사주 배틀 | 두 사람 사주를 나란히 놓고 궁합을 겨뤄봐요 |
| today | `7월 17일` (동적) | 오늘의 운세 | 오늘 하루, 내 사주엔 어떤 날인지 확인해요 |
| yearly | `2026년` (동적) | 올해 운세 | 올해 남은 흐름을 월별로 미리 봐요 |
| 펫 | `NEW` | 반려동물 궁합 | 우리 아이와 나, 얼마나 잘 맞을까요 |

### ④ 읽을거리 peek 캐러셀 — 매거진 편입

- **목적**: "지금 결제 안 할 사람"을 이탈 대신 콘텐츠로 잡아 신뢰 축적 + 재방문 동선. 부차 콘텐츠이므로 가로 peek 허용(가드 4 예외 조건 충족).
- **신규 컴포넌트**: `components/hub/StoryRail.tsx` + `components/hub/HubStoryCard.tsx`. **`components/stories/StoryCard.tsx`는 수정하지 않는다** (가로형 풀폭 카드라 레일에 부적합 + 공용 수정 금지). 재사용하는 것: `StoryCardViewBadge`(조회수), `getAllStories()`/`getReadingMinutes()`(`lib/stories/registry.ts`), `story.heroImage`.
- **데이터**: 서버 컴포넌트(`app/page.tsx`)에서 `getAllStories()` 최신 6편(heroImage 있는 글 우선)을 골라 `HubClient`에 props로 주입. 클라이언트 fetch 없음.
- **레이아웃**: CSS scroll-snap만 (라이브러리 X):
  ```
  레일: flex gap-3 overflow-x-auto snap-x snap-mandatory px-5 scroll-px-5
        [-webkit-overflow-scrolling:touch] scrollbar 숨김(scrollbar-width:none)
  카드: snap-start shrink-0 w-[280px]
  ```
  마지막 카드 뒤 "전체 보기" 고스트 카드(→ `/stories`). 다음 카드가 ~40px 살짝 보이는 peek로 스와이프 어포던스 확보(도트/화살표 UI 불필요).
- **HubStoryCard 구성** (세로형): 상단 `aspect-[4/3] rounded-2xl` heroImage(`next/image`, `sizes="280px"`) → 제목 `font-aggro text-[18px] leading-[1.3] line-clamp-2 wordBreak:keep-all` → 메타 줄 `text-[13px] text-text-tertiary` = 카테고리 핸들(`STORY_CATEGORY_HANDLE`) · 읽기시간 · `StoryCardViewBadge`(조회수 = 실데이터 소셜프루프).
- **섹션 헤더**: `font-aggro text-title-3` "읽을거리" + 우측 `text-[14px] text-text-secondary` "전체 보기 →"(`/stories`). 서브카피: "회원가입 없이 읽을 수 있어요" — **"무료 분석" 오해 소지가 없는 사실 문장만** (매거진은 실제 무료 콘텐츠).
- **시니어 가드**: 카드 1장에 정보 3덩이(이미지·제목·메타)만. 제목 18px. 스냅 단위 = 카드 1장.

### ⑤ 사주 사전 개념 그리드 — dict 편입 + 내부링크 SEO

- **목적**: (a) 검색 의도가 있는 방문자를 개념 페이지로 연결, (b) **홈(`/`)은 사이트에서 가장 자주 크롤링되는 페이지 — 여기서 사전 딥링크를 걸면 개념 페이지에 링크 에쿼티가 흐르고 재크롤링 주기가 짧아진다.** 현재 사전은 결과화면·홈 어디에서도 딥링크 0인 고립 자산(long-tail 검색이 유일 유입원). 이 섹션이 그 고립을 끊는다.
- **신규 컴포넌트**: `components/hub/DictConceptGrid.tsx`. 링크는 **서버 렌더 `<Link>`** (SEO 목적상 반드시 초기 HTML에 포함 — 지연 로딩 금지).
- **콘텐츠**: `lib/dict/registry.ts` 실측 슬러그 기준 8개 고정 큐레이션 (라우트 패턴 `/dict/[category]/[slug]`). 선정 기준 = 등급 콘텐츠 전략(검색되는 개념에 다리) + long-tail 실유입원(일주·신살):

| 표시 라벨 (훅형) | 링크 | 근거 |
|------------------|------|------|
| 내 사주는 몇 등급일까 | `/dict/saju/grade` | 등급 개념 허브 (isOverview) |
| 좋은 일주는 따로 있을까 | `/dict/gabja/ilju-grade` | "좋은일주" 검색 다리, 60갑자 허브 |
| 격국 — 사주의 그릇 | `/dict/gyeokguk/intro` | "격국" 실검색 개념 |
| 천을귀인, 최고의 길신 | `/dict/sinsal/cheonyl-gwiin` | 길신 광맥 (백로그 1순위 주제) |
| 도화살은 나쁜 걸까 | `/dict/sinsal/dohwa` | 신살 최다 인지도 |
| 사주팔자, 8글자의 정체 | `/dict/saju/saju-palja` | 입문 허브 |
| 일간 — 사주의 중심 '나' | `/dict/saju/ilgan` | 입문 핵심 |
| 신살 등급 한눈에 | `/dict/sinsal/sinsal-grade` | 신살 허브 (isOverview) |

  하단 "사전 전체 보기 →" (`/dict`).
- **레이아웃**: `grid grid-cols-2 gap-3`. 셀 = `rounded-2xl bg-background-secondary border border-white/8 p-4 min-h-[76px] flex flex-col justify-center` + 라벨 `text-[15px] font-semibold leading-[1.4]` + 카테고리 캡션 `text-[12px] text-text-tertiary`(`DICT_CATEGORY_LABEL` — 사주 입문/60갑자/신살/격국). `hover:bg-background-tertiary active:scale-[0.98]`.
- **가드**: 훅 라벨에 한자 표기 금지(가드 6 — `hanja` 필드 노출 안 함), 서열·공포 앵글 금지("F 일주" 류 X — 위 표는 전부 호기심형). 2열 그리드는 375px에서 셀 내 텍스트 15px 2줄까지 검증(⑥ 검증 참조).

### ⑥ "이런 결과가 나와" 미리보기 — 기존 랜딩 proof로 강등

- **목적**: 결과물의 실물감. 예전 랜딩의 주인공이었던 예시 이미지를 보조 증거로 축약.
- **구성**: 기존 `FeatureCard`(랜딩 로컬 컴포넌트 — 이관 시 `components/hub/`로 이동) **2장만**: `card-2-1.png`(개인 사주 결과) + `card-3-1.png`(배틀 결과). `card-2-2`/`card-3-2`는 섹션에서 제거(파일은 유지, 참조만 삭제). 골격은 현행(상단 badge/title/body 중앙정렬 + 하단 4:3 이미지 분리형) 유지 — **분리형이라 이미지 위 텍스트 대비 이슈 자체가 없음.**
- **섹션 헤더**: "이런 결과를 받아요". 각 카드 badge는 대응 서비스명, body는 결과 구성 요소를 사실 서술("5개 운 점수와 만세력, 풀이 전체").
- **auth 분기**: 없음(양쪽 동일). 로그인 상태에서도 미경험 서비스(배틀 등) proof로 유효.

### ⑦ FAQ — 기존 아코디언 유지 + 검수

- **구성**: 기존 `FAQ_ITEMS` 5개 + 아코디언 그대로 이관. 항목 1개 교체/추가: "돈 내기 전에 볼 수 있는 건 없나요?" → "매거진과 사주 사전은 로그인 없이 전부 읽을 수 있어요. 분석 서비스는 알(코인)로 이용해요." — **분석이 무료라는 오해를 차단하면서 콘텐츠 자산을 재소구.**
- **가드 3 검수**: 이관 시점에 FAQ 전 항목 + 랜딩 전 카피에서 "무료" 단어 전수 grep (⑥ 검증 절차에 포함). "무료"가 남는 유일한 허용처 = 매거진/사전이 무료 **콘텐츠**라는 사실 서술.

### ⑧ 스티키 CTA — auth 분기

- **구성**: `fixed bottom-0 z-[120]`, `bg-background-primary` + 상단 그라디언트 페이드(현행), `pb-[calc(16px+env(safe-area-inset-bottom))]`, 내부 `max-w-[640px]`. 버튼 `btn-primary w-full rounded-xl py-4 text-[16px] font-semibold`(시니어 — 15px에서 1px 상향, 토큰 밖 하드코딩은 랜딩 관례상 허용).
- **분기 로직**:

| 상태 | 라벨 | 동작 |
|------|------|------|
| 로그아웃 | "카카오로 3초만에 시작하기" | `router.push(callbackUrl 반영된 /login)` — R3의 returnTo 규칙 그대로 |
| 로그인 + 결과 있음 | "내 결과 보기" | `/my/results` |
| 로그인 + 결과 없음/확인 중 | "사주 시작하기" | `/start` |

  결과 유무는 로그인 상태에서만 마운트 시 1회 `/api/results` GET(③ 사주 카드의 fetch와 **공유** — `HubClient`에서 1회 fetch해 ③과 ⑧에 내려줌. 중복 호출 금지). 확인 중엔 "사주 시작하기" 표시(스피너 금지 — 어차피 목적지 동일 계열, 깜빡임만 시니어에게 해로움).
- `AnalysisCounter`는 ②로 이동했으므로 스티키에서 제거(높이 1줄 절약).

---

## 3. 서비스 대표 일러스트 5종 + 스타일 락

### 3-1. 신규 문서 `docs/SERVICE_POSTER_STYLE.md` (T1에서 작성)

`docs/HERO_ILLUSTRATION_STYLE.md`(매거진 hero 락)와 **캐릭터는 공유, 무드는 분리**:

| 항목 | 락 값 |
|------|-------|
| 캐릭터 | chibi 3D Pixar 스타일 두루미 — cream 몸통 + coral crown (매거진 hero와 동일 개체. 도사 복장·수염·부적 금지 = 가드 6) |
| 배경 팔레트 | 다크 네이비 `#0B1020` ~ 차콜 `#18181B` 그라운드 + 웜 앰버 `#F59E0B` 계열 림라이트/광원. 서비스별 틴트 1색만 포인트(메뉴 glow 색 계승) |
| 소스 규격 | **4:5 세로 1080×1350 PNG 원본** → 배포는 WebP 변환(장당 ≤150KB), Phase A는 280×350 리사이즈본 별도 export |
| 저장 경로 | 원본 PNG는 저장소 밖(로컬 작업 폴더, 방치 금지 — 가드 8) / 배포본만 `public/images/hub/service-{saju,battle,today,yearly,pet}.webp` |
| 금지 | 이미지 내 글자·숫자·한자 일절 금지(제목은 코드 텍스트) / 사람 실사 얼굴 금지 / 공포·점집 무드 금지 |
| 조명 | 단일 웜 광원 + 시네마틱 rim light, 하단 45%는 어둡게 떨어지도록(스크림 오버레이와 자연 합성되게) |
| 프롬프트 관리 | 스타일 서픽스를 문서 내 한 블록으로 고정(`scripts/generate-story-hero.mts`의 STYLE_SUFFIX 한곳 관리 패턴 답습) |

### 3-2. 5종 장면 + 칩 카피 + 프롬프트 초안

| 서비스 | 틴트 | 장면 (한 문장) | 프롬프트 초안 (영문, 스타일 서픽스 별도) |
|--------|------|----------------|------------------------------------------|
| 사주 | `#FF6B6B` | 두루미가 펼쳐진 커다란 두루마리 위로 별자리처럼 떠오른 네 개의 빛기둥을 올려다봄 | A cute chibi 3D crane bird looking up in wonder at four glowing constellation-like pillars of light rising from a large unrolled scroll, dark navy night backdrop, warm amber rim light, soft coral accent glow |
| 배틀 | `#A855F7` | 두루미 두 마리가 마주 서서 날개를 맞대고, 사이에서 하트와 스파크가 동시에 터짐 (대결이지만 귀엽게 — 링·글러브 금지) | Two cute chibi 3D crane birds facing each other wings touching playfully, tiny hearts and sparks bursting between them, dark charcoal stage, violet accent glow, warm amber rim light |
| today | `#0EA5E9` | 새벽 창가에서 두루미가 오늘의 카드 한 장을 막 뒤집는 순간, 창밖은 해 뜨는 하늘 | A cute chibi 3D crane bird flipping over a single glowing card at a windowsill at dawn, sunrise sky through the window, dark interior, sky-blue accent glow, warm amber light |
| yearly | `#F59E0B` | 두루미가 사계절이 차례로 물든 열두 칸 징검다리 길을 걸어감 | A cute chibi 3D crane bird walking along a winding path of twelve stepping stones each tinted with a season, dark navy landscape, warm amber glow on the path ahead |
| 펫 | `#34D399` | 두루미와 강아지·고양이가 나란히 앉아 서로 기대고, 머리 위에 작은 별이 이어짐 (`lib/pet-compat-illustration.ts` 픽사 3D 다크톤·텍스트 금지 결 재사용) | A cute chibi 3D crane bird sitting side by side with a small puppy and kitten leaning on each other, a thin line of tiny stars connecting above their heads, dark charcoal backdrop, mint-green accent glow, warm amber rim light |

### 3-3. 생성 게이트 — 프로브 우선(한 방 생성 금지)

이미지 생성은 **유료 단계 → 운영자 승인 필수** (가드 9). **5종을 한 번에 뽑지 않는다** — 한 방 생성은 장마다 캐릭터 정체성·완성도가 흔들려 "그림이 판다" 명제를 무너뜨리는 최대 리스크.

- **T2a 스타일 프로브 (1장)**: 가장 대표적인 **사주** 1장만 먼저 생성. 필요하면 여러 시드/변주를 뽑아 **결을 락**한다. 합격 기준(§7 일러스트 수용 기준) 통과할 때까지 반복 — 프롬프트·시드·후처리를 `SERVICE_POSTER_STYLE.md`에 확정 기록. 이 1장이 **레퍼런스 앵커**가 됨.
- **T2b 나머지 4장**: 프로브가 운영자 검수를 통과한 뒤에만, **락된 결·캐릭터를 앵커로 참조**해 배틀·today·yearly·펫 생성. 5장을 나란히 놓고 캐릭터 동일성·조명·완성도 편차 검수 → 미달 장만 재생성.
- 각 장 Read 검수(캐릭터 일관성·글자/한자 혼입 0·무드·크롭 안전영역) → WebP 변환·배치. 원본 PNG는 저장소 밖(가드 8).

---

## 4. 두루미 브랜드 가드 (절대 규칙 10)

| # | 가드 | 이 계획에서의 적용 지점 |
|---|------|------------------------|
| 1 | 성인·자극·도발 이미지/카피 전면 금지 (타이트 29금 계열 어떤 변형도 X) | §3 프롬프트·§2 카피 전부 호기심/따뜻함 톤. 배틀도 "귀엽게 겨루기" |
| 2 | 공포·서열화 카피 금지 — "가능성+노력" 프레임, 등급은 재미로만 | ⑤ 사전 훅 라벨("도화살은 나쁜 걸까" = 반전형), ③ 설명문 |
| 3 | "무료" 오주장 금지 (가입보너스 2026-06-21 종료) — 칩·CTA·FAQ 전체. 단 매거진/사전 콘텐츠가 무료라는 사실 서술만 허용 | ④ 서브카피·⑦ FAQ 신규 항목·§6 전수 grep 게이트 |
| 4 | 시니어 가독성 (35–54세 여성): 큰글씨·고대비·단순·한번에 하나. 이미지 위 텍스트 = 스크림 + 대비 4.5:1 실측, 제목 ≥18px. 핵심 서비스 선택에 스와이프 강제 금지 | ③ 세로 스택 고정, Phase B 스크림 `black/85`(≈14:1), ④만 peek 레일 |
| 5 | 가짜 소셜프루프 금지 — 수치는 실데이터, 후기는 실후기만(없으면 섹션 없음) | ② AnalysisCounter(실측 API)·④ 조회수 뱃지(실측). **후기 섹션은 만들지 않음** |
| 6 | 두루미 도사화·신비주의 과장 금지, 한자 전면 노출 금지(UI·일러스트 공통) | §3 캐릭터 락(도사 복장 금지), ⑤ hanja 필드 미노출, 프롬프트 no-text |
| 7 | 공용 컴포넌트(`Header`,`SectionList`,`StoryCard`,`OverallGradeBadgeSlot` 등) 수정 최소화 — 신규 컴포넌트 추가 위주. yearly 피처플래그·펫 런칭할인 로직 보존 | §2 전 섹션 `components/hub/*` 신규, `StoryCard`/`AnalysisCounter` 무수정 재사용 |
| 8 | Vercel serverless 250MB 재발 주의 — WebP만 배포, `next.config` `outputFileTracingExcludes` 확인, 원본 PNG 방치 금지 | §3-1 저장 경로 규칙, T2 완료 조건에 포함 |
| 9 | 생성(유료) 단계는 운영자 승인 게이트 — 프롬프트 초안까지가 계획 범위 | §3-3, T2 게이트 |
| 10 | main → 새 브랜치(`feat/unified-hub`), 태스크별 커밋 분리. main 머지/배포는 운영자 명시 허용 후 | §5 태스크 표 |

---

## 5. 태스크 분해 · 순서 · 의존성 · 게이트

| ID | 태스크 | 산출물/파일 | 의존 | 비용 | 게이트 |
|----|--------|------------|------|------|--------|
| **T1** | 포스터 스타일 락 문서 + 프롬프트 5종 확정 | `docs/SERVICE_POSTER_STYLE.md` (§3 내용) | — | 무료 (코드 0, **첫 착수**) | 운영자 문서 리뷰 |
| **T2a** | 스타일 프로브 1장(사주) 생성 → 결 락 | `service-saju.webp` + `SERVICE_POSTER_STYLE.md`에 시드/프롬프트 확정 | T1 | **유료 — 승인 게이트** | §7 일러스트 수용 기준 통과 + 운영자 OK (레퍼런스 앵커 확정) |
| **T2b** | 나머지 4장 생성(앵커 참조) → 5장 편차 검수 → WebP 배치 | `public/images/hub/service-*.webp` (총 5장, 각 ≤150KB) | T2a | **유료** | 5장 나란히 캐릭터 동일성·완성도 편차 검수, 미달 장 재생성 |
| **T3a** | 라우트 통합 골격: `app/page.tsx` 서버화 + `app/HubClient.tsx` 분리, `/menu` redirect, `app/menu/page.tsx` 삭제, returnTo/콜백 기본값 `/` | `app/page.tsx`, `app/HubClient.tsx`, `next.config.mjs`, `middleware.ts`(matcher 정리), `components/LoginForm.tsx`, `lib/auth.ts` 확인 | — (T1과 병행 가능) | 무료 | `/menu` 307 확인 + returnTo E2E |
| **T3b** | `"/menu"` 리터럴 전수 치환 (20개 파일) → `"/"` | `grep -rln '"/menu"'` 결과 전체 | T3a | 무료 | grep 0건 |
| **T4a** | 서비스 카드 이식 (Phase A 골격): menu 로직 → `ServiceCard`/`ServiceCardList`, SVG 임시 유지 | `components/hub/ServiceCard.tsx`, `ServiceCardList.tsx` | T3a | 무료 | 5카드 클릭 동선 전수 수동 테스트 (yearly 플래그 on/off 양쪽) |
| **T4b** | SVG → 일러스트 썸네일 스왑 | T4a 파일 + T2b 이미지 5장 | T2b, T4a | 무료 | 375px 스크린샷 검수 |
| **T5** | 매거진 peek 레일 | `components/hub/StoryRail.tsx`, `HubStoryCard.tsx` | T3a | 무료 | 스냅 동작 + 조회수 뱃지 표시 확인 |
| **T6** | 사전 개념 그리드 | `components/hub/DictConceptGrid.tsx` | T3a | 무료 | 8링크 전부 200 + 초기 HTML에 `<a>` 포함 확인(`curl \| grep`) |
| **T7** | 히어로 auth 축약 + Counter 이동 + 미리보기 강등 + FAQ 교체 + 스티키 CTA 분기 | `app/HubClient.tsx` 내 섹션들, `components/hub/FeatureCard.tsx`(이관) | T3a, T4a | 무료 | 로그인/로그아웃 두 상태 스크린샷 페어 |
| **T8** | Phase B full-bleed 포스터 실험 (사주 카드 1장) | `ServiceCard` variant | T2b, T4b | 무료 | **별도 승인** — A/B 스크린샷 비교 후 운영자 판단 |
| **T9** | 최종 검증 일괄 (§6 전체) + §7 벤치마크 QA 게이트 + PR | — | T3~T7 (T8 선택) | 무료 | §6·§7 체크리스트 전항 통과 → **머지/배포는 운영자 승인** |

권장 착수 순서: **T1 → (T3a ∥ T1 리뷰) → T3b → T4a → T5 → T6 → T7 → [T2a 프로브 승인 → T2b] → T4b → T9(§7 벤치마크 게이트 포함) → (T8 선택)**. T2가 늦어져도 T4a까지의 허브는 SVG로 완결 동작 — 일러스트는 논블로킹. **단 최종 머지 전 §7 디자인 크래프트·벤치마크 게이트를 반드시 통과.**

---

## 6. 검증 계획

| # | 항목 | 방법 (구체) |
|---|------|------------|
| V1 | 로컬 구동 | `PORT=3005 npm run dev`. **dev 서버 구동 중 `next build` 절대 금지** (.next 청크 충돌 — 기존 사고 이력) |
| V2 | 뷰포트 스크린샷 페어 | 375px·640px × 로그인·로그아웃 = 4장 세트를 **전(현행 랜딩+메뉴)/후(허브)** 로 페어 촬영, 데스크톱에 복사 + 폴더 열어 운영자 검수 |
| V3 | 포스터 텍스트 대비 실측 | Phase B 스크림 위 텍스트: 스크린샷에서 텍스트 배경 픽셀 샘플 → WCAG 대비 계산 ≥4.5:1. 설계값(black/85 위 white ≈14:1) 대비 실측이 4.5 미만이면 스크림 농도 상향 |
| V4 | 라우팅 | `/menu` → `/` 307 확인(`curl -I`), returnTo E2E: 로그아웃 상태 `/coins` 접근 → `/?returnTo=/coins` → 로그인 → `/coins` 복귀 |
| V5 | 서비스 동선 전수 | 5카드 × (로그인/로그아웃) 클릭 목적지 표대로 확인. 사주 카드 결과有/無 분기, yearly 플래그 off 시 미렌더, 펫 할인가 취소선 표기 |
| V6 | "무료" 전수 검수 | `grep -rn "무료" app/page.tsx app/HubClient.tsx components/hub/` → 히트는 매거진/사전 콘텐츠 사실 서술만 허용, 그 외 0건 |
| V7 | SEO 내부링크 | `curl -s localhost:3005 \| grep -o 'href="/dict[^"]*"'` = 8건 + `/stories` 링크가 초기 HTML에 존재 |
| V8 | 빌드 | dev 서버 내린 뒤 `npx next build` 성공. 번들에 stories 본문이 홈에 딸려가지 않는지(`getAllStories`는 목록 필드만 사용) First Load JS 전후 비교 |
| V9 | 이미지 위생 | `public/images/hub/` WebP만 존재·장당 ≤150KB, 원본 PNG 저장소 미포함(`git status` 확인), `next.config` `outputFileTracingExcludes` 현행 유지 확인 |
| V10 | 접근성/모션 | 아코디언 `aria-expanded`, 레일 키보드 스크롤, `prefers-reduced-motion` 시 카운트업·페이드인 즉시 완료(기존 훅 동작 승계 확인) |

---

## 7. 디자인 크래프트 품질 기준 — 타이트사주 수준 확보

> **전제:** 레이아웃 구조가 타이트급인 것과, **완성도가 타이트급인 것은 다르다.** 타이트의 프리미엄감은 정지 화면이 아니라 ① 일러스트 마감 ② 모션·마이크로인터랙션 ③ 깊이·여백·타이포 리듬에서 나온다. 아래는 "예쁘게 되겠지"를 금지하고 **항목별 수용 기준(pass/fail)** 으로 강제하는 게이트. T9에서 전항 통과 못 하면 머지 반려.

### 7-1. 일러스트 수용 기준 (T2a 프로브가 반드시 통과) — "그림이 판다"의 사활

| # | 기준 | 불합격 예 |
|---|------|----------|
| I1 | **캐릭터 정체성 단일** — 5장의 두루미가 같은 개체(부리 각도·crown·비율·눈)로 보임 | 장마다 다른 새처럼 보임, 종이 바뀜 |
| I2 | **해부학·손발·깃털 정합** — 다리·날개·발가락 개수·관절 자연스러움 | AI 특유의 뭉개진 발, 여분 다리, 녹은 깃털 |
| I3 | **글자·한자·숫자 0** — 이미지 내 텍스트 아티팩트 전무 (가드 6) | 두루마리·카드에 가짜 글자 렌더 |
| I4 | **조명 일관성** — 5장 모두 단일 웜 광원 + rim light, 하단 45% 자연스럽게 어두워짐(스크림 합성용) | 장마다 광원 방향·색온도 제각각 |
| I5 | **크롭 안전영역** — 4:5 원본을 16:10·4:5 어디로 잘라도 캐릭터·초점 안 잘림 | 머리가 프레임 위로 잘림, 여백 편중 |
| I6 | **프린트 클린 엣지** — 배경 분리 깔끔, 홀로 뜬 노이즈·유령 픽셀 없음 | 캐릭터 외곽 halo, 배경 얼룩 |
| I7 | **언캐니 없음** — 귀엽고 따뜻함, 무섭거나 점집스럽지 않음(가드 1·6) | 과한 사실감으로 섬뜩, 신비주의 과장 |

> 판정: 프로브 1장이 I1~I7 **전부** 통과할 때까지 T2a에서 반복(시드/프롬프트/후처리). 통과분을 앵커로 고정한 뒤에만 T2b. 이게 한 방 생성 편차 리스크를 없애는 핵심.

### 7-2. 모션·마이크로인터랙션 스펙 (와이어프레임 티 제거)

정지 스크린샷만 예쁜 건 불합격. 아래를 **표준 토큰으로 통일**해 전 인터랙션에 적용:

| 요소 | 스펙 |
|------|------|
| 이징 표준 | 스프링감 `cubic-bezier(0.34, 1.56, 0.64, 1)` (기존 menu 카드 관례 승계) — 전 카드/버튼 공용 |
| 섹션 등장 | `useScrollReveal` fade + `translateY(20px→0)`, **섹션 내 카드는 60ms 스태거**(기존 menu slideUp 스태거 계승, 허브 전 섹션에 확장) |
| 카드 프레스 | Phase A `active:scale-[0.97]` + bg 딥컷 / Phase B 포스터 `active:scale-[0.985]` + `shadow` 살짝 낮아짐(눌리는 깊이감) |
| 포스터 hover(데스크톱) | 일러스트만 `scale-[1.04]` 슬로우 줌(카드는 고정), `overflow-hidden`으로 프레임 안에서. 모바일 무해 |
| 캐러셀 스냅 | `snap-mandatory` 관성 스크롤 + 스냅 정착, 다음 카드 ~40px peek로 스와이프 어포던스 |
| **감속 존중** | `prefers-reduced-motion` 시 카운트업·페이드·줌 **즉시 완료**(시니어·접근성) — 전 모션에 가드 |

### 7-3. 깊이·여백·타이포 리듬 (정지 상태 크래프트)

| 축 | 합격 기준 |
|----|----------|
| **깊이(depth)** | 평평한 카드 금지. 포스터형은 `shadow-[0_8px_32px_rgba(0,0,0,0.4)]` + 상단 `inset 0 1px 0 rgba(255,255,255,0.06)` 하이라이트로 떠 있는 느낌. glow는 blur-60 유지하되 카드 뒤에서만(번짐 관리) |
| **여백 리듬** | 섹션 간 `space-y-16` 고정, 섹션 내부 간격은 8px 그리드 배수만(4/8/12/16/24). 들쭉날쭉 금지 — 스크린샷에 자 대고 리듬 확인 |
| **타이포 위계** | 섹션 헤딩 = `font-aggro` 통일(크기 22~24px), 본문 Pretendard, 3단 이상 위계 금지(헤딩/본문/캡션). `break-keep`·`line-clamp` 전 카드 적용해 어절 깨짐·넘침 0 |
| **톤 일관성** | 서비스 틴트 5색은 **glow·칩에만**, 카드 표면·텍스트는 중립 다크 유지(색 남발 금지). 한 화면에 강조색 2개 초과 금지 |
| **정렬·광학** | 아이콘·칩·텍스트 baseline 광학 정렬, 카드 라운드 반경 통일(`rounded-2xl` 카드 / `rounded-3xl` 포스터), 이미지 라운드는 카드보다 한 단계 작게(중첩 라운드 규칙) |

### 7-4. 상태(states) 마감 — 빈 화면·로딩 방치 금지

| 상태 | 처리 |
|------|------|
| 매거진 레일 로딩 | 서버 주입이라 기본 즉시 렌더. 이미지만 `next/image` blur placeholder + 스켈레톤 카드 3장 폴백 |
| AnalysisCounter 로딩 | 숫자 카운트업 전 레이아웃 점프 금지(고정 폭 자리 확보) |
| 사주 카드 결과 확인 중 | `checking` 시 라벨만 "내 사주 내역 확인 중…"(현행), 스피너 남발·깜빡임 금지 |
| 이미지 로드 실패 | 포스터 일러스트 로드 실패 시 서비스 틴트 그라디언트 + 서비스명 폴백(깨진 이미지 아이콘 노출 금지) |
| yearly 플래그 off | 카드 미렌더 시 레일 간격·스태거 인덱스 재계산(빈 슬롯·간격 붕괴 금지) |

### 7-5. 벤치마크 대조 QA 게이트 (T9, 머지 전 필수)

"잘 나왔겠지" 금지. **나란히 붙여 채점:**

1. 375px에서 타이트사주(sajutight.me) 대응 구간(카드 그리드·포스터·캐러셀·헤딩) 스크린샷 확보 + 우리 허브 동일 구간 스크린샷.
2. 아래 6축을 **각 1~5점** 독립 채점(크래프트 관점, 카피 아님):

| 축 | 무엇을 봄 |
|----|----------|
| 일러스트 마감 | §7-1 기준 실물 체감 |
| 시각 위계 | 눈이 CTA·핵심으로 자연 이동하는가 |
| 여백·정렬 리듬 | 8px 그리드·광학 정렬 |
| 깊이·질감 | 떠 있는 느낌 vs 평평 |
| 모션(영상/GIF로) | 스프링·스태거·프레스가 살아있는가 |
| 톤 일관성 | 5서비스가 한 브랜드로 보이는가 |

3. **어느 축이든 타이트 대비 명백히 낮으면(체감 2점 이상 격차) 반려·반복.** 목표는 "동급 이상". 단 브랜드 방향(귀여움·따뜻함·시니어)은 타이트의 자극 톤을 **의도적으로 벗어남** — 크래프트 완성도는 동급, 톤은 우리 것.
4. 최종 산출물은 데스크톱에 전/후 + 벤치마크 대조 스크린샷 세트로 운영자 보고([[feedback_show_results_desktop]] 관례).

---

## 8. 비범위 (이번에 하지 않는 것)

- 백엔드·API 변경 일체 (`/api/stats/analyses`, `/api/results` 등 현행 그대로 소비만)
- 점수·등급·분석 프롬프트, 사주 파이프라인 (`SCORING_VERSION` 불변)
- 펫 결과화면 (`PetResultClient` — 이미 완성, 참조만)
- 결제·코인 플로우, `/checkout`
- 매거진 hero 일러스트 결(`HERO_ILLUSTRATION_STYLE.md`) 변경 — 캐릭터만 공유
- 후기 수집 백엔드 (실후기 없으므로 후기 섹션 자체를 만들지 않음 — 가드 5)
- `/stories`·`/dict` 페이지 자체의 리디자인 (허브에서 링크만)
- 공용 컴포넌트(`Header`, `StoryCard`, `AnalysisCounter`, `SectionList` 등) 내부 수정
