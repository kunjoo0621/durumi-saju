import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNaverAdParams } from "./naver-ad-params";

// ★운영자가 실제 광고를 클릭해 받은 원문(2026-08-10). 박제해 둔다.
const REAL =
  "ct%3Dmslzjmun%7Cci%3DERed6440bf%2D940a%2D11f1%2Da2ce%2De201a69bdc71%7Ctr%3Dsa%7Chk%3D57c5e07e908dab5489be7ca119ad9f660b468ebd%7Cnacn%3DhhmIBEBx8d7d";

test("실제 광고 클릭 NaPm 을 검색광고 유입으로 해석한다", () => {
  const r = parseNaverAdParams(REAL);
  assert.deepEqual(r, {
    utm_source: "naver",
    utm_medium: "cpc", // tr=sa → 검색광고
    utm_campaign: "hhmIBEBx8d7d", // nacn = 네이버 부여 캠페인 식별자
  });
});

test("tr 이 sa 가 아니면 유형을 뭉개지 않고 원문을 남긴다", () => {
  const r = parseNaverAdParams(encodeURIComponent("tr=ds|nacn=abc"));
  assert.equal(r?.utm_medium, "naver_ds");
  assert.equal(r?.utm_campaign, "abc");
});

test("tr·nacn 이 없어도 광고 유입인 건 잃지 않는다", () => {
  const r = parseNaverAdParams(encodeURIComponent("ct=x|ci=y"));
  assert.equal(r?.utm_source, "naver");
  assert.equal(r?.utm_medium, "naver_unknown");
  assert.equal(r?.utm_campaign, null);
});

test("NaPm 이 없거나 형식이 아니면 광고로 단정하지 않는다", () => {
  assert.equal(parseNaverAdParams(null), null);
  assert.equal(parseNaverAdParams(""), null);
  assert.equal(parseNaverAdParams("그냥문자열"), null); // key=value 가 하나도 없음
});

test("깨진 인코딩이 와도 예외를 던지지 않는다(추적 때문에 요청을 깨뜨리면 안 된다)", () => {
  assert.doesNotThrow(() => parseNaverAdParams("%E0%A4%A"));
  const r = parseNaverAdParams("%E0%A4%A");
  assert.equal(r, null);
});
