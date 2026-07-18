# 두루미 디자인 가이드 (DESIGN_GUIDE)

> **이 문서가 두루미사주 디자인의 최상위 기준점이다.**
> 새 페이지를 만들거나 기존 페이지를 개선할 때, 이 문서만 보고 두루미 톤에 맞는 화면을 만들 수 있어야 한다.
> 정본 목업: `docs/mockups/unified-hub-v2.html`(허브) · `docs/mockups/menu.html`(메뉴)
> 구현 계획 선례: `docs/superpowers/plans/2026-07-17-durumi-hub-impl.md`

---

## 0. 머리말 — 문서 목적과 사용법

### 0-1. 목적

2026-07 통합 허브 리디자인에서 확립한 디자인 언어("적은 색 · 적은 보더 · 큰 여백 · 일관된 위계 · 시네마틱 이미지")를 정본화한 문서다. 추상 원칙이 아니라 **바로 복사해 쓰는 토큰 · 클래스 · 컴포넌트 · 패턴**을 담는다.

### 0-2. 새 페이지를 만들 때 이 순서로 참고한다

1. **§5 레이아웃 골격**으로 페이지 셸(컨테이너·헤더·CTA)을 잡는다.
2. **§4 컴포넌트 카탈로그**에서 필요한 패턴(섹션 헤딩·캐러셀·리스트 행·FAQ·CTA)을 그대로 복사한다.
3. **§1 파운데이션 토큰**만 사용해 색·타이포·간격을 채운다. 하드코딩 hex 금지.
4. 이미지가 필요하면 **§3 이미지 시스템**의 레인(A 포스터 / B 콘텐츠)과 프롬프트 레시피를 따른다.
5. 카피는 **§6 보이스 & 브랜드 가드**로 검수한다.
6. 출고 전 **§7 체크리스트**를 전수 통과시키고, **§8 안티패턴**에 걸리는 게 없는지 본다.

### 0-3. 기존 문서와의 관계

| 문서 | 관계 | 비고 |
|---|---|---|
| **이 문서 (DESIGN_GUIDE.md)** | **최상위 기준.** 충돌 시 항상 이 문서가 이긴다 | 허브 v2에서 확립한 디자인 언어의 정본 |
| `docs/DESIGN_SYSTEM.md` (v4) | **세부 참조용 하위 문서.** 결과 화면·입력 폼·차트 등 기존 화면의 컴포넌트 상세 스펙은 여기 참조 | ⚠️ 일부 값이 낡음: `--bg-secondary`를 `24 24 27`로 적었으나 실제는 `20 20 20`, rank 색도 구버전(fuchsia S). **토큰 값은 반드시 이 문서 §1(= 현행 `globals.css` 실측)이 정본** |
| `docs/mockups/HUB_STYLE.md` | 이 문서의 씨앗. **이 문서로 흡수·대체됨** | ⚠️ §7 이미지 비율(포스터 4:5·서비스 4:3)은 폐기 — v2 목업 확정치는 이 문서 §3-4 (히어로 2:3 · 서비스 4:5 · 연예인 3:4 · 리스트 1:1) |
| `docs/HERO_ILLUSTRATION_STYLE.md` | 매거진 hero(레인 B-1) 생성 스크립트의 락 문서 — 계속 유효 | `scripts/generate-story-hero.mts`의 `STYLE_SUFFIX`와 동기 |
| `tailwind.config.ts` · `app/globals.css` | 토큰의 코드 원천(SSOT). 이 문서 §1은 그 미러 | 토큰 추가·변경 시 코드와 이 문서를 함께 갱신 |

---

## 1. 파운데이션 토큰

### 1-1. 색 — ★모든 색은 토큰 클래스만. 인라인 hex(`#RRGGBB`) · 임의 rgb 금지

원천: `app/globals.css`의 CSS 변수(RGB 트리플릿) ↔ `tailwind.config.ts`의 `colors` 매핑.

#### 배경 · 텍스트 · 브랜드

| 토큰 클래스 | CSS 변수 | RGB | Hex 근사 | 용도 |
|---|---|---|---|---|
| `bg-background-primary` | `--bg-primary` ← `--c-dark-bg` | `9 9 11` | `#09090B` | 페이지 최하층 배경 |
| `bg-background-secondary` | `--bg-secondary` ← `--c-dark-surface` | `20 20 20` | `#141414` | 카드/서피스, 이미지 로딩 배경 |
| `bg-background-tertiary` | `--bg-tertiary` ← `--c-dark-elevated` | `39 39 42` | `#27272A` | 입력필드, 옵션 버튼, 3차 면 |
| `text-text-primary` | `--text-primary` | `255 255 255` | `#FFFFFF` | 기본 텍스트 (흰) |
| `text-text-secondary` | `--text-secondary` | `161 161 170` | `#A1A1AA` | 보조 텍스트, chip, 링크 |
| `text-text-tertiary` | `--text-tertiary` | `140 140 150` | `#8C8C96` | eyebrow, 메타, 캡션 |
| `bg-primary` / `text-primary` | `--primary` ← `--c-brand` | `244 63 94` | `#F43F5E` | **유일한 강조색** (rose). CTA·활성 도트·로고 포인트 |
| `bg-primary-hover` | `--primary-hover` | `251 113 133` | `#FB7185` | primary 호버 |
| `bg-primary-kakao` | `--c-kakao` | `254 229 0` | `#FEE500` | 카카오 로그인 버튼 전용 |
| `border-border` | `--border-default` ← `--c-dark-elevated` | `39 39 42` | `#27272A` | 입력필드 테두리 (전역 CSS) |

#### 오행색 (`saju-*`) — 사주 도메인 데이터 표시 전용

| 오행 | 원색 클래스 | RGB | 뮤트 클래스 | RGB (뮤트) |
|---|---|---|---|---|
| 목(木) | `saju-wood` | `34 197 94` | `saju-wood-muted` | `110 185 130` |
| 화(火) | `saju-fire` | `239 68 68` | `saju-fire-muted` | `210 120 115` |
| 토(土) | `saju-earth` | `234 179 8` | `saju-earth-muted` | `195 170 90` |
| 금(金) | `saju-metal` | `228 228 231` | `saju-metal-muted` | `235 235 240` |
| 수(水) | `saju-water` | `59 130 246` | `saju-water-muted` | `80 145 240` |

사용 규칙: 만세력 셀·신살 배지 등 **오행 의미가 있는 데이터**에만. 배경 `bg-saju-{el}/8~10`, 테두리 `/15~20`, 글자는 `-muted`. 장식용 색남발 금지.
예외적 UI 전용: `bg-saju-wood`(NEW 뱃지), `text-saju-earth`(알잔액 부족 경고 — Header 선례).

#### 등급색 (`primary-rank-*`) — 등급 표시 전용

| 등급 | 클래스 | RGB | Hex |
|---|---|---|---|
| S | `text-primary-rank-s` | `255 59 47` | `#FF3B2F` |
| A | `text-primary-rank-a` | `248 64 240` | `#F840F0` |
| B | `text-primary-rank-b` | `240 144 0` | `#F09000` |
| C | `text-primary-rank-c` | `160 188 200` | `#A0BCC8` |
| D | `text-primary-rank-d` | `184 122 64` | `#B87A40` |

#### 알파(투명도) 컨벤션 — white/black 계열은 알파 유틸로만

| 패턴 | 용도 |
|---|---|
| `bg-white/[0.04]` | 최소 면 구분 (FAQ 카드, "전체 보기" 버튼, 사전 임시 썸네일) |
| `bg-white/[0.06]` | 헤더 알잔액 pill |
| `divide-white/8` | 리스트 구분선 |
| `border-white/10` | (구화면 한정) 일반 테두리 — 신규 화면에선 보더 자체를 피할 것 |
| `bg-white/25` | 캐러셀 비활성 도트 |
| `bg-black/45` | 이미지 위 오버레이 뱃지, 잠금 오버레이 |
| `bg-primary/[0.12~0.14]` | 페이지 상단 앰비언트 글로우 |

### 1-2. 타이포그래피 — 역할당 딱 1개 스타일

**폰트 2종 원칙**
- **SBAggroM (`font-aggro`)** — 두루미체. weight 500 고정(@font-face). **섹션/페이지 헤딩과 브랜드명 전용.** 그 외 사용 금지.
- **Pretendard** — body 기본. 본문·콘텐츠 제목(bold)·메타 전부.
- (이미지 안 baked 텍스트는 별도: §3-3 굵은 한글 명조 — 코드 폰트가 아니라 포스터 생성물에만 존재)

**역할 → 스타일 표 (신규 화면은 이 표만 쓴다)**

| 역할 | 클래스 (복붙) | 비고 |
|---|---|---|
| 헤더 브랜드명 | `font-aggro text-[19px] text-text-primary` (= `text-title-3 font-aggro`) | Header.tsx |
| 페이지 제목 (h1) | `font-aggro text-[24px]` | menu "무엇을 볼까요?" |
| 섹션 제목 (h2) | `font-aggro text-[22px]` | 모든 홈 섹션 |
| 섹션 eyebrow | `text-[12px] font-medium text-text-tertiary` | 제목 위 1줄, 모든 섹션 |
| "전체 보기" 링크 | `text-[13px] text-text-secondary` | 목록 섹션 우측 |
| 카드/리스트 제목 | `text-[16px] font-bold leading-[1.35] break-keep` | **Pretendard bold** — 두루미체 아님 |
| 리스트(메뉴) 대형 제목 | `text-[18px] font-bold leading-tight` | 세로 리스트 행 |
| 인물 카드 이름 | `text-[15px] font-bold leading-tight` | 연예인 3:4 카드 |
| chip (카드 위 분류) | `text-[11px] font-semibold text-text-secondary` | 색 없음 |
| 카드 설명 | `text-[12px] text-text-tertiary leading-snug line-clamp-1 break-keep` | 레일 카드 |
| 리스트 설명 | `text-[13px] text-text-secondary leading-snug break-keep` | 메뉴 행 |
| 메타·캡션 | `text-[12.5px] text-text-tertiary` | 분류·읽기시간·조회 |
| 가격 | `text-[14px] font-bold` + `<Egg size={14} weight="fill" />` | **색 없음** (메뉴 행은 15px/15) |
| 본문 (긴 글) | `text-[16px] text-text-primary leading-[1.75]` | 결과·아티클 본문 |
| FAQ 질문 | `text-[15px] font-semibold` | |
| FAQ 답 | `text-[14px] leading-relaxed text-text-secondary break-keep` | |
| CTA 버튼 | `text-[16px] font-bold` | 스티키 CTA |

**fontSize 토큰 스케일** (tailwind.config, Major Third 1.25) — 기존 화면 호환용. 신규 화면은 위 표의 `text-[Npx]`가 정본:
`display` 38 / `title-1` 30 / `title-2` 24 / `title-3` 19 / `body-1` 19 / `body-2` 15 / `caption` 12 / `button-lg` 19 / `button-md` 15 / `button-sm` 12 / `question` 28 / `step` 14.

한글 줄바꿈: 제목·본문에 `break-keep` 기본 적용 (단어 중간 꺾임 방지 — 시니어 가독성).

### 1-3. 간격 — 8px 그리드

| 항목 | 값 (복붙) |
|---|---|
| 페이지 좌우 여백 | `px-5` (20px) — 전 섹션 통일 |
| 섹션 사이 | `pt-10` (40px) |
| 섹션 헤딩 ↔ 본문 | `mb-3` (레일) / `mb-2` (리스트) |
| 레일/그리드 gap | `gap-3` (12px) |
| 리스트 행 상하 | `py-2.5` (사전·매거진 행) / `py-4` (메뉴 대형 행) |
| 리스트 행 내부 gap | `gap-3.5` (썸네일↔텍스트) / `gap-4` (메뉴) |
| main 하단 | `pb-[120px]` (스티키 CTA 회피) |

### 1-4. 라운드 — 3단계 고정

| 단계 | 클래스 | 사용처 |
|---|---|---|
| 대 | `rounded-3xl` (24px) | 히어로 포스터, 대형 컨테이너 |
| 중 | `rounded-2xl` (16px) | 카드·썸네일·FAQ·CTA 버튼·리스트 행 hover 면 |
| pill | `rounded-full` | 도트, 카운터 뱃지, 칩 |

보조: `rounded-xl`(12px)은 입력필드·메뉴 소형 썸네일(92px)·헤더 아이콘 버튼에 한정. `rounded-md`는 NEW 뱃지에만. **중첩 시 안쪽이 한 단계 작게.**

### 1-5. 깊이(shadow) · 글로우

- **보더로 면을 나누지 않는다.** 면 구분은 여백과 배경 알파로. ring/border는 신규 화면에서 원칙 금지(입력필드 제외).
- 떠 있는 요소(스티키 CTA 버튼 등)만 깊이: `shadow-[0_8px_30px_rgba(0,0,0,0.42)]` (목업 `.depth`).
- 페이지 상단 앰비언트 글로우 (페이지당 1개):
  ```html
  <div class="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-[320px] w-[320px] rounded-full blur-[100px] bg-primary/[0.14]"></div>
  ```
  (메뉴는 `h-[300px] w-[300px] bg-primary/[0.12]` 소형판)

### 1-6. 모션

| 패턴 | 스펙 (복붙) | 용도 |
|---|---|---|
| **press (스프링)** | `transition-[transform,background-color] duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-[0.97]` | 모든 탭 가능 카드·버튼. (리스트 행은 `scale-[0.98]`) |
| **scroll-reveal** | `opacity 0 → 1`, `translateY(22px) → 0`, `transition .6s cubic-bezier(.22,1,.36,1)`, IntersectionObserver threshold `0.12` | 섹션 헤딩·리스트 섹션 등장. 구현: `components/hub/Reveal.tsx` |
| **snap 캐러셀** | `flex snap-x snap-mandatory overflow-x-auto` + 아이템 `snap-start` + `style={{scrollPaddingLeft:20}}` — **CSS만, JS 스크롤 하이재킹 금지** | 가로 레일 전부 |
| **stagger 등장** | `.durumi-stagger` (globals.css, 500ms `cubic-bezier(0.16,1,0.3,1)` + 80ms 간격) | 카드 목록 진입 |
| **slideUp keyframe** | tailwind.config `slideUp`: `opacity 0 / translateY(24px) → 1 / 0` | 기존 화면 호환 |
| **셰브론 회전** | `transition group-open:rotate-180` | FAQ CaretDown |

★ **prefers-reduced-motion 존중 필수.** globals.css 전역 규칙이 이미 모든 animation/transition을 0.01ms로 죽인다. JS 애니메이션(캐러셀 smooth scroll, rAF 차트)은 `window.matchMedia("(prefers-reduced-motion: reduce)")` 직접 분기.

---

## 2. 아이콘 · 이모지 규칙

- **이모지 전면 금지.** UI 텍스트·버튼·뱃지·섹션 제목 어디에도 🥚🔥⌄ 같은 이모지를 넣지 않는다.
- 아이콘은 **`@phosphor-icons/react` 한 세트만.** 서버 컴포넌트에서는 `@phosphor-icons/react/dist/ssr`에서 import (선례: `components/stories/StoryCard.tsx`).
- 목업 HTML의 인라인 SVG는 목업 한정 표현 — **실코드에서는 반드시 Phosphor 컴포넌트로 치환**한다.

| 의미 | 아이콘 | 표준 사용 |
|---|---|---|
| 알(코인) | `Egg` | `<Egg size={14} weight="fill" />` — 가격·잔액 |
| 인기/조회수 | `Fire` | `<Fire size={11} weight="fill" />` — 매거진 조회 메타 |
| 아코디언 펼침 | `CaretDown` | `size={18}` + `group-open:rotate-180` |
| 뒤로가기 | `CaretLeft` | `size={20} weight="bold"` |
| 햄버거 메뉴 | `List` | `size={22}` |

예외: 카카오 로고는 브랜드 자산이라 인라인 SVG 허용(§4-8).

---

## 3. 이미지 · 일러스트 시스템 (핵심)

### 3-1. 두루미 마스코트 — identity-lock

모든 두루미 캐릭터는 아래 정체성을 **절대 고정**한다 (레인 무관):

- **플랫 화이트 몸통** + **코랄로즈(#F43F5E 계열) 볏과 부리**
- **dot 눈** (작은 검은 점 눈 — 큰 만화 눈은 매거진 hero의 chibi 레인만 예외)
- 다른 동물·사람 얼굴로 대체 금지. 결이 바뀌면 브랜드가 무너진다.

레퍼런스 원본: 캐릭터 master 이미지(쇼츠 파이프라인 공용)를 프롬프트에 항상 첨부한다.

### 3-2. 두 레인 (레인 밖 스타일 신설 금지)

| | **레인 A — 시네마틱 히어로 포스터** | **레인 B — 콘텐츠 썸네일** |
|---|---|---|
| 쓰임 | 홈 히어로 캐러셀, 서비스 대표 비주얼 | B-1 매거진 hero(비연예인=두루미 chibi) · B-2 연예인 수채화 초상 |
| 비율 | **2:3 세로** (1024×1536) | B-1 16:9 원본 → UI에서 1:1 크롭 / B-2 3:4 |
| 스타일 | 3D 렌더 두루미(도사 로브) + 우주 배경 + 금박 필리그리 | B-1 chibi 3D Pixar, warm pastel cream (→ `HERO_ILLUSTRATION_STYLE.md`) / B-2 photo-to-caricature 수채화 |
| 텍스트 | **굵은 한글 명조 제목/서브 baked** (§3-3) | **글자 일절 금지** |
| 생성 | §3-3 프롬프트 레시피 | B-1 `scripts/generate-story-hero.mts` / B-2 운영자 제공 사진 기반 |

### 3-3. 레인 A — 시네마틱 포스터 스펙

허브 5장(`docs/mockups/assets/*.png`)에서 확정된 구성:

1. **레이아웃 (상단 제목-세이프존 고정)**
   - 상단 ~5%: 금박 필리그리 장식(위)
   - 상단 10~20%: **메인 제목** — 초대형 굵은 한글 명조(세리프), 흰색 + 은은한 글로우
   - 그 아래: **서브타이틀 1줄** — 중형 한글 명조 흰색
   - 서브 아래: 금박 필리그리 장식(아래) — 제목 블록을 위아래 필리그리가 감싼다
   - 중~하단 75%: 두루미 명리학자(도사 로브, 정면) + 서비스 상징 prop(빛나는 오브 등)을 두 날개-손으로 받쳐 든 구도
2. **좌청우홍 우주 에너지**: 왼쪽 파랑·보라 코스믹 에너지 스트림, 오른쪽 주황·빨강 화염 에너지 스트림, 배경은 별이 흩뿌려진 딥블랙 우주. 중앙 prop이 골드 글로우로 발광.
3. **캐릭터**: §3-1 identity-lock — 플랫 화이트 + 코랄 볏/부리 + dot 눈. 로브는 다크 네이비/블랙 + 금실 자수 + 레드 안감.

**프롬프트 레시피 (일반화 템플릿 — 재현용)**

```
[첨부] 두루미 캐릭터 master 이미지 (identity 고정용)

Vertical 2:3 cinematic Korean fortune-telling poster, 1024x1536.

CHARACTER: the attached crane character as a mystical saju master —
flat white body, coral-rose crest and beak, small black dot eyes,
wearing a dark navy-black daoist robe with gold embroidery and red lining,
front-facing, lower two-thirds of frame, holding {서비스 상징 prop:
glowing golden magic circle with question mark / two clashing orbs / ...}
in both wing-hands, prop glows warm gold.

BACKGROUND: deep black cosmic starfield. LEFT side: blue-purple cosmic
energy stream flowing vertically. RIGHT side: orange-red flame energy
stream flowing vertically. (좌청우홍 고정)

TEXT (Korean, exact strings, baked into image):
- Top safe zone (upper 10-20%): main title "{제목}" — very large bold
  white Korean Myeongjo (serif) font with subtle glow
- Below it: subtitle "{서브 한 줄}" — medium white Korean Myeongjo
- Gold filigree ornament divider above title and below subtitle

STYLE: premium 3D render, cinematic lighting, movie-poster quality.
NEGATIVE: no hanja, no numbers unless in title, no other animals,
no human faces, no watermark, no misspelled Korean.
```

- `{제목}`·`{서브}`는 **정확한 한글 문자열**을 그대로 지시한다 (오타 렌더 검수 필수 — 생성 후 Read로 글자 전수 확인).
- **연도·날짜가 들어가는 제목 주의**: "2026년 운세"처럼 시간이 baked 되면 해가 바뀔 때 이미지 전체를 재생성해야 한다. 가능하면 연도는 코드 텍스트로 빼고 이미지는 무연도 제목 사용.

### 3-4. 슬롯 비율 규격 (v2 확정 — HUB_STYLE §7 폐기)

| 슬롯 | 비율 | 크기 | 소스 |
|---|---|---|---|
| 히어로 캐러셀 포스터 | **2:3** | `w-[86%]` 슬라이드 | 레인 A (제목 baked) |
| 서비스 카드 썸네일 | **4:5** | `w-[150px]` | 레인 A 크롭 — ★제목 없는 버전 권장(§3-5) |
| 메뉴 행 썸네일 | **4:5** | `width:92px` `rounded-xl` | 서비스와 동일 소스 |
| 연예인 인물 카드 | **3:4** | `w-[130px]` | 레인 B-2 수채화 초상 |
| 사전·매거진 리스트 썸네일 | **1:1** | `h-[84px] w-[84px]` | 레인 B 크롭 or 임시 타일 |

### 3-5. ★제목 baked는 히어로 전용 — 코드 텍스트와 겹침 금지

- 포스터의 baked 제목은 **이미지가 화면의 유일한 텍스트일 때만**(히어로 캐러셀) 노출한다.
- 카드에 코드 텍스트 제목이 별도로 붙는 자리(서비스 카드·메뉴 행)에는 **제목 없는 포스터 버전**(`*-notitle.webp`)을 쓴다. 임시로는 `object-cover object-bottom` 크롭으로 제목대를 밀어내되, 잔여 노출이 보이면 무제목 버전 생성으로 해결(유료 — 생성 승인 게이트).

### 3-6. 파일 위생 — WebP · 250MB 가드

- 배포 이미지는 **WebP** (`public/images/hub/*.webp` 등), 포스터 장당 **≤200KB**, 세트 합계 ≤1MB 목표. 변환: `scripts/convert-hub-images.mts` (sharp, q80→미달 시 q75).
- PNG 원본은 `docs/mockups/assets/`에 보관(배포 산출물 아님). public에 원본 PNG를 넣지 않는다.
- **250MB 서버리스 가드**: `lib/stories/hero-image-size.ts` 같은 **fs 읽기 유틸을 페이지에서 import 금지** (public 전체가 함수에 딸려가 배포 실패한 사고 선례). `next.config.js`의 `outputFileTracingExcludes: { "*": ["public/stories/**"] }` 유지. 이미지는 src 문자열로만 참조.
- 임시·중간 산출물(스틸·데모·미리보기)은 작업 종료 시 즉시 삭제.

---

## 4. 컴포넌트 · 패턴 카탈로그 (목업 실측 클래스)

> 아래 클래스는 `unified-hub-v2.html` / `menu.html`에서 그대로 추출한 값이다. 임의 변형 금지.
> 목업 `.press`/`.no-scrollbar`는 실코드에서 §1-6 인라인 유틸 / 기존 `.scrollbar-hide`(globals.css)로 치환.

### 4-1. 헤더 — 공용 `components/layout/Header.tsx` 재사용 (수정 금지)

구조: `flex-1(좌) | 가운데 타이틀 | flex-1(우)` 3분할 — 타이틀 항상 정중앙.

```
<header class="sticky top-0 z-[100] bg-background-primary px-5 py-4">
  좌: 뒤로가기 <CaretLeft size={20} weight="bold"/> 버튼(w-10 h-10 rounded-lg) 또는 <div class="w-10"/>
  중: font-aggro text-[19px] text-text-primary  "사주보는 두루미"
  우: [로그인 시] 알잔액 pill — flex items-center gap-1 text-[13px] font-semibold px-2.5 py-1
      rounded-lg text-text-secondary bg-white/[0.06] + <Egg size={14} weight="fill"/>
      (잔액 ≤10: text-saju-earth bg-saju-earth/10)
      [비로그인 시] 로그인 pill — border border-white/10 bg-background-secondary text-text-secondary
      + 햄버거 <List size={22}/> (MenuDrawer)
</header>
```

### 4-2. 섹션 헤딩 — 모든 섹션 공통 리듬

```html
<div class="mb-3 flex items-end justify-between px-5">  <!-- Reveal 래핑 -->
  <div>
    <p class="text-[12px] font-medium text-text-tertiary">요즘 다들 보는</p>
    <h2 class="font-aggro text-[22px]">이번 주 인기 사주</h2>
  </div>
  <button class="text-[13px] text-text-secondary shrink-0 pb-1">전체 보기 →</button>  <!-- 목록 섹션만 -->
</div>
```

eyebrow는 **호기심 유발 한 줄**("이 말, 무슨 뜻일까?" · "알 하나면 충분해요"), 제목은 두루미체. 이 2줄 구조를 전 섹션 반복해 페이지 리듬을 만든다.

### 4-3. 히어로 캐러셀 (2:3 포스터 · snap · 도트)

```html
<section class="pt-4">
  <!-- §4-2 헤딩 -->
  <div class="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
       style="scroll-padding-left:20px">
    <article class="relative snap-start w-[86%] shrink-0 overflow-hidden rounded-3xl
                    bg-background-secondary" style="aspect-ratio:2/3">
      <img class="absolute inset-0 h-full w-full object-cover" />  <!-- next/image fill -->
      <span class="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1
                   text-[11px] font-semibold text-white/80">1 / 5</span>
    </article>
    ...
    <div class="w-1 shrink-0"></div>  <!-- 우측 끝 여백 -->
  </div>
  <div class="flex justify-center gap-1.5 pt-1">
    <span class="h-1.5 w-5 rounded-full bg-primary"></span>          <!-- 활성 -->
    <span class="h-1.5 w-1.5 rounded-full bg-white/25"></span>       <!-- 비활성 ×n -->
  </div>
</section>
```

- `w-[86%]` → 다음 카드가 옆에 살짝 보이는 **peek**. 활성 인덱스는 트랙 `onScroll`(rAF 스로틀)로 `Math.round(scrollLeft / stride)` 계산.
- 첫 슬라이드만 `priority`. 카운터 뱃지가 있으므로 도트는 `aria-hidden`.

### 4-4. 서비스 카드 / 레일 (4:5 썸네일 + 코드 텍스트)

```html
<button class="press snap-start w-[150px] shrink-0 text-left">
  <div class="relative mb-2 w-full overflow-hidden rounded-2xl bg-background-secondary"
       style="aspect-ratio:4/5">
    <img class="absolute inset-0 h-full w-full object-cover" />
    <!-- NEW 뱃지 (해당 시) -->
    <span class="absolute right-2 top-2 rounded-md bg-saju-wood px-1.5 py-0.5
                 text-[10px] font-bold text-background-primary">NEW</span>
  </div>
  <span class="text-[11px] font-semibold text-text-secondary">평생 사주</span>       <!-- chip -->
  <h3 class="text-[16px] font-bold leading-tight">내 사주 분석</h3>
  <p class="mt-1 text-[12px] text-text-tertiary leading-snug line-clamp-1 break-keep">타고난 기질과 운의 흐름</p>
  <p class="mt-1 flex items-center gap-1 text-[14px] font-bold"><Egg size={14} weight="fill"/>10알</p>
</button>
```

- **가격·chip·제목에 색 쓰지 않는다** (무지개 금지). 할인 표기: `<span class="text-text-tertiary line-through text-[12px] font-semibold">15</span> 8알`.
- 가격 숫자는 반드시 `lib/constants/coins` 상수에서 렌더(하드코딩 금지).

### 4-5. 리스트 행 (사전 · 매거진 공용 — 숫자·순위 없음)

두 섹션은 **완전히 동일한 컴포넌트**. 차이는 헤딩과 메타 내용뿐.

```html
<div class="-mx-1">
  <a class="press flex items-center gap-3.5 rounded-2xl px-1 py-2.5">
    <div class="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl">…1:1 썸네일…</div>
    <div class="min-w-0 flex-1">
      <h3 class="text-[16px] font-bold leading-[1.35] break-keep">내 사주는 몇 등급일까</h3>
      <p class="mt-0.5 text-[12.5px] text-text-tertiary">사주 입문</p>
      <!-- 매거진 메타: 연예인 사주 · 6분 · <Fire size={11} weight="fill"/>1.2만  (제목은 line-clamp-2) -->
    </div>
  </a>
</div>
<button class="mt-3 w-full rounded-2xl bg-white/[0.04] py-3 text-[14px] text-text-secondary">사전 전체 보기 →</button>
```

썸네일 자산이 없을 땐 임시 타일: `bg-white/[0.04] rounded-2xl` + 대표 글자 `font-aggro text-[28px] text-text-secondary`.

### 4-6. 세로 구분선 리스트 (메뉴 — divide-y)

```html
<div class="divide-y divide-white/8">
  <button class="press flex w-full items-center gap-4 py-4 text-left">
    <div class="min-w-0 flex-1">
      <span class="text-[11px] font-semibold text-text-secondary">평생 사주</span>
      <h3 class="mt-0.5 text-[18px] font-bold leading-tight">내 사주 분석</h3>
      <p class="mt-1 text-[13px] text-text-secondary leading-snug break-keep">타고난 기질과 운의 흐름을 5가지 운으로 풀어봐요</p>
      <p class="mt-2 flex items-center gap-1 text-[15px] font-bold"><Egg size={15} weight="fill"/>10알</p>
    </div>
    <div class="shrink-0 overflow-hidden rounded-xl" style="width:92px; aspect-ratio:4/5">…썸네일…</div>
  </button>
</div>
```

### 4-7. 연예인 인물 카드 (3:4)

```html
<button class="press snap-start w-[130px] shrink-0 text-left">
  <div class="w-full overflow-hidden rounded-2xl" style="aspect-ratio:3/4">…수채화 초상…</div>
  <h3 class="mt-2 text-[15px] font-bold leading-tight">임영웅</h3>
  <p class="mt-0.5 text-[12px] text-text-tertiary">트로트</p>
</button>
```

### 4-8. FAQ 아코디언 (native details/summary — JS 0)

```html
<section class="px-5 pt-10">
  <h2 class="mb-4 text-center font-aggro text-[22px]">자주 묻는 질문</h2>
  <div class="space-y-2">
    <details class="group overflow-hidden rounded-2xl bg-white/[0.04]" open>  <!-- 첫 항목만 open -->
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 p-5
                      text-[15px] font-semibold">
        <span>돈 내기 전에 볼 수 있는 건 없나요?</span>
        <CaretDown size={18} class="shrink-0 text-text-tertiary transition group-open:rotate-180"/>
      </summary>
      <p class="px-5 pb-5 text-[14px] leading-relaxed text-text-secondary break-keep">…답변…</p>
    </details>
  </div>
</section>
```

### 4-9. 스티키 CTA (auth 분기)

```html
<div class="fixed inset-x-0 bottom-0 z-[120] mx-auto max-w-[440px] px-5 pt-6
            pb-[calc(24px+env(safe-area-inset-bottom))]"
     style="background:linear-gradient(0deg,rgb(9 9 11) 0%,rgb(9 9 11) 62%,transparent 100%)">
  <!-- 비로그인 -->
  <button class="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-kakao
                 py-4 text-[16px] font-bold text-black/85 shadow-[0_8px_30px_rgba(0,0,0,0.42)]">
    (카카오 로고 인라인 SVG) 카카오로 3초만에 시작하기
  </button>
  <!-- 로그인 -->
  <button class="press w-full rounded-2xl bg-primary py-4 text-[16px] font-bold text-text-primary
                 shadow-[0_8px_30px_rgba(0,0,0,0.42)]">내 결과 보기</button>
</div>
```

- 그라디언트의 `9 9 11`은 `--bg-primary` 미러값 — 주석으로 명기하고 토큰 변경 시 함께 갱신.
- callbackUrl은 `returnTo` 쿼리 검증(`startsWith("/")`) 후 사용, 기본 `/menu`. `useSearchParams` → `<Suspense>` 경계 필수.

### 4-10. 칩 · 뱃지

| 종류 | 클래스 |
|---|---|
| NEW 뱃지 | `rounded-md bg-saju-wood px-1.5 py-0.5 text-[10px] font-bold text-background-primary` |
| 이미지 위 카운터 | `rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white/80` |
| chip (분류) | `text-[11px] font-semibold text-text-secondary` — 배경·색 없음 |
| 알잔액 pill | §4-1 헤더 참조 |

### 4-11. peek 캐러셀 CSS 요약 (모든 가로 레일 공통)

```
트랙:   scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2
        + style={{ scrollPaddingLeft: 20 }}
아이템: snap-start w-[고정폭] shrink-0        (86% / 150px / 130px)
끝:     <div class="w-1 shrink-0" />
```

---

## 5. 레이아웃 · 페이지 골격

### 5-1. 페이지 셸 (신규 화면)

```html
<div class="mx-auto w-full max-w-[440px] min-h-screen bg-background-primary relative overflow-hidden">
  <!-- §1-5 앰비언트 글로우 1개 -->
  <Header />                       <!-- sticky, §4-1 -->
  <main class="pb-[120px]">        <!-- 스티키 CTA 있는 페이지 -->
    <section class="pt-4">…히어로…</section>
    <section class="pt-10">…</section>   <!-- 이후 전 섹션 pt-10 -->
  </main>
  <!-- §4-9 스티키 CTA -->
</div>
```

- **신규 허브 계열 화면은 `max-w-[440px]`**, 기존 화면(결과·입력 등)은 `max-w-[640px]` 유지 — 혼용 금지, 페이지 단위로 통일.
- 모바일 퍼스트. 브레이크포인트 분기 최소화(데스크톱도 모바일 폭 유지).
- z-index 스택: 헤더 `z-[100]` < 스티키 CTA `z-[120]` < 모달/드로어 그 위.

### 5-2. 섹션 리듬

모든 섹션 = **eyebrow(1줄) + 두루미체 제목 + 본문**의 반복. 섹션 간 `pt-10` 고정. 헤딩에 `Reveal`(fade+up), 본문 카드에 press. 이 리듬을 깨는 단독 디자인 섹션을 만들지 않는다.

### 5-3. auth-adaptive (로그아웃/로그인 2얼굴)

한 페이지가 인증 상태에 따라 두 얼굴을 가진다. **레이아웃은 동일, 교체되는 것만 교체**:

| 요소 | 비로그인 | 로그인 |
|---|---|---|
| 헤더 우측 | 로그인 pill | 알잔액 pill (`useCoinStore`) |
| 스티키 CTA | 카카오 시작(kakao 노랑) | 내 결과 보기(`bg-primary`) |
| 서비스 탭 | `/login?callbackUrl=…` 유도 | 서비스 액션 실행 |

구현: `useSession()` 분기 (목업의 `only-in`/`only-out`은 목업 전용 장치). 새 페이지 설계 시 **반드시 두 상태 모두 스크린샷 검수**.

---

## 6. 콘텐츠 · 보이스 & 브랜드 가드

### 6-1. 카피 톤

- **따뜻하고 위트 있게, 쉬운 말로.** 주 시청자는 35~54 여성(시니어 포함) — MZ 슬랭·게임 메타포 금지, 보편적 표현.
- 해요체 기본: "봐드릴게요" · "풀어봐요" · "짚어봐요".
- eyebrow는 호기심 한 줄, 제목은 짧고 명료하게. 예: "이 말, 무슨 뜻일까?" / "알아두면 재밌는 사주 사전".
- 예언 단정 대신 이해와 재미: "절대적인 예언이 아니라 나를 이해하는 재미로 봐주세요."

### 6-2. 금지 · 주의 (★위반 시 출고 불가)

| 규칙 | 내용 |
|---|---|
| ★"무료" 오주장 금지 | 가입 보너스 종료로 분석은 유료(10알~). CTA·버튼·배너에 "무료" 사용 금지. **사실 서술만 허용**: 매거진·사전은 "로그인 없이 읽을 수 있어요" (OK) |
| 공포·서열화 금지 | 등급·점수는 "가능성 + 노력" 프레임. 협박성 어미("~하면 큰일") · 사람 줄세우기 카피 금지 |
| 성인·자극 금지 | 선정·폭력·혐오 소재 일절 배제 |
| 도사화 과장 주의 | 캐릭터는 귀여운 명리학자 컨셉까지만. "용한 도사" · 신점 프레이밍 금지 |
| 한자 UI 노출 금지 | UI 텍스트에 한자 병기 금지. 전문용어(용신·방위 등)는 노출 최소화, 직관 정보(색·숫자·물건)로 번역. 예외: 만세력 차트의 천간·지지 글자 자체 |
| 용어 통일 | 십성=별, 흉살=살, 길신=귀인, 일주=일주 |

### 6-3. 시니어 가독성 (★디자인 게이트)

- **큰 글씨 · 고대비 · 단순 · 한 번에 하나.** 우아한 작은 디테일은 독 — 가독성 > 우아함.
- 본문 최소 14px, 리스트 제목 16px+. 저대비 조합(`text-tertiary`를 본문에) 금지.
- 한 섹션 = 한 메시지. 정보를 겹쳐 쌓지 않는다.

---

## 7. 새 페이지 체크리스트 (출고 전 전수 통과)

- [ ] **토큰만 썼나** — `#`hex · 임의 `rgb()` 인라인 0건 (`grep -n "#[0-9a-fA-F]\{3,6\}" 대상파일`)
- [ ] **이모지 0건** — UI 문자열 전수 검색
- [ ] **아이콘 = Phosphor만** — 서버 컴포넌트는 `dist/ssr` import
- [ ] **보더 최소** — 신규 ring/border 추가 없나 (입력필드 제외)
- [ ] **섹션 헤딩 패턴** — eyebrow + `font-aggro text-[22px]` 리듬 준수, 두루미체를 카드 제목에 쓰지 않았나
- [ ] **간격** — `px-5` / 섹션 `pt-10` / `gap-3` 그리드 준수
- [ ] **라운드 3단계** — 중첩 시 안쪽 한 단계 작게
- [ ] **auth 분기** — 로그인/비로그인 두 상태 모두 스크린샷 (375·390px)
- [ ] **모션** — press·Reveal 적용 + reduced-motion에서 즉시 표시 확인
- [ ] **이미지 위생** — WebP·용량 목표 준수, fs 유틸 import 없음, 제목 baked 이미지와 코드 제목 중복 없음, 임시 파일 삭제
- [ ] **무료 카피 검수** — 신규 노출 텍스트에서 "무료" 검색 0건 (사실 서술 예외만)
- [ ] **시니어 가독성** — 실기기 육안: 글자 크기·대비·한 화면 정보량
- [ ] **가격 = 상수** — `lib/constants/coins`에서 렌더, 숫자 하드코딩 없음
- [ ] **공용 컴포넌트 diff 0** — Header·MenuDrawer·Footer 등 무수정 (`git diff --stat`)
- [ ] dev 서버 종료 후 `npx next build` 성공

---

## 8. 하지 말 것 (안티패턴)

| 안티패턴 | 대신 |
|---|---|
| 하드코딩 hex (`bg-[#141414]`, `text-[#A1A1AA]`) | `bg-background-secondary`, `text-text-secondary` — 토큰만 |
| 이모지를 아이콘 대용으로 (🥚 10알) | `<Egg weight="fill"/>` Phosphor |
| 무지개 색남발 — chip·가격·제목에 색 입히기 | 색은 `primary` 하나. chip/가격은 무채색 (§4-4) |
| 두루미체(`font-aggro`)를 본문·카드 제목에 | 두루미체는 섹션 헤딩·브랜드명 전용. 카드 제목은 Pretendard bold |
| 명조 아닌 폰트로 포스터 제목 baked | 포스터 제목은 굵은 한글 명조 고정 (§3-3) |
| 카드 박스 남발 — 모든 항목을 border+배경 카드로 감싸기 | 면 구분은 여백·`divide-y`·최소 `bg-white/[0.04]`로 |
| 공용 컴포넌트(Header·StoryCard 등) 함부로 수정 | 재사용만. 다른 결이 필요하면 신규 컴포넌트(`components/hub/*` 선례) |
| 제목을 이미지에 굽고 코드로 또 넣기 | 텍스트 자리엔 무제목 이미지 (§3-5) |
| JS로 캐러셀 스크롤 하이재킹 | CSS scroll-snap만 |
| 리스트에 순위 숫자·조회수 경쟁 연출 | 숫자 없는 동일 행 반복 (서열화 금지와 일관) |
| 목업 인라인 SVG를 실코드에 복붙 | Phosphor 컴포넌트로 치환 |
| 등급·오행색을 장식용으로 전용 | 도메인 데이터 표시에만 (§1-1) |
| dev 서버 켜둔 채 `next build` | dev 종료 후 빌드 (.next 청크 충돌) |

---

*최종 갱신: 2026-07-17. 토큰 값은 `app/globals.css` 실측 기준. 코드 토큰이 바뀌면 이 문서 §1을 반드시 함께 갱신할 것.*
