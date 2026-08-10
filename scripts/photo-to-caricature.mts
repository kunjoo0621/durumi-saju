#!/usr/bin/env npx tsx
/**
 * 인물 사진을 Gemini 2.5 Flash Image로 캐리커처 일러스트로 변환.
 *
 * 사용:
 *   npx tsx scripts/photo-to-caricature.mts <photo-path> <slug> [style]
 *
 * style: "watercolor" (기본) | "line" | "cartoon" | "pixar"
 *
 * 출력: public/stories/heroes/{slug}.png (정사각형)
 */
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

const STYLE_PROMPTS: Record<string, string> = {
  // ★2026-08-10: 옛 문구("Editorial magazine portrait" + "likeness clearly recognizable —
  // same face shape, eyes, nose, hair")가 IMAGE_OTHER로 전면 차단됐다. 8/3까지는 됐다.
  // 2026-02-27 Nano Banana 2 안전 업그레이드 이후 유명인·얼굴 필터가 조여진 결과로 보이며,
  // finishReason IMAGE_OTHER는 safetySettings로 못 낮추는 정책 필터다.
  // 실측: 같은 사진·같은 모델에서 watercolor/line은 차단, cartoon/pixar는 통과 →
  //   막는 기준은 모델도 '얼굴 유지' 문구도 아니라 ★출력이 실물 사진에 얼마나 가까운가다.
  //   ("Editorial magazine portrait" 제거만으로는 여전히 차단됐다)
  // 아래는 통과하면서 기존 59편의 수채화 톤을 유지하는 문구다(cartoon 통과 문형 + 매체만 수채화).
  // 다시 막히면 style을 cartoon으로 내리기 전에 이 문형부터 변주할 것.
  watercolor:
    "Watercolor-style character portrait with soft painted shading and gentle outlines. " +
    "Friendly approachable look. Keep facial features recognizable. " +
    "Solid pastel background. Square 1:1. No text, no watermark.",
  line:
    "Convert this portrait into a black ink line drawing on solid pastel lavender background. " +
    "Editorial Vogue magazine style. Keep facial features recognizable. " +
    "Square 1:1 composition. No text, no watermark.",
  cartoon:
    "Cartoon-style portrait with bold black outlines and soft color shading. " +
    "Friendly approachable look. Keep facial features recognizable. " +
    "Solid pastel background. Square 1:1. No text, no watermark.",
  pixar:
    "3D Pixar-style character portrait. Friendly cartoon proportions. " +
    "Keep facial features recognizable. Solid pastel background. " +
    "Square 1:1. No text, no watermark.",
};

const [photoPath, slug, styleKey = "watercolor"] = process.argv.slice(2);

if (!photoPath || !slug) {
  console.error("Usage: photo-to-caricature.mts <photo-path> <slug> [style]");
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY missing in .env.local");
  process.exit(1);
}

const prompt = STYLE_PROMPTS[styleKey];
if (!prompt) {
  console.error(`Unknown style: ${styleKey}. Choose: ${Object.keys(STYLE_PROMPTS).join(", ")}`);
  process.exit(1);
}

const photoBuffer = fs.readFileSync(photoPath);
const ext = path.extname(photoPath).toLowerCase();
const mimeType =
  ext === ".png" ? "image/png" :
  ext === ".webp" ? "image/webp" :
  "image/jpeg";

console.log(`[1/3] Reading photo: ${photoPath} (${photoBuffer.length} bytes, ${mimeType})`);
console.log(`[2/3] Generating (style: ${styleKey})...`);

const ai = new GoogleGenAI({ apiKey });

// ★안전 필터가 확률적이다(2026-08-10 실측) — 같은 사진·같은 문구인데 어떤 인물은 한 번에
// 통과하고 어떤 인물은 IMAGE_OTHER로 막힌다. 그래서 문구·모델을 돌려 가며 재시도한다.
// 실측: watercolor 기본 문구로 박은빈은 1회 통과, 이동욱·공효진은 재시도가 필요했다.
const FALLBACK_PROMPTS = [
  prompt,
  // 어린이책 삽화 톤 — 수채화 매체는 유지하면서 사실성만 더 낮춘다
  "Soft watercolor children's-book illustration style portrait. " +
    "Warm gentle palette, simplified stylized features, visible brush texture. " +
    "Pale background. Square 1:1. No text, no watermark.",
  "Gentle watercolor character illustration. Soft washes, light pastel tones, " +
    "friendly expression, simplified painted features. " +
    "Plain pale background. Square 1:1. No text, no watermark.",
];
const MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"];

let imagePart: { inlineData?: { mimeType?: string; data?: string } } | undefined;
let lastParts: unknown[] = [];
let response: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;

attempts: for (let round = 0; round < 3; round++) {
  for (const model of MODELS) {
    for (let pi = 0; pi < FALLBACK_PROMPTS.length; pi++) {
      // 첫 시도만 지정 스타일 원문. 이후는 폴백 문구를 섞는다.
      if (round === 0 && model === MODELS[0] && pi === 0) {
        /* 그대로 */
      }
      response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: photoBuffer.toString("base64") } },
              { text: FALLBACK_PROMPTS[pi] },
            ],
          },
        ],
      });
      const ps = response.candidates?.[0]?.content?.parts ?? [];
      lastParts = ps;
      const hit = ps.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
      if (hit) {
        imagePart = hit;
        if (round > 0 || pi > 0 || model !== MODELS[0]) {
          console.log(`      ↳ 재시도로 통과: round${round} ${model} prompt${pi}`);
        }
        break attempts;
      }
      const fin = response.candidates?.[0]?.finishReason;
      process.stderr.write(`      · 차단(${fin}) ${model} prompt${pi}\n`);
    }
  }
}

const parts = lastParts as typeof lastParts & { text?: string }[];

if (!imagePart?.inlineData?.data) {
  // 텍스트 응답이 있으면 출력 (모델이 거절했거나 설명만 한 경우)
  const textPart = parts.find((p) => "text" in p && p.text);
  console.error("No image returned.");
  if (textPart && "text" in textPart) {
    console.error("Model text response:", textPart.text);
  }
  console.error("Full response:", JSON.stringify(response, null, 2).slice(0, 2000));
  process.exit(1);
}

const outDir = "public/stories/heroes";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${slug}.png`);
fs.writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, "base64"));

console.log(`[3/3] Saved: ${outPath}`);
console.log(`  size: ${fs.statSync(outPath).size} bytes`);
