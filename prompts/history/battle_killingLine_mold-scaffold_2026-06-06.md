# 배틀 killingLine — mold scaffold (개인사주 v1.5 방식 이식)

> ⚠️ **폐기됨 (2026-06-06).** mold 5종 중 3종이 같은 "두 마디 대비" 가족이라
> 운영자가 "안 웃기다"고 반려. 후속: `battle_killingLine_concrete-image_2026-06-06.md`
> ("구체 이미지 한 컷" 단일 룰 + 추상 대비 게이트).

날짜: 2026-06-06
대상: `lib/battle-prompt.ts`, `lib/battle-postprocess.ts`, `lib/surgical-rewrite.ts`

## 왜 바꿨나

killingLine(캡처용 제일 중요한 한 줄)이 전부 `"A가 ~할 때 B는 ~해"` 한 템플릿으로
붕괴해 밋밋했다. 근본 원인은 개인사주 tier.title이 v1.5 이전에 겪던 것과 동일 —
**모델이 "구조를 다양하게 써라"는 프롬프트 룰을 ~75%만 따른다.** 배틀은 룰만 있고
서버 결정론 주입이 없어 디폴트 템플릿으로 흘렀다.

개인사주는 `analysis.ts:buildTitleDirective`(v1.5)에서 서버가 분야·등급밴드·비유 각도를
결정론적으로 계산해 주입함으로써 이 문제를 해결했다. 같은 방식을 배틀에 이식.

## 무엇을 바꿨나

### 1) `battle-prompt.ts` — mold scaffold (주입)
- `KILLINGLINE_MOLDS` 5종 정의: 반전형 / 과장형 / 디테일형 / 시간역전형 / 역설형.
- `shuffleMoldsDeterministic(seed)`: Park-Miller LCG 기반 Fisher-Yates. 매치업
  (`nameA+nameB+composite`)마다 다른 배정, **5개 mold 전부 1회씩(중복 0) 보장.**
- `buildKillingLineMoldDirective()`: 5개 카테고리에 서로 다른 mold를 배정해
  `[killingLine 구조 배정 — 서버 결정론값]` 블록으로 `buildBattleUserInfo` 프롬프트에 주입.

### 2) `surgical-rewrite.ts` — 구조 붕괴 탐지 → 리라이트 (최우선)
- `detectKillingLinePattern`에 구조 기반 체크 추가(어미·유사도 체크보다 우선).
- 마스킹 후 `__NAME__ … (때|동안) … __NAME__` 동시대비 대구를 카운트.
- '디테일형' mold 하나는 본래 동시대비를 쓰므로 1개는 정상 → **3개 이상**(프롬프트 규칙 3과
  동일 기준)일 때만 붕괴로 보고 2번째부터 리라이트.

### 3) `battle-postprocess.ts` — 모니터링 경고 + killingLine 한자 전면 제거
- `detectKillingLineTemplate`: 동일 동시대비 대구 ≥3 시 `[WARN]` 로깅(관찰용).
- `stripHanjaForCapture`: killingLine은 spec상 "한자 0개" 강제 →
  `정재(正財) 기운`→`정재 기운`, 잔여 단독 한자도 제거. (dedup이 아닌 전면 strip)

## 검증 (Next 런타임, 실제 Gemini 생성 2커플)

**로직(결정론):** directive 주입 ✓ / 5 mold distinct ✓ / 같은 입력 동일배정 ✓ /
다른 매치업 다른배정 ✓ / 합성 대구 5줄 → 탐지·타겟 4 ✓ / 다양 5줄 → 오탐 0 ✓

**실제 생성:** 두 커플 모두 5개 killingLine이 배정 mold대로 **구조적으로 전부 다르게** 생성.
동시대비 대구 0~1/5(붕괴 해소), 한자 누출 0/5.

예) 과장형 "서연이 쇼핑 리스트는 지구 한 바퀴 돌고도 남을 기세야" /
    반전형 "민준이가 이겼는데 정작 야근 독박 쓰는 건 민준이야" /
    시간역전형 "지금은 서연이가 갑인데 2031년엔 민준이도 발톱 드러내"

## 미적용/잔존
- LLM 품질 blip(이름 조사 어색 등)은 mold와 무관, 기존 fixNameVariations 영역.
- teaser 경로엔 미적용(개인사주와 동일하게 본 경로 우선).
