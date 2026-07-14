# 반려동물 궁합 프롬프트 v0.2 → v0.3 (판정문 콘텐츠 수술)

날짜: 2026-07-14
대상: `lib/pet-compat.ts` — `buildPetCompatSystemPrompt` / `buildPetCompatUserInfo` / `runPetCompatAnalysis`
      + `lib/pet-compat-postprocess.ts` (TROPE_BLACKLIST·validatePetCompatResult)
      + `lib/pet-compat-saju.ts` (buildPetSpec)
LLM: Gemini API (`gemini-2.5-flash`, temp 0.85) — Claude 아님
계획서: `docs/superpowers/plans/2026-07-14-pet-content-illustration.md`
커밋: 1d1762c(A1) · c384014(A2~A5) · ea73ec1(A6) · e61281b(A7)

## 왜 바꿨나

fable 독립 검수(같은 프롬프트로 개 2·고양이 1 생성) 결과, 판정문이 **어느 펫에나 똑같은
클리셰**였고 **명리 fabrication·계산오류**까지 있었다:
- 반복 트로프(실측): "집안 실세" 3/3, "사랑보다 밥/츄르" 3/3, "기준이 흐려지는 구조" 3/3,
  초인종·혼자있을때 시뮬 서사 아크 완전 동일. 프롬프트의 ✅예시("와이파이 잡힐 때만 접속",
  "사랑보다 밥 시간에 더 정확해")가 **verbatim 복사**됨.
- fabrication: 나비 12운성 태→"양" 창작, 두부 spec "子띠 金"(子는 水), 보리 ruler 44인데 "실세".
- QA 부재: 금지어 "100%·절대" 통과, label/headline/finalLine 3중 중복, errorSignals가 질병
  증상을 사주 탓으로 포장(병원 갈 신호 놓칠 위험).

근본 원인: `buildPetCompatUserInfo`가 LLM에 **사주 원문 + 점수만** 주고, `extractPetCompatSignals`가
계산한 관계 신호(삼합·충·생극)·펫 신살/12운성/십성을 **안 넘겼다** → 모델이 명리 대신 트로프로
채우고 점수를 부정함.

## 무엇을 바꿨나 (v0.2 대비 diff)

| # | 변경 | v0.2 | v0.3 |
|---|---|---|---|
| A1 | 신호 승격 | userInfo=사주원문+점수 | + "★관계의 명리 근거" 블록(합충·생극·신살·12운성·십성·점수 해석 번역). 12운성 "이 이름만, 창작 금지" |
| A2 | 명리 앵커 | 없음 | petVerdict=최강 신호 1개→구체 행동 리드 / ownerVerdict=관계신호 출발·ruler<50이면 실세 금지 / 시뮬 1개↑ 신살 파생 / 없는 이름 창작=실패 |
| A3 | 표현 풀 | [참고 표현 풀] 트로프 카탈로그(권력·시간·계산·시스템·모순·신조어) + ✅복사 예시 | 제거 → [소진 표현] TROPE_BLACKLIST "쓰면 실패" + 패턴 서술. 신조어 어휘만 잔존 |
| A4 | 3중 중복 | "헤드라인=labelText 부연" | label/headline/finalLine 역할 분리, 같은 단어 재사용 금지 |
| A5 | 종 톤 | 개="활발·충성·바보 사랑"(빈약) | 개=계산/도도/영업 금지, "너무 사랑해서 생기는 사고" |
| A6 | spec | LLM이 조립(子띠 金 오류) | 서버 buildPetSpec 확정값 강제 덮어쓰기 |
| A7 | QA 게이트 | 한자만 후처리 | validate(금지어·트로프·12운성·의료) → 위반 시 재생성 1회 |

## 검증

dev-test 나비/보리/두부: 트로프 0, petVerdict 신살 앵커 리드(역마·도화), spec "子(쥐)띠 水" 정확,
futureLine 12운성 "태" 정확, 개 톤 정상(영업 프레임 0). tsc 0. 회귀(종 혼입·한자·scoring v4) 없음.
트레이드오프: QA 재생성 발생 시 지연 ~2배(57s) — 실데이터 재생성률 관측 후 프롬프트 보강 판단.

## 회귀 불변 (유지)

종 어휘 가드(꾹꾹이 금지 등), 한자 후처리(stripHanjaKeepKorean), 신살 scoring v4,
등급 relabel·labelText 문자열, PET_COMPAT_SCORING_VERSION=4.
