# 통합 허브 — 자체 디자인 규칙 (Astryx 대체, 전 섹션 통일용)

외부 디자인 시스템을 쓰지 않으므로, 아래 규칙을 **모든 섹션·컴포넌트가 예외 없이** 따른다. 타이트사주처럼 "적은 색·적은 보더·큰 여백·일관된 위계"가 목표.

## 1. 타이포 (역할당 딱 1개 스타일)
| 역할 | 스타일 | 비고 |
|---|---|---|
| 섹션 eyebrow | `text-[12px] font-medium text-text-tertiary` | 모든 섹션에 1줄 |
| 섹션 제목 | `font-aggro text-[22px]` | **두루미체는 여기 + 포스터 박힌 제목에만** |
| "전체 보기" 링크 | `text-[13px] text-text-secondary` | 목록 있는 섹션만 우측 |
| 콘텐츠/카드 제목 | `text-[16px] font-bold text-white leading-[1.35] break-keep` | **Pretendard**(두루미체 아님) — 가독성 |
| 메타·캡션 | `text-[12.5px] text-text-tertiary` | 분류·시간·조회 |
| 가격 | `text-[14px] font-bold` + `Egg` 아이콘 | 색 없음(무지개 제거) |

## 2. 색 (단색 + 포인트 1개 · 하드코딩 금지)
- **모든 색은 DS 토큰만 사용. 인라인 hex(`#RRGGBB`)·임의 색 금지.** (`bg-background-*`, `text-text-*`, `text-primary`, `bg-primary`, `bg-primary-kakao`, `bg-saju-wood` 등 tailwind.config 토큰)
- 바탕 다크(`background-primary`) + 흰/회색 글씨가 기본. **강조색은 `primary`(로즈) 하나**(활성 도트·CTA·로고 포인트).
- 서비스 chip은 색 없이 `text-text-secondary`(무지개 제거). 가격·제목도 색 안 씀.
- NEW 뱃지는 `bg-saju-wood`(DS 토큰) + `text-background-primary`.

## 2-1. 아이콘 (이모지 금지)
- **이모지(🥚🔥⌄ 등) 절대 금지. 아이콘은 `@phosphor-icons/react` 한 세트만.** (알=`Egg`, 인기/조회=`Fire`, 펼침=`CaretDown`, 메뉴=`List` 등)
- 목업 HTML에선 Phosphor SVG를 인라인, 실제 코드는 컴포넌트 import.

## 3. 보더·면 (거의 없음)
- 콘텐츠 카드에 **테두리(ring) 금지**. 면 구분은 여백으로. 필요한 최소 면만 `bg-white/[0.04]`.
- 이미지 슬롯 점선은 **플레이스홀더 표시일 뿐**(실제 이미지엔 테두리 없음).

## 4. 라운드 (3단계 고정)
- 포스터 `rounded-3xl` · 썸네일/카드 `rounded-2xl` · pill/버튼 `rounded-full`/`rounded-2xl`. 중첩 시 안쪽이 한 단계 작게.

## 5. 간격 (8px 그리드)
- 좌우 `px-5`(20). 섹션 사이 `pt-10`(40). 리스트 행 `py-3`. 그리드/레일 `gap-3`.

## 6. 컴포넌트 통일
- **가로 레일**(인기 콘텐츠·서비스): 제목줄 + `snap-x` 스와이프 + 옆 카드 peek + (인기만) 하단 도트. 동일 패턴.
- **리스트 행**(사전·매거진): `[썸네일 64 1:1 rounded-2xl] + [제목 bold + 메타]`. **숫자 없음** — 두 섹션 완전히 동일한 컴포넌트, 차이는 헤딩·메타 내용뿐.
- **모션**: 등장 fade+up, press `scale .97`, 스프링 이징 `cubic-bezier(.34,1.56,.64,1)`. reduced-motion 존중.

## 7. 이미지 슬롯 규격 (운영자 제공)
- 인기 콘텐츠 포스터 `4:5`(제목 이미지 포함) · 서비스 썸네일 `4:3` · 사전/매거진 썸네일 `1:1`.
