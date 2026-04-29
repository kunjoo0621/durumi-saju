import { readFileSync } from "fs";

// .env.local 로드
const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
process.env.GEMINI_API_KEY = envVars.GEMINI_API_KEY;
process.env.GOOGLE_API_KEY = envVars.GOOGLE_API_KEY ?? envVars.GEMINI_API_KEY;

async function testModel(modelId: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ API key 없음");
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  const t0 = Date.now();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  '다음 JSON 형식으로만 응답해. 다른 텍스트 금지.\n\n{"test":"ok","model":"<모델명>","sample":"이것은 한국어 테스트입니다"}',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    });

    const elapsed = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      console.log(`❌ ${modelId}  (${elapsed}ms) — HTTP ${res.status}`);
      console.log(`   ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log(`✅ ${modelId}  (${elapsed}ms)`);
    console.log(`   응답: ${text.slice(0, 200)}`);

    // JSON 파싱 검증
    try {
      JSON.parse(text);
      console.log(`   JSON 파싱: ✓`);
    } catch {
      console.log(`   JSON 파싱: ✗ (응답이 JSON이 아님)`);
    }

    return { ok: true, elapsed, text };
  } catch (e: any) {
    console.log(`❌ ${modelId}  네트워크 에러: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log("=== Gemini 3 시리즈 모델 호출 테스트 ===\n");

  const models = [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash", // 비교용 (현재)
  ];

  for (const m of models) {
    await testModel(m);
    console.log("");
  }
}
main();
