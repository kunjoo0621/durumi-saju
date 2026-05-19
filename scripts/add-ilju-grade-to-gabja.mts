/**
 * 60갑자 entry highlight 배열 첫 위치에 "일주 등급" 한 줄 추가
 *
 * tsx scripts/add-ilju-grade-to-gabja.mts
 *
 * 멱등성 보장 — 이미 "일주 등급" 라벨 있으면 skip.
 */
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const GABJA_DIR = "lib/dict/data/gabja";

const GRADE_MAP: Record<string, { tier: number; label: string }> = {};
const GRADE_1 = ["甲子", "丁酉", "丁亥", "戊子", "己亥", "壬午", "癸巳", "癸卯"];
const GRADE_2 = ["甲寅", "乙卯", "乙未", "丙子", "丙寅", "丙辰", "丙戌", "丁卯", "戊辰", "己酉", "己丑", "庚辰", "庚午", "庚申", "辛酉", "辛丑", "壬寅", "壬辰", "癸未", "癸酉", "癸丑"];
const GRADE_3 = ["甲辰", "甲午", "甲戌", "乙巳", "乙亥", "乙丑", "丙申", "丁未", "丁丑", "戊寅", "戊申", "戊戌", "己巳", "己未", "庚寅", "庚戌", "辛巳", "辛未", "辛亥", "壬申", "壬戌"];
const GRADE_4 = ["甲申", "乙酉", "丙午", "丁巳", "戊午", "己卯", "庚子", "辛卯", "壬子", "癸亥"];

const TIER_LABEL: Record<number, string> = {
  1: "1등급 (상등) · 4점",
  2: "2등급 (중상등) · 3점",
  3: "3등급 (중등) · 2점",
  4: "4등급 (하등) · 1점",
};

for (const h of GRADE_1) GRADE_MAP[h] = { tier: 1, label: TIER_LABEL[1] };
for (const h of GRADE_2) GRADE_MAP[h] = { tier: 2, label: TIER_LABEL[2] };
for (const h of GRADE_3) GRADE_MAP[h] = { tier: 3, label: TIER_LABEL[3] };
for (const h of GRADE_4) GRADE_MAP[h] = { tier: 4, label: TIER_LABEL[4] };

const totalMapped = GRADE_1.length + GRADE_2.length + GRADE_3.length + GRADE_4.length;
console.log(`등급 매핑: 총 ${totalMapped}개 (1등급 ${GRADE_1.length} / 2등급 ${GRADE_2.length} / 3등급 ${GRADE_3.length} / 4등급 ${GRADE_4.length})`);

const files = readdirSync(GABJA_DIR).filter(f => f.endsWith(".ts") && !f.startsWith("ilju-grade"));
console.log(`60갑자 파일 ${files.length}건 처리\n`);

let updated = 0;
let skipped = 0;
let notFound = 0;

for (const file of files) {
  const path = join(GABJA_DIR, file);
  const content = readFileSync(path, "utf-8");

  // 이미 처리됐는지 (멱등성)
  if (content.includes('label: "일주 등급"')) {
    skipped++;
    continue;
  }

  // hanja 필드에서 한자 2자 추출
  const hanjaMatch = content.match(/hanja:\s*"([^"]+)"/);
  if (!hanjaMatch) {
    console.log(`✗ ${file}: hanja 필드 없음`);
    notFound++;
    continue;
  }
  const hanja = hanjaMatch[1];
  const mapping = GRADE_MAP[hanja];
  if (!mapping) {
    console.log(`✗ ${file}: 한자 "${hanja}" 등급 매핑 없음`);
    notFound++;
    continue;
  }

  // highlight 배열 첫 항목 앞에 새 항목 추가
  // 패턴: `highlight: [\n    { label: "60갑자 순번", ... },`
  const highlightRegex = /(highlight:\s*\[\s*\n\s*)(\{)/;
  if (!highlightRegex.test(content)) {
    console.log(`✗ ${file}: highlight 배열 패턴 매칭 실패`);
    notFound++;
    continue;
  }

  const newLine = `{ label: "일주 등급", value: "${mapping.label}" },\n    `;
  const newContent = content.replace(highlightRegex, `$1${newLine}$2`);

  writeFileSync(path, newContent);
  updated++;
  console.log(`✓ ${file.padEnd(20)} ${hanja} → ${mapping.tier}등급`);
}

console.log(`\n결과: 업데이트 ${updated} / 멱등 스킵 ${skipped} / 실패 ${notFound}`);
