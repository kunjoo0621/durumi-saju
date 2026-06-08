# 배틀 톤 정렬 — 개인사주(메인)와 일치 (A+B+C안)

- 날짜: 2026-06-06
- 파일: `lib/battle-prompt.ts` → `BATTLE_SYSTEM_PROMPT` [톤 규칙 — 절대 준수] 블록
- 배경: 개인사주(메인 상품)와 톤 정렬. 개인사주는 모욕 금지를 3겹으로 못박음
  (`lib/analysis.ts:1274` "단 모욕/비하/조롱도 금지", `:1379` "팩폭은 행동 패턴과 구조적 취약점만 공격",
  `:1448` "인격이 아닌 패턴 공격"). 배틀은 모욕 금지가 punchline 공통규칙(`:283`)에만 걸려 있어
  detail·chemistry·categoryResults 본문에 "노예 계약·감정 쓰레기통·포식 관계·한심한" 등이 노출됨.

## 변경 내용 (추가)

`- 명리 용어 사용 시 즉시 번역` 줄 다음에 ★ 규칙 신설:

```
★ 모욕/비하/조롱 금지 (전역 — killingLine·detail·analysis·simulations·finalVerdict 등 모든 섹션):
냉정/팩폭은 기본값이되, 모욕/조롱/비하/혐오 표현은 금지. 팩폭은 '행동 패턴과 구조적 취약점'만 공격하고 인격을 공격하지 마.
- 금지 예: "노예 계약", "감정 쓰레기통", "포식 관계", "한심한", "답이 없다", "쓸모없다", "구제불능" 등 인격·존재를 깎는 표현.
- 대체: 같은 약점을 사주 구조로 직설 — "받기만 하고 안 주는 구조야", "한쪽이 계속 맞춰주다 폭발하는 패턴이지".
- 패자를 깎되 사람이 아니라 그 사람 사주의 '구조'를 깐다. 승자에게도 약점을 짚는 건 유지.
```

## 이전 버전과의 차이

- 추가만. 기존 규칙 삭제/수정 없음.
- punchline 한정이던 모욕 금지(`:283` "인신공격/모욕 금지")를 본문 전역으로 승격.
- "승자에게도 약점 짚기"(`:78`)는 유지 — 모욕 금지가 약점 지적까지 무르게 만들지 않도록 명시.

## B안 — 한자→일상번역 규칙 강화 (적용)

`lib/battle-prompt.ts` 기존 한 줄("명리 용어 사용 시 즉시 번역")을 개인사주 `analysis.ts:1380-82`
표준으로 승격. 병기 후 같은 문장 안에서 즉시 번역 필수 + ✅/❌ 예시. 섹션별 정책 명문화:
- punchline·killingLine = 한자 0개 (캡처용, 즉시 읽힘) — 기존 정책 유지
- chemistry.analysis = 병기 2~3개 이내 최소화 — 기존 정책 유지
- detail 등 prose = 병기 + 즉시번역 (이전엔 병기만 허용·번역 강제 없어 raw 한자 누출)

## C안 — 한자 병기 dedup 후처리 이식 (적용)

`lib/battle-postprocess.ts`에 `dedupHanjaAnnotation` 미러링 (출처: `surgical-rewrite.ts:1138`,
동일 로직 8줄 순수함수). surgical-rewrite는 analysis.ts(Gemini SDK)를 import하므로 린한
battle-postprocess엔 import 대신 복제 + 출처 주석. 적용 필드(섹션 단위, 첫 등장만 병기):
categoryResults.detail × 5, chemistry.analysis, bonusScenarios.analysis, simulations.reasoning,
finalVerdict.verdictA/verdictB/verdict. punchline/killingLine·futureOutlook는 제외(각각 한자 0개·전량제거).

## 검증 계획

배틀 5건 재생성 → ①모욕 표현 0건 ②detail에 raw 미번역 한자 0건 ③같은 한자 반복 병기 0건
④승패 대비 강도 유지 확인. tsc --noEmit 통과 확인 완료. 배포는 운영자 확인 후.
