# 사주 매거진(`/stories`) 글 발행 체크리스트

> 글 1편을 추가·수정·머지하기 전 반드시 통과해야 하는 항목.
> 누락된 항목은 PR description에 사유 명시.

---

## 핵심 원칙

**stories의 목적은 트래픽이 아니라 `/start` 전환**.
모든 항목은 이 목적의 도구. 아래 항목 중 SEO·콘텐츠 품질 항목도
"검색에서 만난 사용자를 사주 보기까지 끌고 가는가" 기준으로 평가.

---

## 1. 전환 가드 (가장 중요 — 매 글 동일 적용)

- [ ] **Floating CTA**: `app/stories/layout.tsx`에 항상 마운트되어 모든 글에서 우하단에 노출. 신규 글에는 별도 작업 불필요 — 레이아웃에서 자동.
- [ ] **Above-the-fold soft CTA**: 본문 페이지 헤더(H1 + excerpt + 메타) 직후 한 줄 텍스트 링크. 스크롤 0%에서 CTA 보이게.
- [ ] **Mid-article CTA (`ctaAfter`)**: 자기진단 모먼트(체크리스트 노출 또는 패턴 공개) **직후** 섹션 인덱스로 설정. 단순 정보 섹션 뒤가 아니라 "내 얘기네"하는 순간 뒤가 정답.
- [ ] **End-of-article CTA**: 본문 끝 카드(자동 렌더). 카피는 글 결말과 자연스럽게 이어지는 한 문장.
- [ ] **CTA 라우팅 일치**: 글 주제와 CTA 목적지가 일치하는지 확인.
  | 글 주제 | CTA href |
  |---|---|
  | 사주 일반 / 등급 / 재물·연애·일운 분석 | `/start` |
  | 올해 운 / 운의 흐름 / 신년·세운 / 꿈 |
  → 동시기 흐름 강조 글 | `/yearly/input` |
  | 두 사람 궁합 / 비교 | `/battle/input` |

- [ ] **CTA tone**: 글 카테고리와 `StoryCTA.tone` 매칭.
  - 재물·돈 → `earth` (노랑)
  - 연애·궁합 → `love` (핑크)
  - 사주 일반·꿈 → `brand` (코랄)

---

## 2. 콘텐츠 품질

- [ ] **현실 고민으로 시작**: `intro` 첫 문장은 사용자가 자기 얘기로 느낄 일상 문제. "월급은 나쁘지 않은데 통장이 안 채워지면…" 류.
- [ ] **짧은 결론 먼저**: 첫 섹션 헤딩은 "결론부터 — XXX이에요" 또는 "결론부터 — XX에 답이 있어요" 패턴.
- [ ] **체크리스트 ≥ 1개**: `kind: "checklist"` 블록 1개 이상. 사용자 자기진단 도구.
- [ ] **표 또는 콜아웃 ≥ 1개**: `kind: "table"` 또는 `kind: "callout"`. 시각 분리.
- [ ] **사주 용어 노출 최소화**: 첫 등장 시 괄호 안 짧게 풀이. 예: `재성(돈을 상징하는 글자)`. 같은 글 두 번째 등장부터는 풀이 생략. → 메모리 `feedback_durumi_saju_jargon` 참조.
- [ ] **한자 사용 최소화**: 본문 한자 자제. 꼭 필요하면 `충(沖)` 같이 1회 병기. 한자만 단독 노출 금지. → 메모리 `feedback_shorts_no_hanja` 톤 참고.
- [ ] **분량**: 1,500–3,000자 (intro + 모든 sections.blocks 합산 글자수).
- [ ] **MZ 슬랭 회피**: 35-54세 여성 타깃. 보편적 표현 사용. → 메모리 `feedback_durumi_youtube_audience` 참조.

---

## 3. SEO 기본

- [ ] **`title`**: ≤30자 (모바일 SERP 노출 임계). 검색 키워드를 자연스럽게 포함.
- [ ] **`excerpt`**: 1문장. SERP description 후보. 검색어 변형 포함.
- [ ] **`keywords`**: 5개 이상. 띄어쓰기 변형 포함 (예: `뱀 꿈 해몽`과 `뱀꿈` 둘 다).
- [ ] **`slug`**: 영문 케밥 케이스 (`snake-dream`, `dombok-saju`). URL 인코딩 이슈 회피.
- [ ] **`publishedAt`·`updatedAt`**: 절대 날짜 (`YYYY-MM-DD`). 발행일·수정일 명확히.
- [ ] **`related`**: 같은 시리즈 또는 인접 시리즈에서 2–3개 슬러그. 내부 링크 자산.
- [ ] **`category`**: `saju` | `dream` | `love` 중 하나. 시리즈 페이지에서 노출됨.

---

## 4. 기술 검증

- [ ] `lib/stories/data/{slug}.ts` 생성.
- [ ] `lib/stories/registry.ts` `STORIES` 배열에 import + 등록.
- [ ] `npx tsc --noEmit` 통과.
- [ ] `npx next build` 통과. 빌드 로그에서 `/stories/[slug]` 정적 생성 목록에 새 슬러그 포함 확인.
- [ ] dev 서버에서 시각 검증:
  - 모바일(390×844) `/stories/{slug}`
  - 모바일(390×844) `/stories/series/{category}` — 노출 확인
  - 모바일(390×844) `/stories` — 새 글이 hero 또는 최신에 노출 확인
- [ ] sitemap 자동 등록 확인 (`app/sitemap.ts`가 `getAllStories()` 호출).
- [ ] JSON-LD 출력 확인 (브라우저 devtools에서 `Article` + `BreadcrumbList` 둘 다).

---

## 5. 시리즈 일관성

- [ ] `STORY_CATEGORY_HANDLE`에 카테고리 매핑되어 있음.
- [ ] 시리즈 페이지(`/stories/series/[category]`)에서 새 글 노출 확인.
- [ ] 본문 브레드크럼이 `두루미 매거진 › {시리즈} › {글 제목}` 4단으로 보임.

---

## 발행 후 (운영자 트랙)

- [ ] Naver Search Advisor에 새 URL 수동 제출 (또는 sitemap ping).
- [ ] Google Search Console에 새 URL 수동 제출.
- [ ] Naver 블로그 채널에 요약본 + 본문 링크 cross-post.
- [ ] 카카오톡·인스타·X에 OG 이미지 + 한 줄 후크로 공유.

> 이 4개는 한 번씩 안 하면 **검색 노출 가속이 안 됨**.
> 검색 잘 되는 사이트의 본질이 여기에 있음.

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-23 | 초기 체크리스트 작성. 전환 가드(Floating·Above-fold·Mid·End CTA) 4중 가드 명시. |
