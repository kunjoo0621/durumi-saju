// 등급 분포 검증: composite remap 전후로 등급 인구가 동일해야 한다 (경계 보존 확인)
// v2 자체 컷(25/45/65/80) → 사주 마스터 컷(52/70/80/85) remap이
// 0~100 전 구간에서 등급을 바꾸지 않는지 전수 확인.
// 실행: npx tsx scripts/pet-compat-grade-dist.mts
const mod = await import("../lib/pet-compat-scoring");
const { remapComposite }: typeof import("../lib/pet-compat-scoring") = ((mod as any).default ?? mod) as any;

const OLD_CUTS = [25, 45, 65, 80];
const NEW_CUTS = [52, 70, 80, 85];
let fail = 0;
for (let raw = 0; raw <= 100; raw++) {
  const mapped = remapComposite(raw);
  const oldGradeIdx = OLD_CUTS.filter((c) => raw >= c).length; // 0=D .. 4=S
  const newGradeIdx = NEW_CUTS.filter((c) => mapped >= c).length;
  if (oldGradeIdx !== newGradeIdx) {
    console.error(`FAIL raw=${raw} mapped=${mapped} old=${oldGradeIdx} new=${newGradeIdx}`);
    fail++;
  }
}
console.log(fail === 0 ? "PASS: 0~100 전 구간 등급 보존" : `FAIL ${fail}건`);
if (fail > 0) process.exit(1);
