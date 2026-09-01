/** 블로그 재발행 3편(뷔·양세종·유영우) 명리 산출 — 재발행 본문의 사실 베이스.
 *  실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-repost-batch.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;

const people = [
  { name: "뷔", birthDate: "1995-12-30", gender: "m" },
  { name: "양세종", birthDate: "1992-12-23", gender: "m" },
  { name: "유영우", birthDate: "1995-06-17", gender: "m" },
];

const L = (s = "") => process.stdout.write(s + "\n");
for (const p of people) {
  const { enriched, hourUnknown } = await compute({ ...p, calendar: "solar" } as any);
  if (!enriched) { L(`${p.name} ⚠️계산실패`); continue; }
  const pl = enriched.pillars, ed = enriched.elementDist;
  L(`■ ${p.name} ${p.birthDate} ${hourUnknown ? "(시 미상)" : ""}`);
  L(`  4기둥  년 ${pl.year} · 월 ${pl.month} · 일 ${pl.day}`);
  L(`  오행   목${ed["목"]} 화${ed["화"]} 토${ed["토"]} 금${ed["금"]} 수${ed["수"]}  / ${JSON.stringify(enriched.elementAnalysis)}`);
  L(`  일간   ${JSON.stringify(enriched.dayMaster)}`);
  L(`  십성F  ${JSON.stringify(enriched.tenStarsFull)}`);
  L(`  12운성 ${JSON.stringify(enriched.twelveStages)}`);
  L(`  강약   ${JSON.stringify(enriched.strength)}`);
  L(`  용신   ${JSON.stringify(enriched.yongshin)}`);
  L(`  관계   ${JSON.stringify(enriched.relationships)}`);
  L(`  신살A  ${(enriched.shinsal?.matches ?? []).map((m: any) => `${m.label ?? m.name ?? m.key}@${m.pillar ?? m.position ?? "?"}`).join(" · ") || "-"}`);
  L(`  신살B  ${JSON.stringify(enriched.pillar12Shinsal)}`);
  L("");
}
