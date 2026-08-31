import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateTenStarsFull } from "./utils/saju-enrichment";

import { bareStar, PILLARS, tenStarOf } from "./facts-core";

// 이 모듈이 있는 이유: 같은 헬퍼가 marriage-facts.ts:42·career-facts.ts:63·
// wealth-facts.ts:58 에 세 번 복사돼 있다(career-facts.ts:80 주석이 "wealth와
// 동일 — 공유 함수로 뽑지 않음"이라고 스스로 적어 뒀다). 신상품 3종이 여기에
// 네 번째·다섯 번째 복사본을 더하지 않도록 먼저 뽑아 둔다.
// ★기존 3파일은 건드리지 않는다(회귀 리스크 0). 신규만 이 모듈을 쓴다.

test("bareStar 는 한자 병기를 떼어낸다", () => {
  assert.equal(bareStar("정관(正官)"), "정관");
  assert.equal(bareStar("편재(偏財)"), "편재");
  assert.equal(bareStar("비견"), "비견"); // 병기가 없으면 그대로
});

// 甲(목·양) 일간 기준. 금극목이라 금은 관성이고, 음양이 다르면 정관·같으면 편관.
test("tenStarOf 는 일간 기준 상대 천간의 십성을 돌려준다", () => {
  assert.equal(tenStarOf("甲", "辛"), "정관"); // 辛=금·음 → 음양 다름
  assert.equal(tenStarOf("甲", "庚"), "편관"); // 庚=금·양 → 음양 같음
  assert.equal(tenStarOf("甲", "甲"), "비견"); // 같은 오행·같은 음양
});

// couple 은 "상대 일간이 나에게 무슨 십성인가"를 양방향으로 본다.
// 방향을 바꾸면 값도 바뀌어야 한다 — 대칭이면 그 축이 죽는다.
test("tenStarOf 는 방향에 따라 값이 다르다 (상대→나 와 나→상대)", () => {
  const aSeesB = tenStarOf("甲", "辛");
  const bSeesA = tenStarOf("辛", "甲");

  assert.equal(aSeesB, "정관");
  assert.equal(bSeesA, "정재"); // 辛(금·음) 입장에서 甲(목·양)은 극하는 대상 → 재성, 음양 달라 정재
  assert.notEqual(aSeesB, bSeesA);
});

test("알 수 없는 천간이면 null 을 돌려준다 (호출부가 분기할 수 있게)", () => {
  assert.equal(tenStarOf("甲", "X"), null);
  assert.equal(tenStarOf("X", "甲"), null);
});

test("PILLARS 는 년·월·일·시 순서를 고정한다", () => {
  assert.deepEqual([...PILLARS], ["year", "month", "day", "hour"]);
});

// ★교차 확인 — facts-core 가 엔진 본체와 같은 값을 내는지 실제 원국으로 대조한다.
// 새 모듈이 조용히 갈라지는 것이 이 프로젝트에서 반복된 사고 유형이라,
// "코드가 같아 보인다"에 기대지 않고 산출값으로 확인한다.
test("tenStarOf 는 엔진의 calculateTenStarsFull 과 같은 십성을 낸다 (천간 3자리 전수 대조)", () => {
  const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

  let compared = 0;
  for (const dayStem of STEMS) {
    for (const other of STEMS) {
      // 년·월·시 천간을 other 로 채운 가상 원국. calculateTenStarsFull 은
      // 천간을 [년,월,일,시] 중 0·1·3 만 보므로 앞 3개가 other 십성이 된다.
      const stems = [other, other, dayStem, other];
      const full = calculateTenStarsFull(stems, BRANCHES.slice(0, 4));

      const expected = tenStarOf(dayStem, other);
      assert.ok(expected, `${dayStem}/${other} 십성이 null 이면 안 된다`);

      // calculateTenStarsFull 은 병기를 붙여 돌려주므로 bareStar 로 맞춰 비교한다.
      const engineFirstThree = full.slice(0, 3).map(bareStar);
      assert.deepEqual(
        engineFirstThree,
        [expected, expected, expected],
        `${dayStem} 일간에서 ${other} 의 십성이 엔진과 다르다`,
      );
      compared++;
    }
  }
  assert.equal(compared, 100, "천간 10×10 전수를 대조해야 한다");
});
