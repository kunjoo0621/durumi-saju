/** 이찬원 롱폼 9호 원국 산출. 실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-leechanwon.mts */
import * as celebrityMod from "../lib/stories/celebrity";
const compute = (celebrityMod as any).computeCelebritySaju ?? (celebrityMod as any).default?.computeCelebritySaju;

const people = [{ name: "이찬원", birthDate: "1996-11-01" }];

const L = (s = "") => process.stdout.write(s + "\n");
for (const p of people) {
  const { enriched, hourUnknown } = await compute({ ...p, calendar: "solar", gender: "m" } as any);
  if (!enriched) { L(`${p.name} ⚠️계산실패`); continue; }
  const pl = enriched.pillars, ed = enriched.elementDist;
  L(`■ ${p.name} ${p.birthDate} ${hourUnknown ? "(시 미상)" : ""}`);
  L(`  4기둥  년 ${pl.year} · 월 ${pl.month} · 일 ${pl.day} · 시 ${pl.hour ?? "-"}`);
  L(`  오행   목${ed["목"]} 화${ed["화"]} 토${ed["토"]} 금${ed["금"]} 수${ed["수"]}`);
  L(`  십성   ${enriched.tenStars.join(", ")}`);
  L(`  십성전체 ${JSON.stringify((enriched as any).tenStarsFull ?? null)}`);
  const t12 = enriched.twelveStages;
  L(`  12운성 년 ${t12?.year?.korean ?? "-"} · 월 ${t12?.month?.korean ?? "-"} · 일 ${t12?.day?.korean ?? "-"}`);
  L(`  강약   ${JSON.stringify(enriched.strength ?? null)}`);
  L(`  용신   ${JSON.stringify(enriched.yongsin ?? null)}`);
  // ★신살은 두 필드를 반드시 같이 본다 (feedback_shinsal_dual_field)
  L(`  신살A(shinsal.matches)  ${(enriched.shinsal?.matches ?? []).map((m: any) => m.label ?? m.name ?? m.key).join(" · ") || "-"}`);
  L(`  신살B(pillar12Shinsal)  ${JSON.stringify(enriched.pillar12Shinsal ?? null)}`);
  L(`  합충형  ${JSON.stringify((enriched as any).relations ?? (enriched as any).hapchung ?? null)}`);
  L(`  --- 원본 키: ${Object.keys(enriched).join(", ")}`);
  L(`\n=== FULL JSON ===`);
  L(JSON.stringify(enriched, null, 2));
}
