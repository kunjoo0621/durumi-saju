import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findProminenceFabrications,
  findTimingFabrications,
  type StarHit,
} from "./report-fact-guard";

// ═══════════════════════════════════════════════════════════
// 2026-07-28 실사용 15건 검수에서 확정된 fabrication 을 박제.
// 최우선 결함(15건 중 7건): 지장간에만 있는 별을 "월주에 뚜렷하게 떠 있다"고
// 투출처럼 서술 → 궁위→인생국면 번역이 허구 위에 얹힌다.
// ═══════════════════════════════════════════════════════════

// 이의준(1996-02-27) 실측 원국: 丙子/庚寅/甲午/丁卯, 일간 甲, 오행 토 0개.
// 편재(戊)는 寅·午 지장간에만 존재. 월주 庚寅 = 편관+비견.
const IJUN_HITS: StarHit[] = [
  { pillar: "month", source: "지장간", star: "편재" },
  { pillar: "day", source: "지장간", star: "정재" },
];

test("궁위: 지장간에만 있는 별을 '월주에 떠 있다'고 하면 위반", () => {
  const v = findProminenceFabrications(
    "월주(사회적 자리)에 편재가 떠 있으니 겉으로는 화려한 사람에게 마음이 가.",
    IJUN_HITS
  );
  assert.equal(v.length, 1, `위반 1건이어야 한다: ${JSON.stringify(v)}`);
  assert.ok(v[0].includes("월주"), v[0]);
  assert.ok(v[0].includes("편재"), v[0]);
});

test("궁위: '뚜렷하게 자리를 잡고' 도 같은 위반", () => {
  const v = findProminenceFabrications(
    "재성이 월주에 뚜렷하게 자리를 잡고 있어서 인연 자체가 없는 건 아니야.",
    [{ pillar: "month", source: "지장간", star: "재성" }]
  );
  assert.equal(v.length, 1);
});

test("궁위: 천간 투출이면 위반 아님(정상 서술 보존)", () => {
  const v = findProminenceFabrications(
    "월주에 편재가 떡 하니 떠 있어. 네 돈은 월급 통장에 얌전히 안 있어.",
    [{ pillar: "month", source: "천간", star: "편재" }]
  );
  assert.equal(v.length, 0, `천간 투출은 정상인데 걸렸다: ${JSON.stringify(v)}`);
});

test("궁위: '지장간에 숨어 있다'는 올바른 서술은 위반 아님", () => {
  const v = findProminenceFabrications(
    "네 일지 지장간에 정재가 숨어 있어. 겉으론 안 보이는 결이지.",
    IJUN_HITS
  );
  assert.equal(v.length, 0, `올바른 서술이 걸렸다: ${JSON.stringify(v)}`);
});

test("궁위: 강조어가 없으면 위반 아님(위치 언급 자체는 허용)", () => {
  const v = findProminenceFabrications(
    "월주 쪽 편재의 결을 보면 활동적인 기운이야.",
    IJUN_HITS
  );
  assert.equal(v.length, 0);
});

test("궁위: 한 문장에 기둥이 둘 이상이면 판정 보류(오탐 방지)", () => {
  const v = findProminenceFabrications(
    "년주와 월주에 편재가 강하게 떠 있는 게 눈에 띄네.",
    IJUN_HITS
  );
  // 보수적으로 다중 기둥은 스킵 — 오탐으로 상시 재생성을 유발하지 않는다
  assert.equal(v.length, 0);
});

test("궁위: 원국에 아예 없는 별을 투출로 말하면 위반(사유 구분)", () => {
  const v = findProminenceFabrications(
    "월주에 편관이 떡하니 자리 잡고 있어.",
    IJUN_HITS
  );
  assert.equal(v.length, 1);
  assert.ok(v[0].includes("없음"), `사유가 '원국에 없음'이어야 한다: ${v[0]}`);
});

// ── 타이밍 (⑦) ─────────────────────────────────────────────
// 실측: marriage-0 "2035년(40세)에 네 매력이 한껏 부각되는 시기가 다시 오니까"
// — 이 원국 도화는 酉, 홍염은 午. 2035(을묘) 트리거 근거 없음.
const WINDOWS = [
  { year: 2027, triggers: ["세운합일지"] },
  { year: 2028, triggers: ["배우자성투출"] },
  { year: 2032, triggers: ["도화홍염"] },
];

test("타이밍: 도화 트리거 없는 해에 '매력 부각'이면 위반", () => {
  const v = findTimingFabrications(
    "2035년(40세)에 네 매력이 한껏 부각되는 시기가 다시 오니까 조급해할 필요 없어.",
    WINDOWS,
    [{ startAge: 30, endAge: 39 }]
  );
  assert.equal(v.length, 1, JSON.stringify(v));
  assert.ok(v[0].includes("2035"), v[0]);
});

test("타이밍: 도화 트리거 있는 해의 '매력'은 정상", () => {
  const v = findTimingFabrications(
    "2032년은 네 매력이 널리 퍼지는 해야.",
    WINDOWS,
    [{ startAge: 30, endAge: 39 }]
  );
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("타이밍: 매력 표현이 없으면 연도 인용은 자유(세운 계산 인용 보존)", () => {
  const v = findTimingFabrications(
    "2029년(34세)엔 배우자성이 하늘에 뚜렷하게 드러나는 시기야.",
    WINDOWS,
    [{ startAge: 30, endAge: 39 }]
  );
  assert.equal(v.length, 0);
});

test("타이밍: 대운 데이터가 비었는데 대운을 주장하면 위반", () => {
  const v = findTimingFabrications(
    "너는 이미 39세부터 48세까지 편재 대운을 지나왔거나 지나고 있어.",
    WINDOWS,
    []
  );
  assert.equal(v.length, 1, JSON.stringify(v));
  assert.ok(v[0].includes("대운"), v[0]);
});

test("타이밍: 대운 데이터가 있으면 대운 서술 정상", () => {
  const v = findTimingFabrications(
    "대운 흐름상 노년기에 강한 인연운이 몰려 있어.",
    WINDOWS,
    [{ startAge: 73, endAge: 82 }]
  );
  assert.equal(v.length, 0);
});
