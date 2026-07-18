# 결혼운/애정운 심층 검사 — 프롬프트 v3

- 날짜: 2026-07-19
- 파일: `lib/marriage-prompt.ts` + `lib/marriage-facts.ts`
- 이전 버전: `prompts/history/marriage-v2.md`
- 관련: 재물운·결혼운 풍부화 Phase 3 (`docs/superpowers/plans/2026-07-19-wealth-marriage-enrich.md`)

## v2 → v3 변경점

### 1. 일지 지장간 본기/중기/여기 층위 구조화 (facts→프롬프트)
`marriage-facts.ts`에 `spousePalaceHidden: SpousePalaceHiddenStar[]` 신설 — 일지 지장간을
본기(겉으로 드러나는 결)/중기(속결)/여기(스치는 결) 층위로 구조화(BRANCH_INFO.jijanggan 인덱스
0/1/2). 기존 `spousePalaceHiddenStars: string[]`는 하위호환 유지(파생값).

`buildFactBlock`의 "일지 지장간" 라인을 층위 표기(`본기 편재 / 중기 정관 …`)로 교체. 절대 규칙 2
(차별화)에 "일지 지장간 층위 활용" 지시 추가 — partnerProfile에서 배우자상을 겉결→속결 층위로 풀게 함.

### 2. 긍정 예시 블록 추가
블록 구조 앞에 `[좋은 문장 예시]` 블록 신설 — 배우자궁(층위 활용)·배우자성(위치+시기)·타이밍
(연도+행동) 목표 해상도 예시(전부 반말).

### 3. 어투 반말 잔존 교정 (내용 스타일)
v2까지 "반말 100%" 규정에도 **허용 예시 문장 일부가 존댓말**로 남아 있었다("좋아요·높아요·구간이에요")
→ 반말로 교정(119, 128행). 금지 예시는 유지. 두루미 브랜드 목소리 일관성.

## 검증
- `marriage-facts.ts`/`marriage-prompt.ts` 소스 `npx next build` 성공.
- 유닛테스트는 @gracefullight/saju 어댑터 이슈로 이 환경에서 미실행 — build 타입체크 + 5명 사주
  실파이프라인 테스트로 검증 예정.
