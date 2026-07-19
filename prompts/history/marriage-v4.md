# 결혼운 심층 검사 — 프롬프트 v4

- 날짜: 2026-07-19
- 파일: `lib/marriage-prompt.ts` — `SYSTEM_RULES`
- 이전 버전: `prompts/history/marriage-v3.md`
- 관련: 배포 후 품질 1차 사이클(라이브 실측), 커밋 a18faf7

## v3 → v4 변경점

### 1. 블록 오프너 반복 금지
라이브 실측(강샛별 연애중)에서 partnerProfile·relationshipPattern이 둘 다 "지금 연애중이라면"으로
시작해 반복돼 보이던 문제 해소.
- SYSTEM_RULES에 규칙 추가: 여러 블록을 같은 문구로 시작하지 마라(특히 partnerProfile·
  relationshipPattern·spousePalace). 관계상태(솔로/연애중/기혼)는 필요할 때 문장 속에 한 번만
  자연스럽게 녹이고, 각 블록은 서로 다른 진입으로 시작.

## 검증
- `npx tsc --noEmit` 0 · `npx tsx --test --conditions=import lib/*.test.ts` 157/157 PASS
- fable 델타검증 머지가능(블로커 0) · 스키마 키(partnerProfile 등) 일치 확인
- 결제 라우트(`app/api/marriage/analyze`) 봉인구간 무접촉

## 참고 — 관련 타임라인 개선(별도 파일)
같은 사이클에서 `lib/fortune-timeline.ts`의 연속 같은-트리거 해 반복(2028·2029 동일 등)을 ALT 힌트
교차로 해소 + 트리거 없는 해의 십성별 문구는 marriage-v3 이전에 반영됨(fortune-timeline은 프롬프트가
아닌 결정론 서버 렌더라 프롬프트 히스토리와 별개).
