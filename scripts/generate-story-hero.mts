/**
 * 매거진 글 hero 이미지 생성 — Nano Banana 2 + master.png ref.
 *
 * master.png = `~/projects/durumi-longform/public/output/character/master.png` (chibi 두루미).
 * 결과는 `public/stories/heroes/{slug}.png`.
 *
 * 사용:
 *   npx tsx scripts/generate-story-hero.mts --slug dombok-saju --prompt "..."
 *   --force : 기존 파일 있어도 재생성
 */
import dotenv from "dotenv";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";

// 매거진은 .env.local 사용
dotenv.config({ path: ".env.local" });

/**
 * Nano Banana 응답이 mimeType은 PNG여도 실제 JPEG 데이터일 수 있음.
 * sips로 진짜 PNG 변환 (확장자·실제 형식 일치 + Next/Image 정상 처리).
 */
async function convertToPng(filePath: string): Promise<void> {
  const tmpPath = `${filePath}.raw`;
  await rename(filePath, tmpPath);
  await new Promise<void>((resolve, reject) => {
    const p = spawn("sips", ["-s", "format", "png", tmpPath, "--out", filePath], {
      stdio: "ignore",
    });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`sips exit ${code}`))));
  });
  await unlink(tmpPath);
}
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";

const NANO_BANANA = "gemini-3.1-flash-image-preview";
const MASTER_PATH = "/Users/kunjoo/projects/durumi-longform/public/output/character/master.png";

/**
 * 매거진 hero 일러스트 — 글 무관 항상 일관된 결로 박힘.
 * 매번 prompt 끝에 자동 append. 결 변경 시 한 곳만 수정.
 *
 * 결 룰:
 *  - 캐릭터: chibi 3D Pixar 두루미 (master.png 결)
 *  - 비주얼: warm pastel cream + coral accents
 *  - 조명: soft golden-amber from upper-left
 *  - 텍스처: fine film grain, shallow depth of field
 *  - 매거진 hero illustration 결 (NYT magazine·토스피드)
 *  - 16:9 horizontal
 */
const STYLE_SUFFIX =
  " — Style locked: chibi 3D Pixar render matching master.png reference (white feathers, coral pink crest, coral pink beak, large round cartoon eyes, chibi proportions). " +
  "Warm pastel cream background with subtle coral accents, soft golden-amber lighting from upper-left, fine film grain, shallow depth of field. " +
  "Premium editorial magazine hero illustration feel (NYT magazine / Toss Feed editorial), 16:9 horizontal. " +
  "NO readable text, NO hanja, NO chinese characters, NO writing, NO numbers, NO other animals, NO human faces, NO photorealistic textures, NO scary or threatening imagery.";

interface NanoBananaPart {
  inlineData?: { data: string; mimeType: string };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");

  const slug = arg("--slug");
  const prompt = arg("--prompt");
  const force = process.argv.includes("--force");
  const noRef = process.argv.includes("--no-ref");

  if (!slug || !prompt) {
    console.error("사용: --slug <slug> --prompt \"<prompt>\" [--force] [--no-ref]");
    process.exit(1);
  }

  const outDir = join("public/stories/heroes");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${slug}.png`);

  if (existsSync(outPath) && !force) {
    console.log(`[hero] ${slug} ✓ (이미 있음, --force로 재생성)`);
    return;
  }

  const client = new GoogleGenAI({ apiKey });

  console.log(`[hero] ${slug} 생성 중…`);
  console.log(`       ref: ${noRef ? "none (메타포 일러스트)" : "master.png (두루미 캐릭터)"}`);
  console.log(`       prompt: ${prompt.slice(0, 80)}…`);

  const contents = noRef
    ? [{ text: `Wide 16:9 horizontal magazine hero illustration. ${prompt}${STYLE_SUFFIX}` }]
    : await (async () => {
        const master = await readFile(MASTER_PATH);
        return [
          { inlineData: { data: master.toString("base64"), mimeType: "image/png" } },
          {
            text: `Same exact chibi crane character as in the reference image (same body shape, same coral pink crest, same eyes, same proportions). Wide 16:9 horizontal magazine hero composition. New scene: ${prompt}${STYLE_SUFFIX}`,
          },
        ];
      })();

  const result = await client.models.generateContent({
    model: NANO_BANANA,
    contents: contents as never,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "16:9" },
    } as never,
  });

  const parts = (result.candidates?.[0]?.content?.parts ?? []) as NanoBananaPart[];
  const part = parts.find((p) => p.inlineData);
  if (!part?.inlineData) throw new Error("Nano Banana 응답에 이미지 없음");

  const buf = Buffer.from(part.inlineData.data, "base64");
  await writeFile(outPath, buf);

  // Nano Banana 응답이 JPEG로 박힐 수 있음 → 진짜 PNG로 변환 (확장자 일치)
  await convertToPng(outPath);
  const finalBuf = await readFile(outPath);
  console.log(`[hero] ✓ ${outPath} (${(finalBuf.length / 1024).toFixed(0)}KB, PNG 변환 완료)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
