# 두루미 통합 허브 — 목업 → 실코드 정밀 구현 계획

- 작성일: 2026-07-17
- 대상: `/`(홈 통합 허브 교체) + `/menu`(세로 리스트 리디자인)
- 디자인 정본: `docs/mockups/unified-hub-v2.html`(홈) · `docs/mockups/menu.html`(메뉴) · `docs/mockups/HUB_STYLE.md`(규칙)
- 자산: `docs/mockups/assets/{saju-grade,battle,yearly,pet,today}.png` — 1024×1536(2:3), 제목 baked, 장당 2.2~2.5MB
- 선행 계획: `2026-07-17-durumi-unified-hub.md`의 "/menu → / 리다이렉트 + 리터럴 치환" 방안은 **폐기**. 본 문서가 정본.

## 0. 절대 원칙

1. **목업 픽셀 유지** — 아래 §3~§5의 클래스 표는 목업 HTML에서 그대로 추출한 값. 임의 변형 금지.
2. **사이드이펙트 0** — `/menu` 라우트 유지(리다이렉트 없음), 공용 컴포넌트 무수정, 피처플래그·할인·인증·returnTo 흐름 보존. §9의 "건드리지 않는 것" 목록 준수.
3. 색은 전부 DS 토큰(`tailwind.config.ts` ↔ `app/globals.css` CSS 변수), hex 하드코딩 금지. 아이콘은 `@phosphor-icons/react`만(서버 컴포넌트에서는 `@phosphor-icons/react/dist/ssr` — `components/stories/StoryCard.tsx` 선례). 이모지 금지.

### 목업 토큰 ↔ 실코드 토큰 매핑 (검증 완료)

목업의 tailwind.config 인라인 토큰은 실제 프로젝트 토큰과 1:1 일치한다. 즉 **목업 클래스명을 거의 그대로 복사**하면 된다.

| 목업 클래스 | 실코드 | 근거 |
|---|---|---|
| `bg-background-primary` 등 | 동일 | `tailwind.config.ts` colors.background.* → `--bg-*` (globals.css `9 9 11`/`20 20 20`/`39 39 42`) |
| `text-text-primary/secondary/tertiary` | 동일 | `--text-*` = `255 255 255`/`161 161 170`/`140 140 150` |
| `bg-primary`, `bg-primary-kakao` | 동일 | `--c-brand 244 63 94`, `--c-kakao 254 229 0` |
| `bg-saju-wood` (NEW 뱃지) | 동일 | `--c-saju-wood 34 197 94` |
| `.font-aggro` | 동일 | globals.css `.font-aggro` 기존 정의 |
| `.no-scrollbar` | **기존 `.scrollbar-hide`** 사용 | globals.css에 이미 있음 — 신규 클래스 추가 금지 |
| `.reveal`/`.in` | 신규 `<Reveal>` 클라 컴포넌트 (inline style) | globals.css 수정 없이 현행 `useScrollReveal` 패턴 이식 |
| `.press` | Tailwind 인라인: `transition-[transform,background-color] duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-[0.97]` | globals.css 수정 없음 |
| `.depth` | `shadow-[0_8px_30px_rgba(0,0,0,0.42)]` | 그림자는 색토큰 아님 — arbitrary 허용 |
| `.glassbar` | 미사용 (목업 헤더는 불투명 `bg-background-primary`) | — |

---

## 1. 아키텍처 개요

```
app/page.tsx            ← 서버 컴포넌트 셸로 전환 (기존 "use client" 랜딩 전면 교체)
  ├─ Header (공용, 무수정 재사용)                               [client]
  ├─ (결정 대기) ShareRewardBanner                              [server]
  ├─ HubHeroCarousel      slides=HUB_HERO_SLIDES                [client]
  ├─ ServiceRail          services=구성함수(코드 상수)           [client]
  ├─ CelebrityRail        stories=서버에서 getStoryBySlug 주입   [server]
  ├─ DictList             items=HUB_DICT_ITEMS (<Link> SSR=SEO) [server]
  ├─ MagazineList         stories=getAllStories().slice(0,3)    [server] (+HubViewBadge client)
  ├─ HubFaq               native <details>/<summary>            [server, JS 0]
  ├─ BusinessFooter (공용, 무수정 — 통신판매업 표기 법적 필수)     [server]
  └─ <Suspense> HubStickyCta (useSearchParams returnTo)         [client]

app/menu/page.tsx       ← 파일 유지, 비주얼만 menu.html로 교체. 로직 전량 보존.
components/hub/*        ← 신규 컴포넌트 전부 여기에만. 공용 컴포넌트 0 수정.
```

- 서버 셸 전환 이유: dict/매거진 `<Link>`를 서버 렌더해 SEO 확보. `lib/stories/registry.ts`·`lib/dict/registry.ts`는 순수 TS 데이터라 서버 import 안전.
- **주의: `lib/stories/hero-image-size.ts`(fs 읽기, 250MB 사고 원인)는 절대 import 금지.** 허브는 이미지 src 문자열만 사용 → 서버리스 함수에 public이 딸려가지 않음. `next.config.js`의 `outputFileTracingExcludes: { "*": ["public/stories/**"] }` 는 현행 유지·확인만.
- 컨테이너: 목업 그대로 `mx-auto w-full max-w-[440px] min-h-screen bg-background-primary relative overflow-hidden` + 상단 glow `pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-[320px] w-[320px] rounded-full blur-[100px] bg-primary/[0.14]`. `<main className="pb-[120px]">`.
- 기존 랜딩의 `FeatureCard`·`ImagePlaceholder`·`FAQ_ITEMS`·`FaqAccordion`은 app/page.tsx 안의 로컬 코드 → 함께 제거(외부 참조 없음, 회귀 0). `public/images/landing/*`은 일단 존치(검증 후 별도 정리).

---

## 2. 이미지 자산 파이프라인 (T1)

| 항목 | 내용 |
|---|---|
| 원본 | `docs/mockups/assets/*.png` 5장(1024×1536). **repo 내 이 위치에 그대로 보관**(배포 산출물 아님) — public에는 넣지 않는다 |
| 변환 | `scripts/convert-hub-images.mts` (신규, `sharp` devDependency 추가) — 1024×1536 유지, WebP q80 |
| 산출 | `public/images/hub/{saju,battle,yearly,pet,today}.webp` — **목표 장당 ≤200KB, 5장 합계 ≤1MB** (미달 시 q75로 재시도) |
| 사용 | 전부 `next/image`. `formats: ["image/avif","image/webp"]` 이미 설정돼 있어 추가 최적화 자동 |
| 250MB 가드 | ① fs 읽기 유틸 import 금지(위 §1) ② 빌드 후 `.next/server` 트레이스에 public 미포함 확인 ③ `outputFileTracingExcludes` 현행 유지 |
| sizes 속성 | 히어로 `(max-width: 440px) 86vw, 378px` · 서비스 카드 `150px` · 메뉴 썸네일 `92px` · 연예인 `130px` · 리스트 `84px` |

### 2-1. 서비스 카드 썸네일 "제목 중복" 해결 (결정 필요 — 열린 질문 A)

포스터는 제목 baked. 히어로(2:3)는 그대로 쓰지만, 서비스 카드는 코드 텍스트 제목이 별도로 있어 4:5 크롭 시 baked 제목이 겹쳐 보인다(목업에서 확인).

기하 계산: 2:3 이미지(세로비 1.5)를 4:5 컨테이너(1.25)에 `object-cover` → 세로 방향 **16.7%만 크롭 가능**. 1:1 컨테이너면 33.3% 크롭 가능.

| 안 | 방법 | 장점 | 단점 |
|---|---|---|---|
| (a) 크롭 | 목업의 `object-cover object-[center_80%]`를 `object-bottom` 쪽으로 강화해 상단 제목대 최대 제거 | 무료·즉시, 목업 비율(4:5) 유지 | 제목이 상단 ~20%+ 차지하면 **완전 제거 불가**(잔여 노출). 1:1로 바꾸면 완전 제거되지만 목업 비율 위반 |
| (b) 별도 버전 | 서비스용 **제목 없는 포스터 5장** 추가 생성 (기존 프롬프트에서 텍스트 제거 재생성) | 완전 해결, 목업 4:5 그대로 | **유료** — `feedback_generation_approval`에 따라 운영자 승인 게이트 필요 |

**권고: (b).** 목업 픽셀 원칙과 충돌 없는 유일안. 승인 전 임시로 (a)의 object-bottom 크롭으로 진행하고(T4·T8), 승인 후 T10에서 `public/images/hub/*-notitle.webp` 로 교체(코드는 config의 `cardSrc` 필드만 바꾸면 됨).

---

## 3. 홈 허브 — 섹션별 구현 스펙 (목업 클래스 그대로)

### 3-0. Header

공용 `components/layout/Header.tsx` **무수정 재사용** (기본형: 가운데 "사주보는 두루미" font-aggro + 로그인 시 Egg 알잔액 `/coins` 링크 + 비로그인 시 로그인 pill + `MenuDrawer` 햄버거). 목업 헤더는 Header.tsx의 형태를 그대로 그린 것이므로 추가 작업 없음. sticky는 `<div className="sticky top-0 z-[100]">` 래핑 대신 `<Header sticky />` prop 사용 (`defaultCls`에 sticky 지원 내장).

### 3-1. ① 히어로 캐러셀 — `components/hub/HubHeroCarousel.tsx` [client]

| 요소 | 클래스/스펙 (목업 L72~110) |
|---|---|
| 섹션 | `<section className="pt-4">` |
| 헤딩 행 | `mb-3 flex items-end justify-between px-5` — eyebrow `text-[12px] font-medium text-text-tertiary` "요즘 다들 보는" / 제목 `font-aggro text-[22px]` "이번 주 인기 사주" / 우측 `text-[13px] text-text-secondary shrink-0 pb-1` "전체 보기 →" (`<Link href="/menu">`) — `<Reveal>` 래핑 |
| 트랙 | `scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2` + `style={{ scrollPaddingLeft: 20 }}` + 끝에 `<div className="w-1 shrink-0" />` |
| 슬라이드 | `relative snap-start w-[86%] shrink-0 overflow-hidden rounded-3xl bg-background-secondary` + `style={{ aspectRatio: "2/3" }}` — `<button>`으로 감싸 탭 시 해당 서비스 액션(§3-2 useServiceActions 공유) |
| 이미지 | `next/image fill` `className="object-cover"` — 1번 슬라이드만 `priority` |
| 카운터 뱃지 | `absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white/80` — `{i+1} / {total}` |
| 도트 | `flex justify-center gap-1.5 pt-1` — 활성 `h-1.5 w-5 rounded-full bg-primary` / 비활성 `h-1.5 w-1.5 rounded-full bg-white/25` (전환 `transition-all`) |
| 활성 인덱스 | 트랙 `onScroll`(rAF 스로틀)로 `Math.round(scrollLeft / slideStride)` 계산 → 도트 갱신. reduced-motion 시 smooth scroll 미사용 |

데이터: `components/hub/services.ts`의 `HUB_HERO_SLIDES` — `{ id, src: "/images/hub/xxx.webp", alt }` 5개 하드코딩(saju→battle→yearly→pet→today, 목업 순서). **yearly 슬라이드는 `NEXT_PUBLIC_FEATURE_YEARLY !== "1"`이면 제외**(카운터 `n / 4`로 자동 축소) — /menu와 동일 게이트.

### 3-2. ② 서비스 캐러셀 "두루미가 봐드릴게요" — `components/hub/ServiceRail.tsx` [client]

| 요소 | 클래스/스펙 (목업 L113~157) |
|---|---|
| 섹션 | `pt-10` / 헤딩 `mb-3 px-5` — eyebrow "알 하나면 충분해요", 제목 "두루미가 봐드릴게요" (`<Reveal>`) |
| 카드 | `<button className="press… snap-start w-[150px] shrink-0 text-left">` (press=§0 인라인 유틸) |
| 썸네일 | `relative mb-2 w-full overflow-hidden rounded-2xl bg-background-secondary` + `style={{ aspectRatio: "4/5" }}` — `next/image fill object-cover` + 크롭 클래스(§2-1 결정: 임시 `object-bottom`) |
| NEW 뱃지(펫) | `absolute right-2 top-2 rounded-md bg-saju-wood px-1.5 py-0.5 text-[10px] font-bold text-background-primary` |
| chip | `text-[11px] font-semibold text-text-secondary` |
| 제목 | `text-[16px] font-bold leading-tight` |
| 설명 | `mt-1 text-[12px] text-text-tertiary leading-snug line-clamp-1 break-keep` |
| 가격 | `mt-1 flex items-center gap-1 text-[14px] font-bold` + `<Egg size={14} weight="fill" />` — **색 없음** |
| 펫 할인 | `<span className="text-text-tertiary line-through text-[12px] font-semibold">{PET_COMPAT_COST}</span> {PET_COMPAT_LAUNCH_COST}알` |

**데이터 = 코드 상수가 정답. 목업의 가격 숫자(15알·15→8알)는 더미이며 실값으로 렌더:**

| id | chip | 제목 | 설명(목업 카피) | 가격(상수) | 액션 |
|---|---|---|---|---|---|
| saju | "평생 사주" | 내 사주 분석 | 타고난 기질과 운의 흐름 | `SAJU_COST`(10)알 | handleSajuClick 로직(아래) |
| pet | "반려동물 궁합"+NEW | 우리 아이와 궁합 | 우리 아인 날 어떻게 볼까 | `PET_COMPAT_COST`(20) 취소선 → `PET_COMPAT_LAUNCH_COST`(10)알 | `resetPet()` → `/pet/input` |
| today | 오늘 날짜 "M월 D일" | 오늘의 운세 | 오늘 나에게 딱 맞는 하루 | `TODAY_COST`(5)알 | `/today` |
| battle | "둘이서" | 사주 배틀 | 누가 더 셀까, 사주 맞대결 | `BATTLE_COST`(20)알 | `resetBattle()` → `/battle/input` |
| yearly | `${CURRENT_YEAR}년` | 올해 운세 | 올해 나에게 무슨 일이 | `YEARLY_COST`(10)알 | `/yearly` — `YEARLY_ENABLED` 시에만 렌더 |

- import 원천: `@/lib/constants/coins`(SAJU/BATTLE/YEARLY/TODAY/PET_COMPAT/PET_COMPAT_LAUNCH_COST), `@/store/useBattleStore`·`@/store/usePetCompatStore`의 `reset`, `resolveSolarYear`(`@/lib/utils/ipchun`) — 전부 `app/menu/page.tsx` 현행 로직 이식.
- 날짜/연도 라벨은 hydration mismatch(서버 UTC vs 클라 KST) 방지 위해 `useState+useEffect`로 클라 계산(초기값 공백) — menu의 모듈 스코프 방식 개선판, 허브 로컬에만 적용.
- **`components/hub/useServiceActions.ts`** (신규 훅, 허브·신메뉴 공용): `useSession`·`useRouter`·두 store reset·`checking/checkError` 상태 + `run(serviceId)` 반환. saju 분기는 menu의 `handleSajuClick` 그대로: 로그인 상태에서 `GET /api/results` → 결과 있으면 `/my/results`, 없으면 `/start`, 실패 시 checkError.
- **auth-adaptive(허브 전용)**: 비로그인 상태에서 서비스(카드·히어로) 탭 → `router.push("/login?callbackUrl=" + encodeURIComponent(대상경로))` (`/login`이 `callbackUrl` 파라미터 지원, 기본 `/menu`). `/menu` 페이지는 **기존 게스트 동작 유지**(saju→`/start` 등) — 열린 질문 C 참조.

### 3-3. ③ 연예인 사주 — `components/hub/CelebrityRail.tsx` [server]

| 요소 | 클래스/스펙 (목업 L159~196) |
|---|---|
| 섹션 | `pt-10` / 헤딩 행 = 히어로와 동일 패턴 — eyebrow "이 사람은 어떤 사주일까?", 제목 "연예인 사주", "전체 보기 →" → `<Link href="/stories/tag/연예인">` (`app/stories/tag/[tag]` 존재 확인) |
| 카드 | `<Link className="press snap-start w-[130px] shrink-0 text-left">` → `/stories/{slug}` |
| 이미지 | `w-full overflow-hidden rounded-2xl` + `style={{ aspectRatio: "3/4" }}` — `next/image fill object-cover` |
| 이름 | `mt-2 text-[15px] font-bold leading-tight` |
| 직업 | `mt-0.5 text-[12px] text-text-tertiary` — `story.celebrity.occupation` |

데이터: `HUB_CELEBRITY_SLUGS = ["imyoungwoong","sontaejin","anseonghun","jungdongwon","leechanwon"]`(목업 순서, `lib/stories/tags.ts` STORY_TAGS·registry 실존 확인) → 서버에서 `getStoryBySlug()` 매핑, 이름·직업은 `story.celebrity.name/occupation`, 이미지는 `story.heroImage.src`(= `/stories/heroes/{slug}.png` 수채화 초상, `feedback_celebrity_hero_face` 준수).

**주의(열린 질문 B)**: 기존 수채화 hero는 3:4가 아님 — 임영웅 1248×832(가로형), 손태진 1088×960. 3:4 `object-cover` 크롭 시 얼굴 잘림 가능. 1차는 크롭으로 구현 후 390px 스크린샷으로 5장 전수 검수, 잘림 심하면 (유료) 3:4 초상 재생성 승인 요청.

### 3-4. ④ 사주 사전 — `components/hub/DictList.tsx` + `DictThumb.tsx` [server]

| 요소 | 클래스/스펙 (목업 L198~221) |
|---|---|
| 섹션 | `<section className="px-5 pt-10">`(`<Reveal>`) — eyebrow "이 말, 무슨 뜻일까?", 제목 `font-aggro text-[22px] mb-2` "알아두면 재밌는 사주 사전" |
| 리스트 컨테이너 | `-mx-1` |
| 행 | `<Link className="press flex items-center gap-3.5 rounded-2xl px-1 py-2.5">` → `/dict/{category}/{slug}` |
| 썸네일 | `h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl` — 1:1 |
| 제목 | `text-[16px] font-bold leading-[1.35] break-keep` |
| 메타 | `mt-0.5 text-[12.5px] text-text-tertiary` — `DICT_CATEGORY_LABEL[category]` |
| 하단 버튼 | `mt-3 w-full rounded-2xl bg-white/[0.04] py-3 text-[14px] text-text-secondary` "사전 전체 보기 →" → `<Link href="/dict">` |

데이터: `HUB_DICT_ITEMS` (config, 실측 슬러그 8개 — registry 존재 확인 완료). 목업 4행의 편집 제목 + SEO 보강 4행. 행 디자인이 동일 반복이라 8행도 픽셀 원칙과 충돌 없음(세로만 증가):

| 편집 제목(카드 노출) | category/slug | 메타 라벨 |
|---|---|---|
| 내 사주는 몇 등급일까 | `saju/grade` | 사주 입문 |
| 좋은 일주는 따로 있을까 | `gabja/ilju-grade` | 60갑자 |
| 천을귀인, 최고의 길신 | `sinsal/cheonyl-gwiin` | 신살 |
| 일간 — 사주의 중심 '나' | `saju/ilgan` | 사주 입문 |
| 도화살, 매력의 별 | `sinsal/dohwa` | 신살 |
| 역마살, 떠나는 기운 | `sinsal/yeokma` | 신살 |
| 오행 — 다섯 기운의 균형 | `ohaeng/intro` | 오행 |
| 십성 — 내 사주의 열 가지 별 | `sipsung/intro` | 십성 |

썸네일: 사전은 이미지 자산이 없다(HUB_STYLE §7 "운영자 제공" 대기). **`DictThumb.tsx`** — 자산 도착 전 임시로 `bg-white/[0.04] rounded-2xl` 타일에 entry 대표 글자(`name` 1글자 또는 `hanja`)를 `font-aggro text-[28px] text-text-secondary`로 렌더(무료·즉시·DS 토큰만). config에 `thumbSrc?` 필드 두고 `public/images/hub/dict/{slug}.webp` 존재 시 이미지로 자동 교체.

### 3-5. ⑤ 두루미 매거진 — `components/hub/MagazineList.tsx` [server] + `HubViewBadge.tsx` [client]

| 요소 | 클래스/스펙 (목업 L223~251) |
|---|---|
| 섹션·행 | 사전과 **완전 동일 컴포넌트 구조**(HUB_STYLE §6) — eyebrow "로그인 없이 읽을 수 있어요", 제목 "두루미가 들려주는 사주 이야기" |
| 행 링크 | → `/stories/{slug}` — 제목은 `line-clamp-2` 추가 (목업 그대로) |
| 썸네일 | `h-[84px] w-[84px]` 1:1 — `story.heroImage` 있으면 `next/image fill object-cover`, 없으면 기존 공용 `StoryArt`(카테고리 파스텔 타일) 재사용 |
| 메타 | `mt-0.5 flex items-center gap-1 text-[12.5px] text-text-tertiary` — `{STORY_CATEGORY_HANDLE[category]} · {getReadingMinutes(story)}분 · <Fire/>{조회수}` |
| 하단 버튼 | 사전과 동일 스타일 "매거진 더 보기 →" → `<Link href="/stories">` |

- 데이터: `getAllStories().slice(0, 3)` 서버 주입 (목업 3행).
- 조회수: 공용 `StoryCardViewBadge`는 Eye 아이콘이라 HUB_STYLE(조회=Fire) 위반 → **수정 금지 원칙에 따라 신규 `components/hub/HubViewBadge.tsx`** 작성. `StoryCardViewBadge.tsx`의 fetch(`GET /api/stories/{slug}/view`)·`formatViewCount` 로직을 복제하고 아이콘만 `<Fire size={11} weight="fill" />`, 0/로딩 시 미렌더(구분점 `·`도 함께 숨김).

### 3-6. ⑥ FAQ — `components/hub/HubFaq.tsx` [server, JS 0]

목업 L253~286 그대로 — native `<details className="group overflow-hidden rounded-2xl bg-white/[0.04]">`(첫 항목만 `open`) / `<summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-[15px] font-semibold">` / 화살표 `<CaretDown size={18} className="shrink-0 text-text-tertiary transition group-open:rotate-180" />`(ssr import) / 본문 `px-5 pb-5 text-[14px] leading-relaxed text-text-secondary break-keep`. 컨테이너 `space-y-2`, 섹션 제목 `mb-4 text-center font-aggro text-[22px]` "자주 묻는 질문".

**FAQ 카피 7문항은 목업 텍스트 그대로 사용**(기존 랜딩 FAQ_ITEMS 5문항은 폐기). 카피 검수: "무료" 단어 없음 확인 완료(`feedback_no_free_claim` 통과 — "로그인 없이 읽을 수 있어요"는 허용 표현).

### 3-7. 하단 스티키 CTA — `components/hub/HubStickyCta.tsx` [client]

| 요소 | 클래스/스펙 (목업 L289~296) |
|---|---|
| 컨테이너 | `fixed inset-x-0 bottom-0 z-[120] mx-auto max-w-[440px] px-5 pb-6 pt-6` + `style={{ background: "linear-gradient(0deg, rgb(9 9 11) 0%, rgb(9 9 11) 62%, transparent 100%)" }}` — 그라디언트 값은 `--bg-primary`와 동일한 9 9 11(토큰 미러, 주석 명기). safe-area: `pb-[calc(24px+env(safe-area-inset-bottom))]`로 보강 |
| 비로그인 | `press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-kakao py-4 text-[16px] font-bold text-black/85 shadow-[0_8px_30px_rgba(0,0,0,0.42)]` — 카카오 로고 svg(목업 path 그대로 인라인) + "카카오로 3초만에 시작하기" → `signIn("kakao", { callbackUrl })` (선례: `app/today/TodayEntryClient.tsx:139`) |
| 로그인 | `press w-full rounded-2xl bg-primary py-4 text-[16px] font-bold text-text-primary shadow-[…]` "내 결과 보기" → `router.push("/my/results")` |
| 카운터 | 버튼 위에 공용 `<AnalysisCounter />` 그대로 (기존 랜딩 기능 보존 — 목업엔 없지만 지시 "기존 그대로") |

**returnTo 검증 로직 보존** (현 `app/page.tsx:182-185` 그대로): `const returnTo = searchParams?.get("returnTo"); const callbackUrl = returnTo && returnTo.startsWith("/") ? returnTo : "/menu";` — 비로그인 카카오 CTA의 callbackUrl로 사용. `useSearchParams` 사용 → 이 컴포넌트만 `<Suspense fallback={null}>`로 감싼다(서버 셸 유지).

### 3-8. 모션/접근성 (전 섹션 공통)

- `components/hub/Reveal.tsx` [client]: 현 랜딩 `useScrollReveal`(threshold 0.15 → 목업 0.12로) 이식. inline style `opacity/transform translateY(22px)/transition .6s cubic-bezier(.22,1,.36,1)`. `window.matchMedia("(prefers-reduced-motion: reduce)")` 매치 시 즉시 표시(전환 없음) — globals.css의 전역 reduced-motion 규칙도 이중 안전망.
- press 스프링: §0 인라인 유틸. 캐러셀 snap: CSS scroll-snap만 사용(JS 스크롤 하이재킹 금지).
- aria: 캐러셀 트랙 `role="region" aria-label="인기 사주 콘텐츠"`, 도트는 `aria-hidden`(카운터 뱃지가 텍스트 제공), 서비스 버튼 aria-label=`"{제목} — {가격}알"`, 이미지 alt 전수, `<details>`는 네이티브 키보드 지원.

---

## 4. `/menu` 리디자인 (menu.html 그대로, 로직 전량 보존)

`app/menu/page.tsx` — **파일·라우트·리다이렉트 없음. 아래 "보존 항목"은 한 줄도 삭제 금지, 비주얼(JSX 마크업)만 교체.**

보존 항목 (현행 코드 그대로):
- `handleSajuClick` 전체(비로그인→`/start`, `GET /api/results` 분기 →`/my/results`|`/start`, `checking`/`checkError` 상태) + checkError 재시도 패널
- `YEARLY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1"` 게이트
- `TODAY_LABEL`·`CURRENT_YEAR`(=`resolveSolarYear(new Date()).solarYear`, 입춘 주석 유지)
- `resetBattle`/`resetPet` 후 push, `status === "loading"` 로딩 화면
- `<Header showBack sticky onBack={() => router.push("/")} />`, `<BusinessFooter />`
- 펫 취소선 할인 표기(`PET_COMPAT_COST` line-through + `PET_COMPAT_LAUNCH_COST`)

신규 비주얼 (menu.html L36~118):
- 컨테이너 `mx-auto w-full max-w-[440px]` + glow(`h-[300px] w-[300px] … bg-primary/[0.12]`), `<main className="px-5 pt-6 pb-12">`
- 인트로: eyebrow `text-[12px] font-medium text-text-tertiary` "알 하나면 충분해요" / `<h1 className="font-aggro text-[24px]">무엇을 볼까요?</h1>` (`mb-5`)
- 리스트: `divide-y divide-white/8`, 행 = `press flex w-full items-center gap-4 py-4 text-left`
  - 좌측: chip `text-[11px] font-semibold text-text-secondary`(+펫 NEW 뱃지 `rounded-md bg-saju-wood px-1.5 py-0.5 text-[10px] font-bold text-background-primary`) / 제목 `mt-0.5 text-[18px] font-bold leading-tight` / 설명 `mt-1 text-[13px] text-text-secondary leading-snug break-keep`(menu.html 카피 그대로) / 가격 `mt-2 flex items-center gap-1 text-[15px] font-bold` + `<Egg size={15} weight="fill" />` — **색 없음(구 무지개 색상 제거)**
  - 우측: 포스터 썸네일 `shrink-0 overflow-hidden rounded-xl` `style={{ width: 92, aspectRatio: "4/5" }}` — `/images/hub/*.webp` §2-1 크롭 정책 동일 적용
- 행 순서(menu.html): 사주 → 펫(NEW) → 오늘 → 배틀 → 올해(플래그 시). 제목/카피는 menu.html 그대로("내 사주 분석"·"우리 아이와 궁합"·"오늘의 운세"·"사주 배틀"·"올해 운세").
- 기존 SVG 일러스트·`animate-[slideUp…]`·`#141414` 하드코딩 카드 → 제거(신 톤). `slideUp` keyframe 자체는 tailwind.config에 존치(다른 화면 영향 0).
- 구현은 `components/hub/ServiceMenuList.tsx`로 행 UI를 빼고, page는 상태·핸들러 보유(로직 이동 없이 props로 전달)하거나 `useServiceActions` 훅 공유 — 단 saju 분기 동작이 현행과 바이트 단위 동일해야 함.

---

## 5. 신규 컴포넌트 목록 (전부 `components/hub/` — 공용 0 수정)

| 파일 | 종류 | props | 재사용 소스 |
|---|---|---|---|
| `services.ts` | config | — | coins 상수, `/images/hub/*` 경로, HUB_HERO_SLIDES·HUB_CELEBRITY_SLUGS·HUB_DICT_ITEMS |
| `useServiceActions.ts` | client hook | — | menu `handleSajuClick`·store reset 로직 이식 |
| `Reveal.tsx` | client | `{ children, className? }` | 현 랜딩 `useScrollReveal` |
| `HubSectionHeader.tsx` | server | `{ eyebrow, title, moreHref?, moreLabel? }` | — |
| `HubHeroCarousel.tsx` | client | `{ slides }` | — |
| `ServiceRail.tsx` | client | — (내부 config) | useServiceActions |
| `CelebrityRail.tsx` | server | `{ items: {slug,name,occupation,src,alt}[] }` | page에서 getStoryBySlug 주입 |
| `DictList.tsx` | server | `{ items }` | dict registry·DICT_CATEGORY_LABEL |
| `DictThumb.tsx` | server | `{ label, thumbSrc? }` | — |
| `MagazineList.tsx` | server | `{ stories: Story[] }` | getReadingMinutes, STORY_CATEGORY_HANDLE, StoryArt(재사용만) |
| `HubViewBadge.tsx` | client | `{ slug }` | StoryCardViewBadge 로직 복제 + Fire 아이콘 |
| `HubFaq.tsx` | server | — (카피 내장) | 목업 FAQ 7문항 |
| `HubStickyCta.tsx` | client | — | AnalysisCounter(재사용), signIn 선례 |
| `ServiceMenuList.tsx` | client | menu 핸들러/상태 | menu.html 마크업 |
| `app/HubClient.tsx` | (불요 시 생략) | — | 클라 로직이 위 컴포넌트로 전부 분산되므로 별도 HubClient 셸은 만들지 않는 것을 기본안으로 함. 만들 경우 Suspense 경계만 담당 |

**수정 금지(재사용만)**: `Header.tsx`, `MenuDrawer.tsx`, `AnalysisCounter.tsx`, `BusinessFooter.tsx`, `StoryCard.tsx`, `StoryCardViewBadge.tsx`, `StoryArt.tsx`, `ShareRewardBanner.tsx`, 모든 `lib/*`·`store/*`·`app/api/*`.

---

## 6. 데이터 와이어링 요약

| 섹션 | 소스 | 렌더 위치 |
|---|---|---|
| 히어로 5장 | `HUB_HERO_SLIDES` 정적 config | client (이미지 SSR됨) |
| 서비스 5종 | `lib/constants/coins` + 플래그 + 날짜 | client |
| 연예인 5명 | `HUB_CELEBRITY_SLUGS` → `getStoryBySlug` | **server** |
| 사전 8행 | `HUB_DICT_ITEMS` (registry 실측 슬러그) | **server `<Link>` (SEO)** |
| 매거진 3행 | `getAllStories().slice(0,3)` | **server** (+조회수만 client) |
| 알잔액 | 공용 Header(`useCoinStore`) 그대로 | client |
| 분석 카운터 | 공용 AnalysisCounter 그대로 | client |

---

## 7. 검증 계획 (T9)

1. `PORT=3005 npm run dev` — **dev 구동 중 `next build` 절대 금지**(`feedback_nextjs_build_dev_conflict`).
2. 스크린샷 매트릭스: 375px·390px × 로그인 전/후 × `/`·`/menu` = 8장 → 목업 스크린샷과 섹션 단위 픽셀 대조(간격 px-5/pt-10, 폰트 크기, 라운드, 도트, 뱃지 위치). 완료 후 데스크톱 복사+폴더 열기(`feedback_show_results_desktop`).
3. 기능 회귀 체크리스트: returnTo(`/?returnTo=/my/results` 진입→카카오 CTA callbackUrl 확인), 알잔액 pill, 햄버거 드로어, menu의 saju 결과분기·checkError 재시도, yearly 플래그 on/off 양쪽, 펫 취소선, 배틀/펫 store reset, `/stories`·`/dict` 딥링크 이동, FAQ 아코디언 키보드 조작.
4. 사이드이펙트 스캔: `middleware.ts`·`Header`·`login`·`start`·결제·결과 화면 diff 0 확인 (`git diff --stat`으로 허용 파일 외 변경 없음).
5. dev 서버 종료 후 `npx next build` 성공 + "Deploying outputs" 250MB 가드: 빌드 로그에서 함수 사이즈 확인, `outputFileTracingExcludes` 유지 확인.
6. 카피 전수검수: 신규 노출 텍스트에서 "무료" 검색 0건(매거진/사전 본문 제외 — 허브 카피에는 사용 안 함).
7. 이미지 위생: `public/images/hub` 총합 ≤1MB, WebP만 존재, 미사용 임시 파일 정리(`feedback_visu_file_cleanup` 준용).
8. 모바일 시니어 가독(참고 게이트): 큰 글씨·고대비 위반 없는지 육안 확인(`feedback_senior_audience_design`).

---

## 8. 태스크 분해 (의존성·비용·게이트)

| T | 작업 | 파일 | 의존 | 비용 | 게이트 |
|---|---|---|---|---|---|
| T0 | 브랜치 `feat/unified-hub` 생성 (main 기점) | — | — | 무료 | `feedback_branch_strategy` |
| T1 | WebP 변환 스크립트+배치 (5장 ≤1MB) | `scripts/convert-hub-images.mts`, `public/images/hub/*.webp`, package.json(devDep sharp) | T0 | 무료 | 용량 실측 후 커밋 |
| T2 | 허브 공통 기반: config·훅·Reveal·SectionHeader | `components/hub/{services.ts,useServiceActions.ts,Reveal.tsx,HubSectionHeader.tsx}` | T0 | 무료 | — |
| T3 | 히어로 캐러셀 | `components/hub/HubHeroCarousel.tsx` | T1·T2 | 무료 | — |
| T4 | 서비스 레일 (임시 object-bottom 크롭) | `components/hub/ServiceRail.tsx` | T1·T2 | 무료 | — |
| T5 | 연예인·사전·매거진 리스트 | `components/hub/{CelebrityRail,DictList,DictThumb,MagazineList,HubViewBadge}.tsx` | T2 | 무료 | — |
| T6 | FAQ + 스티키 CTA | `components/hub/{HubFaq,HubStickyCta}.tsx` | T2 | 무료 | — |
| T7 | 홈 조립 (서버 셸 전환) | `app/page.tsx` | T3~T6 | 무료 | returnTo 회귀 체크 |
| T8 | /menu 리디자인 | `app/menu/page.tsx`, `components/hub/ServiceMenuList.tsx` | T1·T2 | 무료 | saju 분기 동작 동일 확인 |
| T9 | 검증 §7 전체 | — | T7·T8 | 무료 | 스크린샷 8장 + build 성공 |
| T10 | **(유료·운영자 승인 게이트)** 제목 없는 서비스 포스터 5장 생성 → `*-notitle.webp` 교체. (선택) 연예인 3:4 초상·사전 1:1 썸네일 | `public/images/hub/*` + config src 교체 | T9, **승인** | **유료** | `feedback_generation_approval` |
| T11 | 커밋 정리(태스크별 커밋, "왜" 포함) → PR 생성. **main 머지/배포는 운영자 명시 허용 후** | — | T9(±T10) | 무료 | `feedback_git_push`·배포 전 2차 영향 검증 |

---

## 9. 사이드이펙트 경계 — 건드리지 않는 것

| 영역 | 파일 | 상태 |
|---|---|---|
| 공용 컴포넌트 | `Header.tsx`·`MenuDrawer.tsx`·`AnalysisCounter.tsx`·`BusinessFooter.tsx`·`StoryCard*`·`StoryArt`·`ShareRewardBanner` | 재사용만, diff 0 |
| 라우팅/인증 | `middleware.ts`(returnTo·referrer 캡처)·`lib/auth.ts`·`/login`·`/start`·`app/api/**` | 무변경 |
| `/menu` 참조 20여 곳 | `app/battle/input`·`result`·`today`·`pet`·`my/results`·`stories/layout` 등 | 라우트 유지로 전부 무해 |
| 점수/프롬프트/분석 | `lib/analysis.ts`·`saju-scoring.ts`·`gradeSystem.ts`·prompts | 무변경 |
| 결제 | `checkout`·`payment`·coins API·`COIN_PACKAGES` | 무변경 (상수 import는 read-only) |
| 펫 결과화면 | `app/pet/result/**`(PR#84 라인) | 무변경 |
| 전역 스타일 | `globals.css`·`tailwind.config.ts` | **무변경** — 신규 스타일은 전부 Tailwind 인라인/컴포넌트 로컬 |
| 빌드 설정 | `next.config.js` | 무변경(T9에서 확인만). devDep `sharp` 추가만 package.json 변경 |

---

## 10. 운영자 결정 대기 (열린 질문)

- **A. 서비스 썸네일 제목 중복(§2-1)** — 권고 (b) 제목 없는 포스터 5장 유료 재생성(T10, 승인 필요). 승인 전엔 (a) object-bottom 크롭으로 출시 가능하나 baked 제목 일부 노출 가능성 있음.
- **B. 연예인 3:4 카드 이미지 소스(§3-3)** — 1안 기존 `/stories/heroes/*.png` 수채화 크롭(무료, 단 임영웅 등 가로형은 잘림 위험) / 2안 3:4 전용 초상 5장 유료 생성. 1안으로 만들고 스크린샷 검수 후 결정 권고.
- **C. 목업에 없는 기존 요소·미세 라우팅** — ① `ShareRewardBanner`(현 랜딩 상단 5알 배너)를 새 허브에 유지할지 제거할지(계획 기본값: 유지, 헤더 아래). ② 비로그인 서비스 클릭을 지시대로 `/login` 유도로 통일하면 기존 게스트 플로우(`/start` 직행) 대비 전환 변화 가능 — 허브만 로그인 유도, `/menu`는 현행 유지가 기본값. ③ 사전 리스트 8행(지시) vs 목업 4행 — 기본값 8행.
