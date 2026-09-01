/** 김준수(1986-12-15, 양력, 시 미상) 매거진 연예인 글 명리 산출 + 일주 60갑자 독립 검산.
 *  실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-kimjunsu.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;

const people = [{ name: "김준수", birthDate: "1986-12-15", gender: "m" }];

const L = (s = "") => process.stdout.write(s + "\n");
for (const p of people) {
  const { enriched, hourUnknown } = await compute({ ...p, calendar: "solar" } as any);
  if (!enriched) { L(`${p.name} ⚠️계산실패`); continue; }
  const pl = enriched.pillars, ed = enriched.elementDist;
  L(`■ ${p.name} ${p.birthDate} ${hourUnknown ? "(시 미상)" : ""}`);
  L(`  4기둥  년 ${pl.year} · 월 ${pl.month} · 일 ${pl.day} · 시 ${pl.hour ?? "-"}`);
  L(`  오행   목${ed["목"]} 화${ed["화"]} 토${ed["토"]} 금${ed["금"]} 수${ed["수"]}`);
  L(`  십성   ${enriched.tenStars.join(", ")}`);
  const t12 = enriched.twelveStages;
  L(`  12운성 년 ${t12?.year?.korean ?? "-"} · 월 ${t12?.month?.korean ?? "-"} · 일 ${t12?.day?.korean ?? "-"}`);
  L(`  강약   ${JSON.stringify(enriched.strength)}`);
  L(`  십성F  ${JSON.stringify(enriched.tenStarsFull ?? null)}`);
  L(`  용신   ${JSON.stringify(enriched.yongshin ?? null)}`);
  L(`  관계   ${JSON.stringify(enriched.relationships ?? null)}`);
  L(`  오행분석 ${JSON.stringify(enriched.elementAnalysis ?? null)}`);
  L(`  일간   ${JSON.stringify(enriched.dayMaster ?? null)}`);
  L(`  12운성F ${JSON.stringify(enriched.twelveStages ?? null)}`);
  L(`  신살A(shinsal.matches)  ${(enriched.shinsal?.matches ?? []).map((m: any) => m.label ?? m.name ?? m.key).join(" · ") || "-"}`);
  L(`  신살B(pillar12Shinsal)  ${JSON.stringify(enriched.pillar12Shinsal ?? null)}`);
  L(`  전체키  ${Object.keys(enriched).join(", ")}`);
  L("");
}

/* ── 일주 60갑자 독립 검산 (JDN 방식, 엔진과 무관) ── */
const GAN = "갑을병정무기경신임계".split("");
const JI = "자축인묘진사오미신유술해".split("");
function jdn(y: number, m: number, d: number) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const BASE = jdn(1900, 1, 1), BASE_IDX = 10; // 1900-01-01 = 갑술일
function dayPillar(y: number, m: number, d: number) {
  const i = (((jdn(y, m, d) - BASE + BASE_IDX) % 60) + 60) % 60;
  return GAN[i % 10] + JI[i % 12];
}
L(`[검산] 1900-01-01 = ${dayPillar(1900, 1, 1)} (기대: 갑술)`);
L(`[검산] 1990-12-21 = ${dayPillar(1990, 12, 21)} (기대: 경신 — 나태주 확정값)`);
L(`[검산] 1986-12-15 = ${dayPillar(1986, 12, 15)} ← 김준수 일주`);

/* ── 세운 연간지 검산: 2026 병오 / 2027 정미 ── */
function yearPillar(y: number) {
  const i = (((y - 1984) % 60) + 60) % 60; // 1984 = 갑자
  return GAN[i % 10] + JI[i % 12];
}
L(`[검산] 2025 = ${yearPillar(2025)} / 2026 = ${yearPillar(2026)} / 2027 = ${yearPillar(2027)}`);
