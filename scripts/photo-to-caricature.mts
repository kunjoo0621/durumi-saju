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
  watercolor:
    "Convert this portrait photo into a soft watercolor illustration. " +
    "Keep the person's facial features and likeness clearly recognizable — same face shape, eyes, nose, hair. " +
    "Soft delicate watercolor brush strokes, light wash colors, gentle edges. " +
    "Pale pastel background (soft lavender or off-white), no harsh outlines. " +
    "Editorial magazine portrait style, elegant and refined. " +
    "Square 1:1 composition with the subject centered. " +
    "No text, no watermark, no signature.",
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
console.log(`[2/3] Calling Gemini 2.5 Flash Image (style: ${styleKey})...`);

const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: photoBuffer.toString("base64") } },
        { text: prompt },
      ],
    },
  ],
});

const parts = response.candidates?.[0]?.content?.parts ?? [];
const imagePart = parts.find(
  (p) => p.inlineData?.mimeType?.startsWith("image/"),
);

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
