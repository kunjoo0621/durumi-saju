# Design System - 사주보는 두루미

> 소스 기반 분석 (2026-02-19 기준)
> `tailwind.config.ts`, `app/globals.css`, 주요 컴포넌트에서 추출

---

## 1. 색상 (Colors)

### 1-1. Primitive Tokens (CSS 변수 — RGB 트리플릿)

| 변수 | RGB 값 | Hex 근사 | 용도 |
|------|---------|----------|------|
| `--c-dark-bg` | `9 9 11` | `#09090B` | 최하층 배경 |
| `--c-dark-surface` | `24 24 27` | `#18181B` | 카드/서피스 배경 |
| `--c-dark-elevated` | `39 39 42` | `#27272A` | 3차 배경, 입력필드 |
| `--c-text-main` | `255 255 255` | `#FFFFFF` | 기본 텍스트 |
| `--c-text-sub` | `161 161 170` | `#A1A1AA` | 보조 텍스트 |
| `--c-text-muted` | `140 140 150` | `#8C8C96` | 3차 텍스트(캡션, 힌트) |
| `--c-brand` | `244 63 94` | `#F43F5E` | 브랜드/액센트 (rose-500) |
| `--c-brand-hover` | `251 113 133` | `#FB7185` | 브랜드 호버 (rose-400) |
| `--c-kakao` | `254 229 0` | `#FEE500` | 카카오 로그인 버튼 |
| `--c-rank-s` | `217 70 239` | `#D946EF` | S등급 전용 (fuchsia-500) |

### 1-2. Semantic Mapping

| 시맨틱 변수 | 매핑 대상 | Tailwind 클래스 |
|-------------|-----------|-----------------|
| `--bg-primary` | `--c-dark-bg` | `bg-background-primary` |
| `--bg-secondary` | `--c-dark-surface` | `bg-background-secondary` |
| `--bg-tertiary` | `--c-dark-elevated` | `bg-background-tertiary` |
| `--text-primary` | `--c-text-main` | `text-text-primary` |
| `--text-secondary` | `--c-text-sub` | `text-text-secondary` |
| `--text-tertiary` | `--c-text-muted` | `text-text-tertiary` |
| `--primary` | `--c-brand` | `bg-primary`, `text-primary` |
| `--primary-hover` | `--c-brand-hover` | `bg-primary-hover` |
| `--border-default` | `--c-dark-elevated` | `border-border` |

### 1-3. 오행 색상 (Saju Element Colors)

각 오행에 원색(vivid)과 다크 UI 조화용 뮤트(muted) 두 벌이 있음.

| 오행 | 원색 RGB | Hex | Muted RGB | Hex | Tailwind(원색) | Tailwind(뮤트) |
|------|----------|-----|-----------|-----|----------------|----------------|
| 목(木) | `34 197 94` | `#22C55E` | `110 185 130` | `#6EB982` | `saju-wood` | `saju-wood-muted` |
| 화(火) | `239 68 68` | `#EF4444` | `210 120 115` | `#D27873` | `saju-fire` | `saju-fire-muted` |
| 토(土) | `234 179 8` | `#EAB308` | `195 170 90` | `#C3AA5A` | `saju-earth` | `saju-earth-muted` |
| 금(金) | `228 228 231` | `#E4E4E7` | `195 195 205` | `#C3C3CD` | `saju-metal` | `saju-metal-muted` |
| 수(水) | `59 130 246` | `#3B82F6` | `115 155 210` | `#739BD2` | `saju-water` | `saju-water-muted` |

**사용 패턴** (SajuChart, ShinsalBadges):
- 사주 셀 배경: `bg-saju-{element}/8`
- 사주 셀 테두리: `border-saju-{element}/15`
- 사주 셀 텍스트: `text-saju-{element}-muted`
- 신살 배지(길신): `bg-saju-wood/10 text-saju-wood-muted border-saju-wood/20`
- 신살 배지(흉살): `bg-saju-fire/10 text-saju-fire-muted border-saju-fire/20`
- 신살 배지(중성): `bg-background-tertiary text-text-secondary border-white/10`

### 1-4. 등급별 색상 (Grade Colors)

ResultTable에서 사용하는 등급별 스타일:

| 등급 | 배경 | 텍스트 |
|------|------|--------|
| **S** | `bg-primary-rank-s/15` | `text-primary-rank-s` |
| **A** | `bg-primary/15` | `text-primary` |
| **B** | `bg-saju-wood/10` | `text-saju-wood-muted` |
| **C** | `bg-saju-earth/10` | `text-saju-earth-muted` |
| **D** | `bg-background-secondary` | `text-text-secondary` |

상태 배지 (`무료/잠금/언락`):

| 상태 | 클래스 |
|------|--------|
| 무료 | `bg-background-tertiary text-text-secondary` |
| 잠금 | `bg-primary/15 text-primary` |
| 언락 | `bg-saju-wood/10 text-saju-wood-muted` |

### 1-5. 배틀 전용 색상

| 역할 | Hex | 용도 |
|------|-----|------|
| Player A (甲) | `#FF6B6B` | 레이더 차트, 점수바, 이름 라벨 |
| Player B (乙) | `#A855F7` | 레이더 차트, 점수바, 이름 라벨 |

### 1-6. 알파 컨벤션

코드 전반에서 반복되는 알파 패턴:

| 패턴 | 용도 |
|------|------|
| `white/5` | 매우 약한 구분선 (섹션 내부) |
| `white/8` | 카드 테두리 |
| `white/10` | 일반 테두리, 비활성 뱃지 테두리 |
| `white/12` | 차트 가이드라인 |
| `primary/12` ~ `primary/15` | 등급 카드 배경 틴트, 차트 채움 |
| `primary/55` | 레이더 차트 데이터 선 |
| `black/45` | 잠금 오버레이 |

---

## 2. 타이포그래피 (Typography)

### 2-1. 폰트 패밀리

| 이름 | 스택 | 용도 |
|------|------|------|
| **Pretendard** (본문) | `"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif` | body 기본 |
| **SBAggroM** (제목) | `"SBAggroM", "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif` | `.font-aggro` 클래스로 적용 |

- Pretendard: CDN import (`cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9`)
- SBAggroM: CDN @font-face (`fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2108@1.1`)

### 2-2. 사이즈 체계 (Major Third 1.25 Scale)

Tailwind `extend.fontSize`에 정의:

| 토큰 | 사이즈 | line-height | weight | 실사용 위치 |
|-------|--------|-------------|--------|-------------|
| `display` | 38px | 1.2 | 700 | (미사용 — 예비) |
| `title-1` | 30px | 1.3 | 600 | (미사용 — 예비) |
| `title-2` | 24px | 1.35 | 600 | 로딩/에러 페이지 제목, SectionBody hookLine |
| `title-3` | 19px | 1.4 | 600 | 헤더 브랜드명, 카드 내부 제목, 섹션 타이틀 |
| `body-1` | 19px | 1.6 | 400 | (미사용 — 예비) |
| `body-2` | 15px | 1.65 | 400 | 본문 보조, 설명 텍스트, 에러 메시지 |
| `caption` | 12px | 1.5 | 400 | 상태 배지, 라벨, 신살 제목, 푸터 |
| `button-lg` | 19px | 1 | 600 | (미사용 — 예비) |
| `button-md` | 15px | 1 | 600 | CTA 버튼 텍스트, 로그인 버튼 |
| `button-sm` | 12px | 1 | 500 | 옵션 버튼, 소형 버튼 |
| `question` | 28px | 1.3 | 600 | (CSS 전용 — `.text-question`) |
| `step` | 14px | 1.4 | 400 | 진행도 인디케이터 |

### 2-3. 하드코딩 사이즈 (토큰 미사용)

컴포넌트에서 직접 `text-[Npx]` 형태로 쓰는 패턴:

| 사이즈 | 용도 |
|--------|------|
| `text-[32px]` ~ `text-[40px]` | 랜딩 섹션 제목 (`font-aggro`) |
| `text-[28px]` | 사주 셀 글자 (천간/지지) |
| `text-[24px]` | 스텝 질문 제목 (`font-aggro`) |
| `text-[20px]` | 배틀 결과 헤드 판정문 |
| `text-[18px]` | 메뉴 카드 제목, 체크아웃 리드 |
| `text-[16px]` | 섹션 본문, tier description, 랜딩 본문 |
| `text-[15px]` | CTA 버튼, 입력 필드, 다수 본문 |
| `text-[14px]` | 보조 라벨, dl 항목, 프로그레스 |
| `text-[13px]` | 힌트, 에러, 신살 배지, 배틀 카드 내부 |
| `text-[12px]` | 칩, 뱃지 라벨, 입력 필드 라벨 |
| `text-[11px]` | 분포 차트 라벨, 배틀 강도 배지 |
| `text-[10px]` | 분포 차트 퍼센트 |

### 2-4. CSS 전용 클래스

| 클래스 | 정의 |
|--------|------|
| `.text-step` | `14px`, `lh 1.4`, `text-secondary`, `mb-12px` |
| `.text-question` | `32px`, `weight 500`, `lh 1.3`, `text-primary`, `mb-32px` |

---

## 3. 레이아웃 (Layout)

### 3-1. 페이지 셸

```
max-width: 640px (mx-auto)
페이지 배경: bg-background-primary (#09090B)
min-height: min-h-screen 또는 h-[100dvh]
```

### 3-2. 헤더

```
패딩: px-5 py-5 또는 px-6 py-5
포지션: sticky top-0 z-[100]
배경: bg-background-primary (불투명) 또는 bg-transparent → bg-white/[0.08] backdrop-blur-md (스크롤시)
하단선: border-b border-white/5 (결과 페이지) 또는 없음
내부: max-w-[640px] mx-auto flex items-center justify-between
좌측: 뒤로가기(w-10 h-10) 또는 빈 div(w-10)
중앙: text-title-3 font-aggro
우측: MenuDrawer
```

### 3-3. 카드

| 유형 | 클래스 | 용도 |
|------|--------|------|
| **기본 카드** | `rounded-2xl bg-background-secondary p-5 space-y-2` | 입력 정보 확인, 일반 정보 카드 |
| **등급 카드** | `rounded-3xl p-6 md:p-8 border border-white/8 {gradeStyle.background}` | 종합등급 |
| **차트 카드** | `bg-background-secondary rounded-3xl p-6 md:p-8 border border-white/8` | 레이더 차트, 꽃잎 차트 |
| **섹션 아코디언** | `bg-background-secondary rounded-2xl border border-white/8 overflow-hidden` | 결과 섹션 |
| **메뉴 카드** | `rounded-2xl border border-white/10 bg-zinc-900` | 메뉴 선택 카드 |

### 3-4. 카드 Radius 규칙

| 크기 | 토큰 | 사용처 |
|------|------|--------|
| `rounded-xl` (12px) | — | 입력 필드, 버튼, 소형 카드 |
| `rounded-2xl` (16px) | — | 일반 카드, 섹션 아코디언, 메뉴 카드 |
| `rounded-3xl` (24px) | — | 등급 카드, 차트 카드 (주요 컨테이너) |
| `rounded-full` | — | 배지, 칩, 등급 원형 슬롯, 프로그레스 바 |
| `rounded-[24px]` | — | 랜딩 이미지 플레이스홀더 |

### 3-5. 간격 체계

| 패턴 | 값 | 용도 |
|------|-----|------|
| **섹션 간 간격** | `space-y-6` (24px) | 결과 메인 콘텐츠 |
| **아코디언 간 간격** | `space-y-4` (16px) | 섹션 리스트 |
| **카드 내부 패딩** | `p-5` (20px) 또는 `p-6 md:p-8` (24px/32px) | 일반 카드 / 대형 카드 |
| **메인 콘텐츠 패딩** | `px-5` 또는 `px-6` | 좌우 여백 |
| **메인 상단 여백** | `pt-10` (40px) | 헤더 아래 콘텐츠 시작 |
| **하단 여백** | `pb-12` ~ `pb-48` | 하단 고정 바 회피 |

### 3-6. 하단 고정 바

```
fixed left-0 right-0 bottom-0 z-[120]
bg-background-primary
px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]
내부: max-w-[640px] mx-auto
```

키보드 대응 (start/page, battle/input):
```
transition-[bottom] duration-150 ease-out
style={{ bottom: `${keyboardOffset}px` }}
```

### 3-7. z-index 스택

| z값 | 용도 |
|-----|------|
| `z-[100]` | 일반 sticky 헤더 |
| `z-[120]` | 하단 고정 CTA 바, sticky 헤더 (landing) |
| `z-[130]` | 랜딩 하단 CTA (그라디언트 페이드) |

---

## 4. 버튼 (Buttons)

### 4-1. Primary (`.btn-primary`)

```css
background-color: rgb(var(--primary));  /* #F43F5E */
color: rgb(var(--text-primary));        /* white */
border: none;
```

호버: `background-color: rgb(var(--primary-hover))` (#FB7185)
비활성: `background-color: rgb(var(--bg-tertiary))` (#27272A) + `color: rgb(var(--text-tertiary))` + `cursor: not-allowed`

**인라인 사용 예시:**
```
btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200
```

### 4-2. Option (`.btn-option`)

```css
background-color: rgb(var(--bg-tertiary));  /* #27272A */
color: rgb(var(--text-primary));
border: none;
```

선택됨 (`.btn-option--selected`):
```css
background-color: rgb(var(--primary));  /* #F43F5E */
color: rgb(var(--text-primary));
```

**인라인 사용 예시:**
```
btn-option w-full py-4 rounded-xl text-button-md transition-all duration-200 active:scale-[0.98]
```

선택 시 추가: `btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]`

### 4-3. Secondary / Ghost (인라인 패턴)

명시적인 `.btn-secondary` 클래스는 없음. 인라인으로 조합:

```
// Secondary
border border-white/10 bg-background-secondary text-text-secondary hover:bg-background-secondary/80

// Ghost (뒤로가기 등)
w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors
```

### 4-4. 카카오 로그인 버튼

```
w-full h-[54px] rounded-xl bg-primary-kakao text-black text-[15px] font-semibold
flex items-center justify-center gap-2
```

### 4-5. 칩/태그 (Pill)

```
rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary
```

또는 (메뉴 페이지):
```
rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400
```

---

## 5. 입력 필드 (Inputs)

globals.css에서 전역 스타일링 (`!important`):

```css
background-color: rgb(var(--bg-secondary));    /* #18181B */
color: rgb(var(--text-primary));               /* white */
border: 1px solid rgb(var(--border-default));  /* #27272A */
border-radius: 12px;
padding: 16px;
```

포커스: `border-color: rgb(var(--primary))` (#F43F5E)
플레이스홀더: `color: rgb(var(--text-tertiary))` (#8C8C96)

**인라인 사용 예시:**
```
w-full text-[15px] h-[52px]
```

### 양력/음력 토글 버튼

```
h-11 rounded-xl text-[15px] font-semibold transition-colors
// 선택: bg-primary text-white
// 미선택: bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80
```

---

## 6. 애니메이션 & 인터랙션 (Animation & Interaction)

### 6-1. 전역 키프레임 (globals.css)

| 이름 | 효과 | 클래스 |
|------|------|--------|
| `slideIn` | `translateX(100%) → 0`, 300ms ease-out | `.animate-slideIn` |
| `fadeIn` | `opacity: 0 → 1`, 300ms ease-out | `.animate-fadeIn` |

### 6-2. 차트 애니메이션 (JS + rAF)

| 컴포넌트 | 이징 | 시간 | 비고 |
|----------|------|------|------|
| CategoryRadarChart | `easeOutCubic` | 480ms | 중심→확장 |
| CategoryPetalChart | `easeOutCubic` | 520ms + 60ms stagger | 꽃잎 순차 |
| ScoreGrid | `easeOutCubic` | 820ms + 60ms stagger | 게이지 순차 |
| OverallDistributionChart | CSS `stroke-dashoffset` | 900ms | 곡선 드로잉 |
| BattleRadarChart | `easeOutCubic` | 480ms | 이중 레이더 확장 |

모든 차트에 `prefers-reduced-motion: reduce` 대응 (즉시 완료).

### 6-3. 인터랙션 패턴

| 패턴 | 클래스 | 사용처 |
|------|--------|--------|
| **버튼 누름 피드백** | `active:scale-[0.98]` | 옵션 버튼, 선택 버튼 |
| **호버 트랜지션** | `transition-colors duration-200` | 대부분의 버튼 |
| **전체 트랜지션** | `transition-all duration-200` | CTA 버튼, 강조 요소 |
| **아코디언 열기/닫기** | `grid transition-[grid-template-rows] duration-300 ease-out` | SectionList |
| **프로그레스 바 채움** | `transition-all duration-500 ease-out` | 스텝 인디케이터 |
| **키보드 올라옴** | `transition-[bottom] duration-150 ease-out` | 하단 고정 바 |
| **셰브론 회전** | `transition-transform` + `rotate-180` | 아코디언 화살표 |
| **스크롤 헤더** | `transition-all duration-300` | 랜딩 헤더 (투명→블러) |

### 6-4. 로딩 스피너

```
w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin
```

소형 (메뉴):
```
w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin
```

---

## 7. 컴포넌트별 고유 패턴

### 7-1. OverallGradeBadgeSlot

- 원형 슬롯: `rounded-full`, 기본 152px (96~220px 범위 클램프)
- 배경: `bg-background-primary/30`
- 그림자: `shadow-[0_12px_34px_rgba(0,0,0,0.38)]`
- 링: `ring-1 ring-white/10`
- 내부 글로우: `bg-primary/12 blur-2xl` (-inset-8)
- 등급별 그라디언트 (`bg-gradient-to-br`):
  - S: `from-primary/20 via-white/8 to-primary/12`
  - A: `from-primary/14 via-white/6 to-primary/8`
  - B: `from-white/12 via-white/6 to-white/4`
  - C: `from-white/10 via-white/5 to-white/2`
  - D: `from-white/9 via-white/4 to-white/1`
- 등급 글자: `text-[52px] font-extrabold tracking-[-0.03em] text-white/80`

### 7-2. SectionHeader (아코디언)

```
w-full px-6 py-5 flex items-center justify-between
hover:bg-white/[0.03]
active:bg-white/[0.06]
```

아이콘: `text-3xl`
제목: `text-title-3 text-text-primary`
셰브론: `w-5 h-5 text-text-secondary`

### 7-3. SectionBody

- 일반 본문: `text-[16px] text-text-primary leading-[1.75] whitespace-pre-wrap`
- 구조화된 블록:
  - hookLine: `text-title-2 text-text-primary line-clamp-2`
  - 라벨: `text-caption text-text-tertiary tracking-[0.08em] uppercase`
  - 본문: `text-[16px] text-text-primary leading-[1.75]`
- 잠금 블러: `blur-sm select-none pointer-events-none` 위에 `bg-black/45` 오버레이

### 7-4. 랜딩 페이지

- 섹션 글로우:
  - brand: `radial-gradient(circle at 50% 0%, rgba(var(--primary), 0.22), transparent 62%)`
  - neutral: `radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 62%)`
- 이미지 플레이스홀더: `rounded-[24px] border border-white/10 bg-zinc-900`
  - 좌상단 orb + 우하단 orb (radial-gradient, blur-3xl)
- 하단 CTA 그라디언트: `bg-[linear-gradient(0deg,rgba(0,0,0,1) 0%,rgba(0,0,0,1) calc(70px+env(safe-area-inset-bottom)),rgba(0,0,0,0) 100%)]`

### 7-5. SajuChart (만세력 4주)

- 그리드: `grid grid-cols-4 gap-2.5`
- 라벨 셀: `px-4 py-3 text-center text-[14px] text-text-tertiary bg-background-primary rounded-xl`
- 천간/지지 셀: `px-2 py-3 text-center rounded-xl` + 오행 bg/border/text 클래스
  - 글자: `text-[28px] font-semibold`
  - 오행명: `text-[12px] text-text-secondary mt-1`
- 십성 셀: `px-4 py-3 text-center text-[14px] text-text-secondary bg-background-primary rounded-xl`

### 7-6. 프로그레스 바

```
트랙: flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden
채움: h-full bg-primary rounded-full transition-all duration-500 ease-out
라벨: text-[14px] text-text-secondary
```

---

## 8. 반응형 (Responsive)

단일 브레이크포인트 전략:

| 브레이크포인트 | 사용 |
|----------------|------|
| `md:` (768px+) | 카드 패딩 증가 (`p-6 md:p-8`) |
| `sm:` (640px+) | 랜딩 이미지 높이/orb 크기 증가 |
| `lg:` (1024px+) | 랜딩 이미지 높이 (`lg:h-[340px]`) |

실질적으로 **모바일 퍼스트** 설계이며, `max-w-[640px] mx-auto`로 데스크톱에서도 모바일 너비를 유지.

---

## 9. 접근성 (Accessibility)

| 패턴 | 구현 |
|------|------|
| `aria-label` | 차트, 네비게이션 버튼 |
| `aria-expanded` / `aria-controls` | 아코디언 섹션 |
| `aria-hidden="true"` | 장식 아이콘, SVG |
| `role="radiogroup"` / `role="radio"` / `aria-checked` | 선택 옵션 그룹 |
| `role="progressbar"` / `aria-valuenow` | 프로그레스 바 |
| `prefers-reduced-motion` | 모든 차트 애니메이션 |
| `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40` | 메뉴 카드 포커스 링 |

---

## 10. 요약 치트시트

```
배경:     bg-background-primary → #09090B
카드:     bg-background-secondary rounded-2xl border border-white/8 p-5
대형카드:  bg-background-secondary rounded-3xl p-6 md:p-8 border border-white/8
텍스트:   text-text-primary(흰) / text-text-secondary(회) / text-text-tertiary(연회)
액센트:   bg-primary(#F43F5E) / text-primary
제목:     font-aggro text-title-3
본문:     text-[16px] text-text-primary leading-[1.75]
보조:     text-[14px] text-text-secondary
CTA:     btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold
옵션:     btn-option rounded-xl py-4 text-button-md active:scale-[0.98]
max-w:   640px
헤더 z:   z-[100]
CTA 바 z: z-[120]
```
