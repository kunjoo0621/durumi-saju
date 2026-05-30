/**
 * 연예인 매거진 글의 사주를 사이트 엔진으로 전수 계산해 덤프한다.
 * 체크리스트 6번 가드("사주는 사이트 엔진으로 검증, 외부 분석 복제 금지") 충족용.
 * FAQ·본문 재작성의 사실 베이스.
 *
 * 실행: NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/dump-celebrity-charts.mts > /tmp/celeb-charts.txt
 *   (--conditions=import 없으면 @gracefullight/saju 어댑터가 CJS로 해석돼 실패)
 */
import * as registryMod from "../lib/stories/registry";
import * as celebrityMod from "../lib/stories/celebrity";
import type { Story } from "../lib/stories/types";

const registry: any = (registryMod as any).default ?? registryMod;
const celebrity: any = (celebrityMod as any).default ?? celebrityMod;
const getAllStories: () => Story[] = registry.getAllStories;
const computeCelebritySaju = celebrity.computeCelebritySaju;

function line(s = "") {
  process.stdout.write(s + "\n");
}

const celebs = getAllStories().filter(
  (s) => s.category === "celebrity" && s.celebrity,
);

line(`연예인 글 ${celebs.length}편 — 엔진 사주 덤프\n${"=".repeat(60)}`);

for (const story of celebs) {
  const info = story.celebrity!;
  const { data, enriched, hourUnknown } = await computeCelebritySaju(info);
  line();
  line(`■ ${info.name} (${story.slug}) — ${info.iljuLabel ?? ""}`);
  line(
    `  생년월일: ${info.birthDate} ${info.calendar}${info.birthTime ? " " + info.birthTime : " 시미상"} / ${info.gender}`,
  );
  line(`  글 제목: ${story.title}`);
  if (!data || !enriched) {
    line("  ⚠️ 엔진 계산 실패(data null)");
    continue;
  }
  const p = enriched.pillars;
  line(
    `  4기둥: 년 ${p.year} · 월 ${p.month} · 일 ${p.day} · 시 ${hourUnknown ? "(미상)" : p.hour}`,
  );
  line(
    `  일간: ${enriched.dayMaster.korean}(${enriched.dayMaster.stem}) ${enriched.dayMaster.element}/${enriched.dayMaster.yinYang}`,
  );
  line(
    `  강약: ${enriched.strength?.level ?? ""} ${JSON.stringify(enriched.strength)}`,
  );
  const ed = enriched.elementDist;
  line(
    `  오행분포: 목${ed["목"]} 화${ed["화"]} 토${ed["토"]} 금${ed["금"]} 수${ed["수"]}  (부족:${enriched.elementAnalysis.deficient.join("·") || "없음"} / 강:${enriched.elementAnalysis.dominant.join("·") || "없음"})`,
  );
  line(`  십성(tenStars): ${enriched.tenStars.join(", ")}`);
  line(
    `  합충형: 합[${enriched.relationships.hap.join(",")}] 충[${enriched.relationships.chung.join(",")}] 형[${enriched.relationships.hyung.join(",")}]`,
  );
  line(`  일반신살:`);
  for (const m of enriched.shinsal.matches) {
    line(
      `     - ${m.label} [${m.type}] @${m.detectedAt.join(",")}  근거:${m.evidence.join("/")}`,
    );
  }
  if (enriched.shinsal.matches.length === 0) line("     (없음)");
  const t12 = enriched.twelveStages;
  line(
    `  12운성: 년 ${t12.year?.korean ?? "-"} · 월 ${t12.month?.korean ?? "-"} · 일 ${t12.day?.korean ?? "-"} · 시 ${hourUnknown ? "(미상)" : (t12.hour?.korean ?? "-")}`,
  );
  const p12 = enriched.pillar12Shinsal;
  line(
    `  12신살: 년 ${p12.year.name}(${p12.year.branchKorean}) · 월 ${p12.month.name}(${p12.month.branchKorean}) · 일 ${p12.day.name}(${p12.day.branchKorean}) · 시 ${hourUnknown ? "(미상)" : p12.hour ? p12.hour.name + "(" + p12.hour.branchKorean + ")" : "-"}`,
  );
  line(`  용신: ${JSON.stringify(enriched.yongshin)}`);
}
line();
line("끝.");
