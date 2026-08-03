// 12신살 위치별 매핑(getPillar12Shinsal) 회귀 테스트 — 년지 기준 통일 (2026-08-03)
//
// 배경: 과거 구현("방법B")은 년주만 일지 삼합, 나머지는 년지 삼합을 쓰는 혼합
// 방식이라 사이트 사전(lib/dict/data/sipisinsal) 조견표와 년주 값이 어긋났다.
// 연예인 글 3편(윤경호·태연·서인국)에서 독립적으로 실측된 불일치를 고정 케이스로 삼는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getPillar12Shinsal } from "./utils/saju-enrichment";

// 윤경호: 1980-07-05 양력, 시간 미상. 년주 庚申·월주 壬午·일주 己卯 (년지 申 → 신자진 그룹)
test("윤경호 — 년지 申(신자진): 년주는 겁살(방법B)이 아니라 지살", () => {
  const r = getPillar12Shinsal(["申", "午", "卯"], true);
  assert.equal(r.year.name, "지살");   // 사전 조견표: 신자진의 申 = 지살
  assert.equal(r.month.name, "재살");  // 신자진의 午 = 재살 (월·일은 기존과 동일해야 함)
  assert.equal(r.day.name, "육해살");  // 신자진의 卯 = 육해살
  assert.equal(r.hour, null);
});

// 태연: 1989-03-09 양력, 시간 미상. 년주 己巳·월주 丁卯·일주 戊辰 (년지 巳 → 사유축 그룹)
test("태연 — 년지 巳(사유축): 년주는 겁살(방법B)이 아니라 지살", () => {
  const r = getPillar12Shinsal(["巳", "卯", "辰"], true);
  assert.equal(r.year.name, "지살");   // 사유축의 巳 = 지살
  assert.equal(r.month.name, "재살");  // 사유축의 卯 = 재살
  assert.equal(r.day.name, "천살");    // 사유축의 辰 = 천살
});

// 서인국: 1987-10-23 양력, 시간 미상. 년주 丁卯·월주 庚戌·일주 乙巳 (년지 卯 → 해묘미 그룹)
test("서인국 — 년지 卯(해묘미): 년주는 재살(방법B)이 아니라 장성살", () => {
  const r = getPillar12Shinsal(["卯", "戌", "巳"], true);
  assert.equal(r.year.name, "장성살"); // 해묘미의 卯 = 장성살 (왕지)
  assert.equal(r.month.name, "천살");  // 해묘미의 戌 = 천살
  assert.equal(r.day.name, "역마살");  // 해묘미의 巳 = 역마살 (글 본문에서도 일지 사=역마)
});

// 시주 포함 케이스 + 년지 기준의 구조적 불변식:
// 년지는 자기 삼합 그룹의 구성원이므로 년주 12신살은 항상 지살(생지)·장성살(왕지)·화개살(고지) 중 하나
test("년주 12신살은 12지지 어느 년지든 지살·장성살·화개살 중 하나", () => {
  const ALL = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  for (const yearBranch of ALL) {
    const r = getPillar12Shinsal([yearBranch, "子", "午", "卯"], false);
    assert.ok(
      ["지살", "장성살", "화개살"].includes(r.year.name),
      `년지 ${yearBranch} → ${r.year.name} (지살/장성살/화개살이어야 함)`,
    );
    assert.notEqual(r.hour, null);
  }
});

// 4기둥 단일 기준: 같은 지지는 어느 기둥에 있어도 같은 별이어야 한다 (혼합 기준 재발 방지)
test("같은 지지는 기둥 위치와 무관하게 같은 12신살", () => {
  // 년지 寅(인오술 그룹) 고정, 卯를 월지/일지/시지에 배치
  const atMonth = getPillar12Shinsal(["寅", "卯", "午", "戌"], false).month;
  const atDay = getPillar12Shinsal(["寅", "午", "卯", "戌"], false).day;
  const atHour = getPillar12Shinsal(["寅", "午", "戌", "卯"], false).hour!;
  assert.equal(atMonth.name, atDay.name);
  assert.equal(atDay.name, atHour.name);
  // 년지 자신도 같은 기준: 인오술의 寅 = 지살
  assert.equal(getPillar12Shinsal(["寅", "卯", "午", "戌"], false).year.name, "지살");
});
