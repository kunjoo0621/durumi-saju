# 결혼운/애정운 심층 검사 — 프롬프트 v2

- 날짜: 2026-07-18
- 파일: `lib/marriage-prompt.ts` — `buildFactBlock` + `SYSTEM_RULES` + `OUTPUT_SCHEMA`
- 이전 버전: `prompts/history/marriage-v1.md`
- 관련: 결혼운 검증 발견 수정(F-4 남명 혼잡 라벨 분기). 계획 = scratchpad `marriage-fix-plan.md` 1c.

## v1 → v2 변경점 (F-4 남명 혼잡 라벨)

v1은 사실 블록에서 `gwansalHonjap` 값을 **성별과 무관하게 항상 "관살혼잡(정관+편관 동시 존재)"**
라벨로 노출했다. 그런데 이 필드는 남명일 때 내부적으로 **정재+편재 동시 존재(=정편재혼잡)**를
의미한다(`lib/marriage-facts.ts`: `jeong/pyeon`이 성별에 따라 정관/편관 ↔ 정재/편재로 갈린다).
즉 남명 사용자에게 "관살혼잡"이라는 명리학적으로 틀린 용어가 사실로 주입되고 있었다.

v2에서 `buildFactBlock`의 해당 라인을 성별 분기로 교체했다:

- 여명: `관살혼잡(정관+편관 동시 존재): 예/아니오`
- 남명: `정편재혼잡(정재+편재 동시 존재): 예/아니오`

함께 바뀐 곳:
- 블록 구조 §3 `spouseStar` 설명: "…관살혼잡 여부." → "…혼잡 여부(여명=관살혼잡, 남명=정편재혼잡)."
- 근거 태그 예시에 `[근거:정편재혼잡]` 추가(남명 조언이 올바른 태그를 달 수 있게).

## 필드명을 rename하지 않은 이유 (범위 밖 · 의도적)

`gwansalHonjap`(코드) / `gwansal_honjap`(DB 컬럼)이라는 필드명 자체는 남명 의미(정편재혼잡)와
불일치하지만 **rename하지 않는다**: DB 컬럼 · `teaser_json` · `lib/share-marriage.ts` 공유 카드 ·
`start`/`analyze` API 응답 · UI(`MarriageResultClient`)까지 파급되는 광범위 리팩토링이라 사이드
이펙트 리스크가 크다. 대신 (a) 프롬프트 노출 라벨만 성별 분기로 정정하고, (b) `marriage-facts.ts`와
`marriage-prompt.ts` buildFactBlock에 "필드명은 하나지만 남명은 정편재혼잡"임을 주석으로 명시했다.

## 그대로 유지된 것

[절대 규칙 1~4], teaser/full 분리, 신살 노출 정책, 존댓말 톤, `dayBranchGongmang` 미노출 등
v1의 설계는 모두 유지. v2는 남명 혼잡 라벨 정정만 담은 최소 변경이다.

## 검증

- `lib/marriage-prompt.test.ts`(신규): 여명 → 사실블록에 "관살혼잡(정관+편관" 포함 · "정편재혼잡(정재+편재"
  미포함, 남명 → 반대. 2 pass.
- `npx tsc --noEmit` 0, `npx tsx --test lib/marriage-*.test.ts` 전체 pass.
