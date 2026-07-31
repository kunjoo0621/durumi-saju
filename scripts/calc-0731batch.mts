/** 2026-07-31 매거진 배치 5인 명리 산출. 실행: NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-0731batch.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;

const people = [
  { name: "소지섭", birthDate: "1977-11-04", gender: "m" },
  { name: "조승우", birthDate: "1980-03-28", gender: "m" },
  { name: "지민(BTS)", birthDate: "1995-10-13", gender: "m" },
  { name: "노윤서", birthDate: "2000-01-25", gender: "f" },
  { name: "원희(ILLIT)", birthDate: "2007-06-26", gender: "f" },
];

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
