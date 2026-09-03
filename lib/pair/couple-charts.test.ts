import { test } from "node:test";
import assert from "node:assert/strict";

import { computePartnerChart } from "./couple-charts";

// ★실제 만세력을 돌린다(mock 아님). 손으로 만든 픽스처가 실제와 어긋나 있어도
// 초록불이 뜬다는 걸 Phase 1 골든에서 이미 겪었다. TZ=UTC 전제.

test("상대 원국을 실제로 계산한다", async () => {
  const r = await computePartnerChart({
    name: "지영", birthYear: "1995", birthMonth: "6", birthDay: "21",
    birthHour: "12", birthMinute: "0", birthLocation: "서울", gender: "여성",
    calendarType: "solar", unknownBirthTime: false,
  });

  assert.equal(r.ok, true, r.ok ? "" : (r as { error: string }).error);
  if (!r.ok) return;
  assert.equal(r.enriched.isTimeUnknown, false);
  assert.ok(r.enriched.pillars.day.length >= 2, "일주가 비었다");
  assert.ok(r.enriched.pillars.hour, "시주가 있어야 한다");
  assert.equal(r.sex, "female");
});

// ★못 본 것 ≠ 없는 것. 시간을 모르면 시주를 만들지 않고 isTimeUnknown 을 세운다.
test("시간을 모르면 시주를 만들지 않는다", async () => {
  const r = await computePartnerChart({
    name: "지영", birthYear: "1995", birthMonth: "6", birthDay: "21",
    gender: "여성", calendarType: "solar", unknownBirthTime: true,
  });

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.enriched.isTimeUnknown, true);
  assert.equal(r.enriched.pillars.hour, null, "시간을 모르는데 시주가 만들어졌다");
});

test("성별을 남/여로 정규화한다 (대운 순행·역행에 필요)", async () => {
  const base = {
    name: "테스트", birthYear: "1990", birthMonth: "5", birthDay: "6",
    calendarType: "solar", unknownBirthTime: true,
  };
  for (const [given, expected] of [["남성", "male"], ["남", "male"], ["female", "female"], ["여자", "female"]] as const) {
    const r = await computePartnerChart({ ...base, gender: given });
    assert.equal(r.ok && r.sex, expected, `${given} → ${expected} 여야 한다`);
  }
});

test("음력 입력을 양력으로 변환해 계산한다", async () => {
  const lunar = await computePartnerChart({
    name: "테스트", birthYear: "1995", birthMonth: "6", birthDay: "21",
    gender: "여성", calendarType: "lunar", unknownBirthTime: true,
  });
  const solar = await computePartnerChart({
    name: "테스트", birthYear: "1995", birthMonth: "6", birthDay: "21",
    gender: "여성", calendarType: "solar", unknownBirthTime: true,
  });

  assert.equal(lunar.ok, true);
  assert.equal(solar.ok, true);
  if (!lunar.ok || !solar.ok) return;
  // 같은 숫자를 음력으로 읽으면 다른 날이므로 원국이 달라야 한다.
  assert.notEqual(lunar.enriched.pillars.day, solar.enriched.pillars.day,
    "음력 변환이 적용되지 않았다");
});

// 실패를 조용히 넘기지 않는다 — 잘못된 원국으로 판정이 나가면 안 된다.
test("계산 불가 입력은 에러를 돌려준다 (기본값으로 때우지 않는다)", async () => {
  const r = await computePartnerChart({
    name: "테스트", birthYear: "abcd", birthMonth: "6", birthDay: "21",
    gender: "여성", calendarType: "solar", unknownBirthTime: true,
  });
  assert.equal(r.ok, false);
});

// ★타이밍 교차("둘 다 열리는 해")를 구하려면 상대의 SajuData 원본이 필요하다.
// deriveMarriageFacts 가 sajuData.day.heavenlyStem 을 읽기 때문이다.
// 안 돌려주면 호출부가 null 을 넘기게 되고, 예외가 조용히 삼켜져 타이밍 축이
// **영원히 비어 있게** 된다 — 20알의 근거인 기능이 죽는다.
test("SajuData 원본도 돌려준다 (타이밍 교차에 필요)", async () => {
  const r = await computePartnerChart({
    name: "지영", birthYear: "1995", birthMonth: "6", birthDay: "21",
    birthHour: "12", birthMinute: "0", gender: "여성",
    calendarType: "solar", unknownBirthTime: false,
  });

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.saju, "saju 가 없다");
  assert.ok(r.saju.day.heavenlyStem, "일간이 비었다 — deriveMarriageFacts 가 여기서 터진다");
});

// ★코드리뷰에서 발견: 자체입력 경로는 윤달을 반영하는데(lib/self-input.ts:84)
// computePartnerChart 는 무시하고 있었다. 그러면
//   ① 윤달생 상대를 평달 원국으로 계산해 **조용히 틀린 리포트**를 팔고
//   ② 본인이 윤달생이면 teaser(윤달 반영)와 결제 시 재계산(평달)이 갈라져
//      판정 게이트가 정당한 결제를 영원히 튕긴다.
test("윤달을 반영해 계산한다", async () => {
  const base = {
    name: "테스트", birthYear: "2020", birthMonth: "4", birthDay: "15",
    gender: "여성", calendarType: "lunar", unknownBirthTime: true,
  } as const;

  const normal = await computePartnerChart({ ...base, isLeapMonth: false });
  const leap = await computePartnerChart({ ...base, isLeapMonth: true });

  assert.equal(normal.ok, true);
  assert.equal(leap.ok, true);
  if (!normal.ok || !leap.ok) return;
  assert.notEqual(
    normal.enriched.pillars.day, leap.enriched.pillars.day,
    "윤달 플래그가 무시되고 있다 — 같은 원국이 나왔다",
  );
});
