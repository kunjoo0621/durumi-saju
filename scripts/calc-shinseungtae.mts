/** 신승태(김신승태, 1986-11-05) 숏츠 24호 명리 산출.
 *  실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-shinseungtae.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;

const people = [{ name: "신승태", birthDate: "1986-11-05", gender: "m" }];

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
