// 펫 사진 → 카툰 일러스트 변환 (Gemini 2.5 Flash Image)
// v1 (2026-05-11)
//
// 패턴: lib/analysis.ts의 callGemini와 동일 SDK 사용
// 실패 시 null 반환 — analyze는 일러스트 없이도 진행 가능 (안전)

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const IMAGE_MODEL = "gemini-2.5-flash-image";
const STORAGE_BUCKET = "pet-illustrations";

interface GenerateIllustrationInput {
  photoUrl: string;              // pet-uploads 버킷의 사진 URL (signed 또는 public)
  petName: string;
  petSpecies: "dog" | "cat";
  petBreed?: string;
  resultId: string;              // pet_compat_results.id (저장 경로 키)
}

interface GenerateIllustrationOutput {
  ok: true;
  illustrationUrl: string;       // 공개 URL
  illustrationPath: string;      // Storage 경로
}

interface GenerateIllustrationFailure {
  ok: false;
  reason: string;
}

// Gemini SDK 클라이언트 (dynamicImport 패턴 — webpack 정적 분석 회피)
// 프로젝트는 신 SDK @google/genai 사용 (구 @google/generative-ai 아님)
let googleAiClientPromise: Promise<any | null> | null = null;
async function getClient(): Promise<any | null> {
  if (!googleAiClientPromise) {
    googleAiClientPromise = (async () => {
      try {
        const dynamicImport = new Function("moduleName", "return import(moduleName)") as (
          moduleName: string,
        ) => Promise<any>;
        const sdk = await dynamicImport("@google/genai");
        const GoogleGenAI = sdk?.GoogleGenAI;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!GoogleGenAI || !apiKey) return null;
        return new GoogleGenAI({ apiKey });
      } catch {
        return null;
      }
    })();
  }
  return googleAiClientPromise;
}

// ────────────────────────────────────────────────────────
// 프롬프트 — 펫 정체성 보존 + 카툰화 (라벨 무관)
// ────────────────────────────────────────────────────────

function buildIllustrationPrompt(petName: string, petSpecies: "dog" | "cat", petBreed?: string): string {
  const speciesText = petSpecies === "dog" ? "강아지" : "고양이";
  const breedText = petBreed ? ` (${petBreed})` : "";

  return `이 ${speciesText}${breedText} 사진을 귀여운 카툰 일러스트로 변환해줘.

스타일 가이드:
- 부드러운 파스텔 톤
- 미니멀한 단색 또는 그라데이션 배경 (어두운 진녹색 또는 진회색 톤이 좋음)
- 동물의 본래 모습(색깔·품종 특징·표정)을 살리되 일러스트 스타일로 단순화
- 스티커처럼 윤곽 명확
- 정사각형 1:1 비율
- 동물 외에 텍스트/문자 추가 금지

펫 이름: ${petName}`;
}

// ────────────────────────────────────────────────────────
// 메인 함수
// ────────────────────────────────────────────────────────

export async function generatePetIllustration(
  input: GenerateIllustrationInput,
): Promise<GenerateIllustrationOutput | GenerateIllustrationFailure> {
  try {
    const client = await getClient();
    if (!client) {
      return { ok: false, reason: "Gemini SDK 또는 GEMINI_API_KEY 미설정" };
    }

    // 1. 사진 다운로드 (Supabase URL → buffer)
    let photoBuffer: Buffer;
    let photoMime = "image/jpeg";
    try {
      const photoRes = await fetch(input.photoUrl);
      if (!photoRes.ok) throw new Error(`photo fetch ${photoRes.status}`);
      const arrayBuf = await photoRes.arrayBuffer();
      photoBuffer = Buffer.from(arrayBuf);
      photoMime = photoRes.headers.get("content-type") || "image/jpeg";
    } catch (e: any) {
      return { ok: false, reason: `사진 로드 실패: ${e?.message || "unknown"}` };
    }

    // 2. Gemini Image 호출 (이미지 input + 텍스트 prompt → 이미지 output)
    const prompt = buildIllustrationPrompt(input.petName, input.petSpecies, input.petBreed);
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: photoMime, data: photoBuffer.toString("base64") } },
            { text: prompt },
          ],
        },
      ],
    });

    // 응답에서 이미지 파트 추출
    const parts = (response as any)?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data);
    if (!imagePart) {
      return { ok: false, reason: "Gemini 응답에 이미지 없음" };
    }

    const generatedMime = imagePart.inlineData.mimeType || "image/png";
    const generatedBuffer = Buffer.from(imagePart.inlineData.data, "base64");

    // 3. Supabase Storage에 저장
    const ext = generatedMime.includes("png") ? "png" : "jpg";
    const path = `${input.resultId}/${Date.now()}.${ext}`;
    const upload = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, generatedBuffer, {
        contentType: generatedMime,
        upsert: false,
      });

    if (upload.error) {
      return { ok: false, reason: `Storage 업로드 실패: ${upload.error.message}` };
    }

    // 4. 공개 URL 반환
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return {
      ok: true,
      illustrationUrl: urlData.publicUrl,
      illustrationPath: path,
    };
  } catch (error: any) {
    return { ok: false, reason: error?.message || "예상치 못한 오류" };
  }
}
