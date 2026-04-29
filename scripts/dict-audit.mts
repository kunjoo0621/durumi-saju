import { readFileSync, readdirSync } from "fs";
import { getAllDictEntries } from "@/lib/dict/registry";

// 모든 등록된 entry 수집
const entries = getAllDictEntries();
const slugSet = new Set(entries.map((e) => `${e.category}/${e.slug}`));

console.log(`총 등록 entry: ${entries.length}\n`);

// 카테고리별 카운트
const categoryCount: Record<string, number> = {};
for (const e of entries) {
  categoryCount[e.category] = (categoryCount[e.category] ?? 0) + 1;
}
console.log("카테고리별 카운트:");
for (const [cat, n] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(15)} ${n}`);
}
console.log();

// related 링크 깨짐 체크
const brokenLinks: { from: string; to: string }[] = [];
for (const e of entries) {
  for (const r of e.related) {
    const target = `${r.category}/${r.slug}`;
    if (!slugSet.has(target)) {
      brokenLinks.push({ from: `${e.category}/${e.slug}`, to: target });
    }
  }
}
console.log(`깨진 related 링크 ${brokenLinks.length}건:`);
const groupedByTo: Record<string, string[]> = {};
for (const b of brokenLinks) {
  groupedByTo[b.to] = groupedByTo[b.to] ?? [];
  groupedByTo[b.to].push(b.from);
}
for (const [to, froms] of Object.entries(groupedByTo).sort(
  (a, b) => b[1].length - a[1].length,
)) {
  console.log(`  → ${to.padEnd(35)} (${froms.length}건 참조)`);
}

// 데이터 파일 vs 등록 entry 비교
console.log("\n데이터 파일 vs 등록 비교:");
const dataDir = "lib/dict/data";
const allFiles: string[] = [];
for (const cat of readdirSync(dataDir)) {
  for (const file of readdirSync(`${dataDir}/${cat}`)) {
    if (file.endsWith(".ts")) {
      const slug = file.replace(".ts", "");
      allFiles.push(`${cat}/${slug}`);
    }
  }
}
console.log(`  파일 수: ${allFiles.length}`);
console.log(`  등록 수: ${entries.length}`);
const unregistered = allFiles.filter((f) => !slugSet.has(f));
if (unregistered.length > 0) {
  console.log(`  미등록 파일 ${unregistered.length}건:`);
  for (const f of unregistered) console.log(`    ${f}`);
}

// hero variant 분포
const heroDist: Record<string, number> = {};
for (const e of entries) {
  heroDist[e.hero.variant] = (heroDist[e.hero.variant] ?? 0) + 1;
}
console.log("\nHero variant 분포:");
for (const [v, n] of Object.entries(heroDist)) {
  console.log(`  ${v.padEnd(15)} ${n}`);
}

// faq 길이 통계
const faqStats = entries.map((e) => e.faq.length);
const avgFaq = faqStats.reduce((a, b) => a + b, 0) / faqStats.length;
console.log(`\nFAQ 평균 ${avgFaq.toFixed(1)}개, 최소 ${Math.min(...faqStats)} / 최대 ${Math.max(...faqStats)}`);

// 본문 sections 통계
const sectionStats = entries.map((e) => e.body.sections.length);
const avgSections = sectionStats.reduce((a, b) => a + b, 0) / sectionStats.length;
console.log(`Body sections 평균 ${avgSections.toFixed(1)}개, 최소 ${Math.min(...sectionStats)} / 최대 ${Math.max(...sectionStats)}`);

// related 길이
const relatedStats = entries.map((e) => e.related.length);
const avgRelated = relatedStats.reduce((a, b) => a + b, 0) / relatedStats.length;
console.log(`Related 평균 ${avgRelated.toFixed(1)}개`);
