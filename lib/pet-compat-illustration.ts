// 펫 사진 → 카툰 일러스트 변환 (Gemini 2.5 Flash Image)
// v1 (2026-05-11)
//
// 패턴: lib/analysis.ts의 callGemini와 동일 SDK 사용
// 실패 시 null 반환 — analyze는 일러스트 없이도 진행 가능 (안전)

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PetArchetype } from "@/lib/pet-compat-scoring";

const IMAGE_MODEL = "gemini-2.5-flash-image";
const STORAGE_BUCKET = "pet-illustrations";

interface GenerateIllustrationInput {
  photoUrl: string;              // pet-uploads 버킷의 사진 URL (signed 또는 public)
  petName: string;
  petSpecies: "dog" | "cat";
  petBreed?: string;
  resultId: string;              // pet_compat_results.id (저장 경로 키)
  archetype?: PetArchetype;      // v0.4(Track B): 있으면 관계 장면, 없으면 펫-only fallback
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
// 프롬프트 — 픽사풍 3D + 관계 장면 (archetype)
// 스타일 락(B0): 스타일 A 픽사 소프트 3D 확정. 축→시각: ruler=수직구도, affectionGap=뻗는방향,
// sync=거리, conflict="귀엽게 삐진". 보호자는 얼굴/전신 금지, 가장자리 손만.
// ────────────────────────────────────────────────────────

const SCENE_BLOCKS: Record<PetArchetype, string> = {
  HARMONY:
    "화면 가장자리에서 들어온 보호자의 손이 아이의 등이나 머리를 부드럽게 감싸고, 아이는 그 손 쪽으로 편안히 몸을 기댄다. 가까운 거리에서 같은 방향을 보는 따뜻한 무드.",
  OWNER_DEVOTION:
    "화면 가장자리의 보호자 손이 간식이나 장난감을 아이 쪽으로 내밀지만, 아이는 살짝 고개를 돌려 시크하게 딴 곳을 본다. 손 주변에만 작은 하트 한두 개.",
  PET_DEVOTION:
    "아이가 화면 가장자리의 보호자 손바닥에 뺨이나 앞발을 부비며 올려다본다. 아이 쪽에 작은 하트, 애틋하고 따뜻한 무드.",
  PET_THRONE:
    "아이가 푹신하고 높은 방석 위에 여유롭고 당당하게 앉아 살짝 아래를 내려다보고, 화면 아래 가장자리에서 보호자의 두 손이 간식 그릇을 공손히 받쳐 올린다.",
  OWNER_MANAGER:
    "아이가 얌전히 앉아 있고, 화면 가장자리의 보호자 손이 브러시로 아이를 정돈해 준다. 차분하고 정돈된 구도.",
  OFFBEAT:
    "아이는 살짝 등을 돌린 채 귀엽게 삐진 새침한 표정으로 손과 다른 방향을 보지만, 꼬리와 몸은 은근히 손 쪽을 향한다. 둘 사이에 아무도 안 건드린 장난감 하나. 험악하지 않게 사랑스럽게.",
  ROOMMATE:
    "아이와 화면 가장자리의 손이 적당한 거리를 두고 각자 공간에 있되, 서로를 슬쩍 의식하는 시선. 무심한 듯 편안한 동거 무드.",
  DISTANT_FATE:
    "창가의 은은한 빛 아래, 아이는 조금 떨어져 있지만 화면 가장자리에서 보호자의 손이 조심스레 다가간다. 거리감은 있으나 희망적이고 애틋한 톤 (단절감·쓸쓸함 금지).",
};

const OWNER_CONSTRAINT =
  "보호자는 얼굴·몸통·전신을 절대 그리지 않는다 — 화면 가장자리에서 들어오는 손(또는 무릎)만, 아이와 똑같은 3D 스타일의 단순하고 둥근 손으로. 아이가 화면의 60~75%를 차지하는 주인공이고, 소품은 한 개까지만.";

function buildIllustrationPrompt(
  petName: string,
  petSpecies: "dog" | "cat",
  petBreed?: string,
  archetype?: PetArchetype,
): string {
  const speciesText = petSpecies === "dog" ? "강아지" : "고양이";
  const breedText = petBreed ? ` (${petBreed})` : "";
  const relationBlock = archetype
    ? `\n[장면 — 보호자와의 관계]\n${SCENE_BLOCKS[archetype]}\n${OWNER_CONSTRAINT}\n`
    : "";

  return `이 ${speciesText}${breedText} 사진을 픽사·디즈니 애니메이션 같은 귀여운 3D 캐릭터로 변환해줘.

[정체성 — 최우선]
- 사진 속 이 아이의 털색·무늬·품종 특징·귀와 얼굴 생김·표정을 그대로 유지한다. 이 아이가 주인공이다.
${relationBlock}
[연출 — 과감하게]
- 밋밋한 증명사진 포즈 금지. 감정과 성격을 캐리커처처럼 과장해라 — 표정(도도함·눈웃음·삐짐·간절함)과 포즈를 크고 드라마틱하게.
- 위 관계 장면의 역학(누가 상전인지, 누가 매달리는지)이 한눈에 읽히도록 구도·시선·몸짓을 과장. 다이내믹한 카메라 앵글(살짝 위/아래에서) OK.
- 단, 과장이 정체성과 귀여움을 해치면 안 됨. 무섭거나 그로테스크하게는 금지 — 사랑스럽게 과감하게.

[스타일]
- 픽사풍 소프트 3D 렌더, 통통하고 귀여운 비율, 부드러운 벨벳 같은 털 질감, 입체감 있는 라이팅과 또렷한 림라이트, 큰 반짝이는 눈
- 미니멀한 단색/그라데이션 배경 (어두운 진회색 또는 진녹색 톤), 주인공에 시선이 쏠리는 대비
- 정사각형 1:1 비율
- 이미지 안에 텍스트·문자·숫자 절대 금지
- 사람 얼굴·전신·실사풍 손 금지

우선순위: 정체성 > 장면 연출 > 스타일.
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

    // 2. Gemini Image 호출 — 2단 fallback: ① 관계 프롬프트(archetype) → 실패 시 ② 펫-only 재시도
    const genImage = async (archetype?: PetArchetype): Promise<any | null> => {
      const prompt = buildIllustrationPrompt(input.petName, input.petSpecies, input.petBreed, archetype);
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
      const parts = (response as any)?.candidates?.[0]?.content?.parts || [];
      return parts.find((p: any) => p?.inlineData?.data) || null;
    };

    let imagePart: any = null;
    try {
      imagePart = await genImage(input.archetype);                 // ① 관계 프롬프트
    } catch { imagePart = null; }
    if (!imagePart && input.archetype) {
      try { imagePart = await genImage(undefined); } catch { imagePart = null; }  // ② 펫-only 재시도 (실패율 하한 = 현행 보장)
    }
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
