# 배틀 killingLine — "구체 이미지 한 컷" 단일 룰 + 추상 대비 게이트

날짜: 2026-06-06
대상: `lib/battle-prompt.ts`, `lib/surgical-rewrite.ts`, `lib/battle-postprocess.ts`
이전 버전: `battle_killingLine_mold-scaffold_2026-06-06.md` (mold 방식 — **폐기**)

## 왜 mold를 버렸나

같은 날 오전 mold scaffold(반전/과장/디테일/시간역전/역설 5종 서버 결정론 배정)를
넣었는데, 운영자 피드백: **"반전형 이런 게 재밌는지 모르겠어. ~~한데, ~~해 이게 뭐지."**

핵심 통찰: 5개 mold 중 3개(반전형 "~는데 정작~", 시간역전형 "지금은~ N년뒤엔~",
디테일형 "A가~ B는~")가 전부 같은 **"두 마디 대비"** 가족이었다 — 해결하려던 문제 그 자체.
웃김의 엔진은 *구조 슬롯*이 아니라 **"터무니없이 구체적인 사물·장면 한 컷"**(택배 상자,
손자 이름, 적금 통장)이다. → mold 전면 제거.

## 무엇을 바꿨나

### 1) `battle-prompt.ts` — killingLine SYSTEM_PROMPT 단일 룰
- mold scaffold(KILLINGLINE_MOLDS/shuffle/buildKillingLineMoldDirective 및 주입) 전부 제거.
- killingLine 섹션 = "구체 이미지 한 컷 의무 + 두 마디 대비 회피" 단일 룰로 재작성.
  - ✅ "민준이 통장은 서연이 택배 상자로 도배됐어"
  - ❌ "민준이가 이겼는데 정작 야근 독박은 민준이야" (그림 없음)

### 2) `surgical-rewrite.ts` — 진짜 블로커 버그 수정 + 추상 대비 게이트
- **★ 블로커 버그:** `callRewrite`의 `maxOutputTokens: 2048`. 모델이 gemini-2.5-flash
  (thinking)라 thinking 토큰이 2048을 다 먹어 실제 JSON이 MAX_TOKENS로 잘려 **배틀
  surgical-rewrite가 100% 실패**(`응답이 maxOutputTokens에서 잘림`)하고 있었다. 감지는
  되는데 고치는 손이 죽어 있던 것. → `16384`로 상향. (메인 분석은 32768이라 멀쩡했음)
- **이름 환각 가드 오탐:** `containsUnknownName`의 성씨 휴리스틱이 "이름/정작/조용히/
  심장은" 같은 평범한 단어를 성씨로 오인해 멀쩡한 killingLine 교정을 스킵. killingLine은
  A/B 이름이 항상 박혀 있고 12~30자라 제3 인물명 환각이 불가능 → killingLine 타겟 경로만
  `skipNameCheckPaths`에 추가.
- **추상 대비 게이트(detectKillingLinePattern):** "두 마디 대비" 골격 *자체*는 죄가 아님.
  양쪽 다 그림 있으면("서연 통장엔 숫자가 찍히는데 민준 통장엔 한숨만 찍혀") 통과.
  두 마디 골격 **+ 추상 판정어**(이겼/졌/유리/불리/우세/밀려/판정/정작/우열 …)가 같이
  있을 때만 붕괴로 보고 해당 줄 *전부*를 구체 한 컷으로 리라이트(threshold ≥1, slice 안 함).
  ※ 운영자 결정(2026-06-06): "구체 대비 허용, 추상 대비만 차단."

### 3) `battle-postprocess.ts` — 모니터링 게이트 동기화 + 한자 strip 유지
- `detectKillingLineTemplate`(경고 로깅 전용)도 동일하게 추상 판정어 게이트 적용.
- `stripHanjaForCapture`(killingLine 한자 전면 제거)는 유지 — 캡처용 spec "한자 0개".

## 검증 (Next dev, 실제 Gemini 3커플)

3커플(서연/민준 lover, 지우/도윤 friend, 하준/수아 couple) 실제 생성:
- **추상 대비 0/15** (차단 대상 박멸), 구체 두 절 대비 2~5/5 (허용), **한자 0/15**
- truncation 0, 이름가드 오탐 0, fetch 실패 0
- 줄 품질: "가벼운 눈인사만 건네도 민준은 벌써 애들 이름까지 다 지어놨어" /
  "수아가 결재판 던지면 하준이는 복사기 앞에서 떨고 있어" / "지우는 로또 번호만 맞추고 있어"

## 과정에서 드러난 환경 이슈 (코드 무관)
- Next dev 서버가 다회 무거운 배틀 생성 후 OOM으로 침묵 종료 → `--max-old-space-size=4096`.
- `.next` 캐시가 OOM 중단으로 깨져 `_document.js MODULE_NOT_FOUND` 500 → `rm -rf .next` 후 재기동.
- 검증 막판 Gemini `fetch failed`(다회 호출 후 일시적). 재기동 후 해소.

## 미적용/잔존
- 구조 편차: 매 생성마다 구체 두 절 대비 개수는 출렁임(허용이라 무방).
- teaser 경로 미적용(본 경로 우선).
