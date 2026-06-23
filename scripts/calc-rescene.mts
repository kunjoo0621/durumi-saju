/** 리센느(RESCENE) 5인 매거진 명리 검증. 실행: NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-rescene.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;
const people = [
  { name: "원이(정원이)", birthDate: "2004-05-25" },
  { name: "리브(진경은)", birthDate: "2006-10-11" },
  { name: "미나미(이토미나미)", birthDate: "2006-11-29" },
  { name: "메이(이예빈)", birthDate: "2008-08-19" },
  { name: "제나(김가영)", birthDate: "2008-11-27" },
];
const L = (s = "") => process.stdout.write(s + "\n");
for (const p of people) {
  const { enriched, hourUnknown } = await compute({ ...p, calendar: "solar", gender: "f" } as any);
  if (!enriched) { L(`${p.name} ⚠️계산실패`); continue; }
  const pl = enriched.pillars, ed = enriched.elementDist;
  const sin = (enriched.shinsal?.matches ?? []).map((m: any) => m.label ?? m.name ?? m.key).join("·");
  L(`■ ${p.name} ${p.birthDate} ${hourUnknown ? "시미상" : ""}`);
  L(`  일주 ${pl.day} | 4기둥 ${pl.year}·${pl.month}·${pl.day}`);
  L(`  오행 목${ed["목"]} 화${ed["화"]} 토${ed["토"]} 금${ed["금"]} 수${ed["수"]} | 십성 ${enriched.tenStars.join(",")}`);
  const t12 = enriched.twelveStages;
  L(`  12운성: 년 ${t12?.year?.korean ?? "-"} · 월 ${t12?.month?.korean ?? "-"} · 일 ${t12?.day?.korean ?? "-"}`);
  L(`  신살 ${sin}`);
}
