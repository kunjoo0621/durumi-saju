/** 환희(황윤석, 1982-01-17) 숏츠 27호 명리 산출 + 일주 60갑자 독립 검산.
 *  실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-hwanhee.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;

const people = [{ name: "환희(황윤석)", birthDate: "1982-01-17", gender: "m" }];

const L = (s = "") => process.stdout.write(s + "\n");
for (const p of people) {
  const { enriched, hourUnknown } = await compute({ ...p, calendar: "solar" } as any);
  if (!enriched) { L(`${p.name} ⚠️계산실패`); continue; }
  const pl = enriched.pillars, ed = enriched.elementDist;
  L(`■ ${p.name} ${p.birthDate} ${hourUnknown ? "(시 미상)" : ""}`);
  L(`  4기둥  년 ${pl.year} · 월 ${pl.month} · 일 ${pl.day}`);
  L(`  오행   목${ed["목"]} 화${ed["화"]} 토${ed["토"]} 금${ed["금"]} 수${ed["수"]}`);
  L(`  십성   ${enriched.tenStars.join(", ")}`);
  const t12 = enriched.twelveStages;
  L(`  12운성 년 ${t12?.year?.korean ?? "-"} · 월 ${t12?.month?.korean ?? "-"} · 일 ${t12?.day?.korean ?? "-"}`);
  L(`  강약   ${JSON.stringify(enriched.strength)}`);
  L(`  용신   ${JSON.stringify(enriched.yongsin ?? null)}`);
  L(`  신살A(shinsal.matches)  ${(enriched.shinsal?.matches ?? []).map((m: any) => m.label ?? m.name ?? m.key).join(" · ") || "-"}`);
  L(`  신살B(pillar12Shinsal)  ${JSON.stringify(enriched.pillar12Shinsal ?? null)}`);
  L("");
}

/* ── 일주 60갑자 독립 검산 (JDN 방식, 엔진과 무관) ── */
const GAN = "갑을병정무기경신임계".split("");
const JI = "자축인묘진사오미신유술해".split("");
function jdn(y: number, m: number, d: number) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
// 기준: 1900-01-01 = 갑술일 (index 10: 갑=0, 술=10)
const BASE = jdn(1900, 1, 1), BASE_IDX = 10;
function dayPillar(y: number, m: number, d: number) {
  const i = (((jdn(y, m, d) - BASE + BASE_IDX) % 60) + 60) % 60;
  return GAN[i % 10] + JI[i % 12];
}
L(`[검산] 1900-01-01 = ${dayPillar(1900, 1, 1)} (기대: 갑술)`);
L(`[검산] 1994-04-06 = ${dayPillar(1994, 4, 6)} (기대: 임술 — 성리 24호 확정값)`);
L(`[검산] 1986-11-05 = ${dayPillar(1986, 11, 5)} (기대: 계축 — 신승태 26호 확정값)`);
L(`[검산] 1982-01-17 = ${dayPillar(1982, 1, 17)} ← 환희 일주`);
