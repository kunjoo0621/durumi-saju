/**
 * Gemini 이미지 모델로 yearly 공유 카드 2장 생성.
 *
 * 1) 메인 공유 카드 (9:16) — 인스타 스토리·Threads
 * 2) 카카오톡 OG 카드 (1.91:1 가로형) — 카카오톡 링크 미리보기
 *
 * 둘 다 텍스트·문자·숫자 절대 금지. 캐릭터 + 그래픽 심볼만.
 *
 * 사용:
 *   NODE_OPTIONS="--conditions=import" npx tsx scripts/yearly-generate-share-card.mts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// .env.local 로드
const envPath = resolve(import.meta.dirname!, "../.env.local");
const envText = readFileSync(envPath, "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  const value = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("✗ GEMINI_API_KEY 없음");
  process.exit(1);
}

const CHARACTER_PATH = "/Users/kunjoo/Desktop/캐릭터_1.png";
const OUT_DIR = resolve(import.meta.dirname!, "../public");

if (!existsSync(CHARACTER_PATH)) {
  console.error(`✗ 캐릭터 이미지 없음: ${CHARACTER_PATH}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const characterBuffer = readFileSync(CHARACTER_PATH);
const characterBase64 = characterBuffer.toString("base64");

const MODEL = "gemini-3.1-flash-image-preview";

// 공통 베이스 ─ 텍스트 절대 금지 + 캐릭터 원본 유지
const SHARED_RULES = `
[핵심 규칙 — 반드시 지킬 것]
- 첨부된 두루미 캐릭터(흰 몸 + 핑크/레드 액센트 + 검정 배경, 부리에 핑크 선)를 그대로 사용. 모양·색·비율 변형 절대 금지.
- 텍스트 절대 금지: 한글·한자·영문·숫자·기호·로고 모두 NO. 어떤 글자도 화면에 들어가면 실패.
- 색 팔레트 고정: 검정(#000000), 흰색(#FFFFFF), 핑크/레드(#FF3E5C ~ #EF4445). 다른 색 금지.
- 추가 그래픽은 위 핑크/흰색 톤만 사용. 노랑·파랑·녹색 등 절대 금지.
- 그래픽은 미니멀·평면(flat)·기하적. 사실적 그라데이션·photoreal·3D 금지.
- 캐릭터의 핑크 부리·머리·몸 비율이 원본과 정확히 일치해야 함.

[운세·신비 모티프 그래픽 — 자유롭게 활용]
- 작은 별(✦/★ 형태 도형), 초승달, 보름달, 궤도 곡선(타원), 점선 원, 동심원
- 별자리 같은 점-선 연결 패턴 (간결하게)
- 캐릭터 부리 끝에서 뻗어나오는 빛줄기·궤적
- 8각별·다이아몬드 같은 기하 도형
- 톤은 신비롭되 과하지 않게. 별은 작은 액센트로만 (화면의 5~10%만 차지).
`;

const MAIN_PROMPT = `너는 운세 서비스 "두루미 사주"의 신년운세 SNS 공유 카드 디자이너야.
${SHARED_RULES}

[메인 카드 사양]
- 비율: 9:16 세로형 (1080x1920 인스타 스토리·Threads 풀스크린).
- 배경: 두루미 캐릭터 원본의 검정을 그대로 확장.
- 캐릭터 위치: 화면 중앙 약간 위. 화면 가로폭의 60~70% 차지.
- 빈 공간(캐릭터 위·아래): 별·궤도·초승달 같은 신비 모티프 그래픽으로 자연스럽게 채워. 단 캐릭터 시선·부리 가리지 마.
- 핵심 비주얼: 캐릭터 부리 끝에서 별·궤적이 뻗어나오는 듯한 신비한 느낌. 운세를 점치는 명리학자 이미지.

다시 강조: 어떤 문자·숫자·한자도 들어가면 안 됨. 순수 비주얼.`;

const KAKAO_PROMPT = `너는 운세 서비스 "두루미 사주"의 카카오톡 링크 미리보기 OG 카드 디자이너야.
${SHARED_RULES}

[카카오톡 OG 카드 사양]
- 비율: 1.91:1 가로형 (1200x630 카카오톡·페이스북·X 링크 미리보기 표준).
- 배경: 검정.
- 캐릭터 위치: 화면 좌측 1/3 영역. 캐릭터 전체가 깨지지 않게 적당히 작게 (세로 80% 채움).
- 우측 2/3 영역: 별·궤도·초승달·8각별·점-선 별자리 패턴으로 신비롭게 구성. 캐릭터 부리 방향(우측)으로 별·궤적이 뻗어나가는 듯한 흐름.
- 좌우 균형 잡힌 가로 구도. 시선이 좌→우로 흐르도록.

다시 강조: 어떤 문자·숫자·한자도 들어가면 안 됨. 순수 비주얼.`;

async function generateCard(prompt: string, outBaseName: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  console.log(`\n[Gemini] ${outBaseName} 생성 요청…`);
  const t0 = Date.now();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY!,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/png", data: characterBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  console.log(`[Gemini] ${outBaseName} 응답 (${Date.now() - t0}ms), status ${res.status}`);

  if (!res.ok) {
    console.error(`✗ ${outBaseName} API 에러:`, JSON.stringify(data, null, 2).slice(0, 800));
    throw new Error("API error");
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part?.inlineData?.data) {
      const mime = part.inlineData.mimeType || "image/png";
      const ext = mime.includes("jpeg") ? "jpg" : "png";
      const outFile = resolve(OUT_DIR, `${outBaseName}.${ext}`);
      writeFileSync(outFile, Buffer.from(part.inlineData.data, "base64"));
      console.log(`✓ 저장: ${outFile} (${mime})`);
      return outFile;
    } else if (part?.text) {
      console.log(`[Gemini text] ${part.text.slice(0, 200)}`);
    }
  }

  throw new Error(`${outBaseName}: 응답에 이미지 없음`);
}

async function main() {
  // 두 장 병렬 생성 (rate-limit 안전 위해 순차)
  await generateCard(MAIN_PROMPT, "yearly-share-card");
  await generateCard(KAKAO_PROMPT, "yearly-share-kakao");
  console.log("\n✓ 2장 생성 완료");
}

main().catch((err) => {
  console.error("✗ 실패:", err?.stack || err);
  process.exit(1);
});
