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

// 아키타입별 "테마 세계관" — 테마 배경 + 필수 소품 + 선택 소품 풀(변주) + 손 배역 + 펫 포즈.
// 핵심 은유(왕관·선물더미 등)는 라벨과 일치하므로 변주 금지, 선택 소품·앵글만 매번 다르게.
const SCENE_BLOCKS: Record<PetArchetype, string> = {
  PET_THRONE:
    "[테마: 로열 팰리스] 어둑한 왕궁 알현실 — 벨벳 커튼과 은은한 샹들리에 보케, 금색과 버건디 악센트. 아이는 벨벳 옥좌(혹은 옥좌처럼 높고 화려한 방석) 위에 여유롭고 당당하게 앉아 턱을 살짝 들고 아래를 내려다본다. 머리 위에 작은 황금 왕관을 살짝 삐딱하게 씌운다. 화면 아래 가장자리에서 보호자의 두 손이 시종처럼 간식이 담긴 은쟁반을 공손히 받쳐 올린다. 선택 소품(붉은 카펫, 간식 탑, 방석 계단, 금술 쿠션) 중 2~3개를 자유롭게 골라 배치하고, 카메라는 살짝 로우앵글로 아이의 위엄을 귀엽게 과장한다.",
  OWNER_DEVOTION:
    "[테마: 스포트라이트 구애 무대] 어두운 방 안, 아이에게만 무대 스포트라이트가 쏟아지고 주변은 어둠에 잠긴다. 화면 가장자리에서 보호자의 손이 간식이나 장미 한 송이를 간절히 내밀고, 손 주변에는 리본 묶인 선물 상자 더미가 쌓여 있다. 아이는 빛 한가운데서 시크하게 고개를 살짝 돌리지만 곁눈질로는 은근히 손을 의식한다 — 차가움이 아니라 도도한 귀여움. 선택 소품(간식 탑, 꽃다발, 하트 풍선, 손 주변의 작은 하트들) 중 2~3개를 자유롭게 변주한다.",
  PET_DEVOTION:
    "[테마: 현관 앞 해바라기] 골든아워 빛이 길게 스며드는 현관/복도 — 앰버 악센트의 따뜻한 어스름. 아이는 보호자의 산책줄(또는 슬리퍼 같은 물건)을 입에 물거나 앞발로 끌어안고, 화면 가장자리에서 돌아온 보호자의 손바닥에 뺨과 앞발을 부비며 온몸으로 반긴다. 꼬리 흔들림과 몸 기울기까지 크게. 선택 소품(현관 러그, 보호자 슬리퍼 한 켤레, 아이 주변에 떠오르는 작은 하트, 문틈으로 새어드는 빛줄기) 중 2~3개를 자유롭게 고른다.",
  HARMONY:
    "[테마: 포근한 저녁 거실] 스탠드 조명과 벽난로 불빛이 은은한 저녁 거실, 진회 베이스에 웜 오렌지 악센트. 화면 가장자리에서 들어온 보호자의 손이 아이의 등을 부드럽게 감싸고, 아이는 그 손에 편안히 기대 눈웃음 지으며 손과 같은 방향을 바라본다. 둘 앞에는 같은 패턴의 커플 아이템(담요와 쿠션, 김 나는 머그와 물그릇)이 나란히. 선택 소품(창밖의 달과 별, 글자 없는 폴라로이드 액자, 소파 위 니트) 중 2~3개를 골라 아늑함을 더한다.",
  OWNER_MANAGER:
    "[테마: 프리미엄 그루밍 살롱] 정갈하게 각 잡힌 살롱/스파 코너 — 진녹 베이스, 차분한 골드 악센트. 아이는 얌전히 앉아 눈을 지그시 감고 호강하는 표정이고, 화면 가장자리에서 보호자의 유능한 집사 손이 브러시로 아이를 정성껏 정돈한다. 선택 소품(가지런히 개켜진 수건 타워, 빗·리본 정렬 선반, 세면 그릇, 은은한 스팀, 발 매트) 중 2~3개를 배치.",
  OFFBEAT:
    "[테마: 방치된 장난감 산의 삐짐 현장] 놀이 코너의 저녁, 어질러진 흔적이 귀엽게 보이는 웜 라이트. 아이는 등을 살짝 돌린 채 뾰로통·새침한 표정으로 손과 다른 방향을 보지만 꼬리와 귀는 은근히 손 쪽을 향한다. 등 뒤에는 손도 안 댄 장난감 산(공·오리 인형·깃털 막대). 화면 가장자리에서 보호자의 손이 장난감 하나를 들고 조심스레 화해를 시도한다. 험악 금지, 사랑스러운 삐짐. 선택 소품(넘어진 간식통, 반쯤 뜯다 만 장난감 포장) 중 1~2개.",
  ROOMMATE:
    "[테마: 반반 나눠 쓰는 방] 화면이 좌우 두 존으로 은근히 나뉜 방 — 아이 존(캣타워/쿠션)과 사람 존(책상 모서리), 러그가 경계. 아이는 자기 자리에서 무심한 척, 시선만 슬쩍 손 쪽으로 곁눈질하는 츤데레. 화면 가장자리에서 동거인의 손이나 무릎이 자기 존에서 머그를 들거나 걸쳐 있다. 선택 소품(각자 영역의 살림 — 펫 쪽 장난감 vs 사람 쪽 글자 없는 머그·책, 스탠드 불빛, 경계 러그) 중 2~3개.",
  DISTANT_FATE:
    "[테마: 노을 창가] 큰 창으로 노을이 길게 스며드는 방 — 앰버·라일락 노을 악센트, 바닥에 길게 뻗은 빛. 창턱에 새싹 화분(천천히 스며드는 인연의 은유). 아이는 조금 떨어져 있지만 화면 가장자리에서 조심스레 다가가는 보호자의 손(간식을 살며시 놓아두는) 쪽을 호기심 어린 눈으로 가만히 바라본다. 선택 소품(창밖 노을 구름, 아직 안 쓴 새 방석, 놓인 간식 하나) 중 1~2개. ★단절감·쓸쓸함 금지 — 희망적이고 애틋하게.",
};

const OWNER_CONSTRAINT =
  "보호자는 얼굴·몸통·전신을 절대 그리지 않는다 — 화면 가장자리에서 들어오는 손(또는 무릎)만, 아이와 똑같은 3D 스타일의 단순하고 둥근 손으로. 아이가 화면의 55~75%를 차지하는 단 하나의 주인공이다: 화면에서 가장 밝고 가장 선명하고 가장 초점이 맞은 존재는 항상 아이여야 하며, 어떤 소품도 아이의 얼굴을 가리면 안 된다.";

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
- 배경은 위 장면의 테마 세계관을 풍성하게 — 단 어두운 시네마틱 무드(진회/진녹 베이스)를 유지하고, 장면이 지정한 악센트 컬러 1~2가지만 얹는다. 파스텔 톤·형광색·대낮의 쨍한 밝은 배경 금지
- 얕은 피사계심도: 배경과 먼 소품은 부드러운 보케로 흐리고, 아이에게만 선명한 초점. 배경은 아이보다 어둡고 채도가 낮아야 한다 (아이가 묻히면 실패)
- 소품은 장면 블록이 지정한 것만 3~5개, 전부 관계를 설명하는 조연으로. 멀리서 작게 봐도 관계 한 줄이 읽히는 크고 단순한 실루엣 구도
- 정사각형 1:1 비율
- 이미지 안에 텍스트·문자·숫자 절대 금지 — 책·액자·간판·라벨 같은 소품에도 글자를 그리지 않는다
- 사람 얼굴·전신·실사풍 손 금지

우선순위: ① 정체성(사진 속 이 아이의 털색·무늬·생김) > ② 아이가 주인공(초점·크기·밝기) > ③ 관계 장면·테마 > ④ 스타일. 충돌하면 항상 앞 순위가 이긴다 — 배경이 화려해서 아이의 디테일이 흐려질 것 같으면 배경을 단순하게 후퇴시켜라.
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
