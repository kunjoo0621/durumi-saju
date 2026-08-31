import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateSaju, enrichSajuData } from "@/lib/utils/saju";

import { derivePairFacts } from "./pair-facts";

// ★이 파일이 필요한 이유: pair-facts.test.ts 의 24개는 전부 손으로 만든 픽스처
// (`as unknown as EnrichedSajuData`)로 돈다. 그래서 enrichSajuData 가 실제로 뱉는 모양
// (pillars 문자열 형식·shinsal.matches 구조·isTimeUnknown 위치)과 어긋나 있어도 전부
// 초록불이 뜬다. 진짜 만세력을 돌려 나온 원국으로 한 번은 확인해야 한다.
//
// ★★TZ 지뢰 겸용: 사람 A 는 CLAUDE.md 가 지목한 절입 경계 출생자다(1990-05-06 01:00).
// 실측(2026-08-31)으로 확인한 것 — 이 입력에서 TZ 차이는 **일주·시주**에서 갈린다:
//   TZ=UTC        → 庚午 / 庚辰 / 辛未 / 戊子
//   TZ=Asia/Seoul → 庚午 / 庚辰 / 庚午 / 甲申   ← 일주·시주가 다르다
// (CLAUDE.md 본문은 이 사례의 월주가 갈린다고 적고 있으나, 현재 코드에서 월주는 양쪽 다
//  庚辰 이고 갈리는 자리는 일주·시주였다. 지뢰로서의 효과는 동일하다.)
// 이 테스트가 깨지면 관계 산출이 틀린 게 아니라 실행 TZ 가 UTC 가 아닐 수 있다.
// 선례: lib/saju-solar-terms.golden.test.ts

const 절입경계 = { y: 1990, m: 5, d: 6, hh: 1, mm: 0 }; // 입하 직전 — 월주가 뒤집히는 자리

async function chart(
  y: number, m: number, d: number,
  hh?: number, mm?: number,
) {
  const saju = await calculateSaju(y, m, d, hh, mm);
  assert.ok(saju, `사주 계산 실패: ${y}-${m}-${d}`);
  return enrichSajuData(saju!, { isTimeUnknown: hh === undefined });
}

test("[golden] 실제 만세력 원국 두 개로 derivePairFacts 가 돈다 (TZ=UTC 전제)", async () => {
  const a = await chart(절입경계.y, 절입경계.m, 절입경계.d, 절입경계.hh, 절입경계.mm);
  const b = await chart(1995, 6, 21, 12, 0);

  // TZ 지뢰 — KST 로 돌리면 일주·시주가 庚午/甲申 이 되어 여기서 먼저 깨진다.
  // ★pillars 는 "庚辰(경진)" 처럼 한글 병기가 붙은 문자열이다. 손으로 만든 픽스처가
  //   이 형식을 몰랐다 — 골든이 없었으면 계속 몰랐을 자리다.
  assert.deepEqual(
    { d: a.pillars.day, h: a.pillars.hour },
    { d: "辛未(신미)", h: "戊子(무자)" },
    "절입 경계 원국이 다르다 — TZ=UTC 로 돌렸는가?",
  );

  const f = derivePairFacts(a, b, { currentYear: 2026, sexA: "male", sexB: "male" });

  // ① 픽스처가 아니라 진짜 원국에서도 축이 다 살아 있는지
  assert.equal(f.currentYear, 2026);
  assert.deepEqual(f.reliability.neutralizedAxes, [], "둘 다 시간을 알므로 죽은 축이 없다");
  assert.ok(f.dayStemRelation.type, "일간 관계가 비어 있다");
  assert.ok(f.tenStarExchange.aSeesB, "십성 교차가 null 이다 — 픽스처 가정이 실제와 다르다");
  assert.ok(f.tenStarExchange.bSeesA);

  // ② 지지 매트릭스가 실제 pillars 문자열에서 지지를 제대로 뽑았는지
  for (const c of f.branchMatrix) {
    assert.equal(c.branchA.length, 1, `지지가 한 글자가 아니다: ${c.branchA}`);
    assert.equal(c.branchB.length, 1, `지지가 한 글자가 아니다: ${c.branchB}`);
    assert.ok(c.relations.length > 0, "관계 없는 칸이 담겼다");
  }

  // ③ shinsalCross 가 실제 shinsal.matches 구조를 읽는지 (모양이 다르면 전부 false 가 된다)
  assert.equal(typeof f.shinsalCross.dohwaBoth, "boolean");
  assert.equal(typeof f.shinsalCross.chuneul.a, "boolean");

  // ④ 결정론 — 같은 원국·같은 연도면 두 번 돌려도 같다
  assert.deepEqual(f, derivePairFacts(a, b, { currentYear: 2026, sexA: "male", sexB: "male" }));
});

test("[golden] 실제 원국 A/B 를 뒤집으면 방향 필드가 미러된다", async () => {
  const a = await chart(절입경계.y, 절입경계.m, 절입경계.d, 절입경계.hh, 절입경계.mm);
  const b = await chart(1995, 6, 21, 12, 0);

  const fwd = derivePairFacts(a, b, { currentYear: 2026, sexA: "female", sexB: "male" });
  const rev = derivePairFacts(b, a, { currentYear: 2026, sexA: "male", sexB: "female" });

  assert.equal(fwd.tenStarExchange.aSeesB, rev.tenStarExchange.bSeesA);
  assert.equal(fwd.spouseStarCross.aHitByB, rev.spouseStarCross.bHitByA);
  assert.equal(fwd.elementCoverage.percent, rev.elementCoverage.percent);
  assert.equal(fwd.branchMatrix.length, rev.branchMatrix.length);
});

test("[golden] 실제 시주 미상 원국 — 시주 칸이 안 생기고 축이 중화된다", async () => {
  const aNoTime = await chart(절입경계.y, 절입경계.m, 절입경계.d); // 시 미상
  const b = await chart(1995, 6, 21, 12, 0);

  assert.equal(aNoTime.isTimeUnknown, true, "enrichSajuData 가 isTimeUnknown 을 안 세웠다");
  assert.equal(aNoTime.pillars.hour, null, "시주가 null 이 아니다");

  const f = derivePairFacts(aNoTime, b, { currentYear: 2026, sexA: "male", sexB: "male" });

  assert.equal(f.branchMatrix.filter((c) => c.posA === "hour").length, 0);
  assert.deepEqual(
    [...f.reliability.neutralizedAxes].sort(),
    ["오행상보", "용신상보", "지지매트릭스"],
  );
  // 일간은 시주와 무관하므로 여전히 살아 있어야 한다
  assert.ok(f.tenStarExchange.aSeesB);
});

test("[golden] 같은 사람 둘 — 자기 자신과의 대조도 깨지지 않는다", async () => {
  const a = await chart(1995, 6, 21, 12, 0);
  const f = derivePairFacts(a, a, { currentYear: 2026, sexA: "male", sexB: "male" });

  // 같은 일간이므로 십성 교차는 비견, 양방향이 같다
  assert.equal(f.tenStarExchange.aSeesB, "비견");
  assert.equal(f.tenStarExchange.bSeesA, "비견");
  // 같은 원국이므로 대각선(같은 기둥끼리)은 전부 "동일"을 포함한다
  for (const pos of ["year", "month", "day", "hour"] as const) {
    const diag = f.branchMatrix.find((c) => c.posA === pos && c.posB === pos);
    assert.ok(diag, `${pos} 대각선 칸이 없다`);
    assert.ok(diag!.relations.includes("동일"), `${pos} 대각선이 동일이 아니다`);
  }
});
