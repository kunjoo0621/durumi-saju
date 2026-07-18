/**
 * 허브 시네마틱 포스터 원본(PNG, docs/mockups/assets) → 배포용 WebP(public/images/hub).
 * 원본은 repo 내 보관, 배포엔 WebP만. 목표 장당 ≤200KB.
 * 실행: npx tsx scripts/convert-hub-images.mts
 */
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.resolve("docs/mockups/assets");
const OUT_DIR = path.resolve("public/images/hub");
const FILES = ["saju-grade", "battle", "yearly", "pet", "today"];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  for (const name of FILES) {
    const src = path.join(SRC_DIR, `${name}.png`);
    const out = path.join(OUT_DIR, `${name}.webp`);
    // q80 우선, 200KB 초과 시 q72로 재시도
    let quality = 80;
    let bytes = await encode(src, out, quality);
    if (bytes > 200 * 1024) {
      quality = 72;
      bytes = await encode(src, out, quality);
    }
    total += bytes;
    console.log(`  ${name}.webp  ${(bytes / 1024).toFixed(0)}KB  (q${quality})`);
  }
  console.log(`합계 ${(total / 1024).toFixed(0)}KB`);
}

async function encode(src: string, out: string, quality: number): Promise<number> {
  await sharp(src).webp({ quality, effort: 6 }).toFile(out);
  return (await stat(out)).size;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
