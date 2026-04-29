import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
process.env.GEMINI_API_KEY = envVars.GEMINI_API_KEY;

const SAJU_TEXT = `
사주팔자: 1995-06-21 남성, 서울
일주: 신묘(辛卯), 시주: 정유(丁酉)
오행 분포: 목 3, 금 3, 화 1, 수 1, 토 0
신살: 도화살, 천을귀인
`;

const SHORT_PROMPT = `너는 사주 분석가다. 아래 사주를 분석하고 JSON으로만 출력해.

${SAJU_TEXT}

출력 형식:
{
  "tier": { "grade": "S|A|B|C|D", "composite": 0-100 },
  "scores": { "재물운": 0-100, "연애운": 0-100, "직장운": 0-100, "건강운": 0-100, "대인운": 0-100 },
  "summary": "2-3문장 한국어 분석"
}

JSON 외 텍스트 금지.`;

async function testWithRealSize(modelId: string) {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  const t0 = Date.now();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: SHORT_PROMPT }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,  // production과 동일
        responseMimeType: "application/json",
      },
    }),
  });

  const elapsed = Date.now() - t0;
  const data = await res.json();

  if (!res.ok) {
    console.log(`❌ ${modelId} (${elapsed}ms): HTTP ${res.status}`);
    console.log("   ", JSON.stringify(data).slice(0, 300));
    return;
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const finishReason = data?.candidates?.[0]?.finishReason;
  const promptTokens = data?.usageMetadata?.promptTokenCount;
  const outputTokens = data?.usageMetadata?.candidatesTokenCount;
  const thoughtTokens = data?.usageMetadata?.thoughtsTokenCount ?? 0;

  console.log(`\n=== ${modelId} (${elapsed}ms) ===`);
  console.log(`finishReason: ${finishReason}`);
  console.log(`tokens: prompt=${promptTokens} output=${outputTokens} thoughts=${thoughtTokens}`);

  try {
    const parsed = JSON.parse(text);
    console.log(`✅ JSON 파싱 성공`);
    console.log(`   grade: ${parsed.tier?.grade}`);
    console.log(`   composite: ${parsed.tier?.composite}`);
    console.log(`   재물운: ${parsed.scores?.재물운}, 연애운: ${parsed.scores?.연애운}, 직장운: ${parsed.scores?.직장운}, 건강운: ${parsed.scores?.건강운}, 대인운: ${parsed.scores?.대인운}`);
    console.log(`   summary: ${parsed.summary?.slice(0, 100)}...`);
  } catch (e: any) {
    console.log(`❌ JSON 파싱 실패: ${e.message}`);
    console.log(`   응답 첫 200자: ${text.slice(0, 200)}`);
  }
}

async function main() {
  console.log("=== production maxOutputTokens(16384)로 실제 사주 분석 테스트 ===");
  await testWithRealSize("gemini-3-flash-preview");
  await testWithRealSize("gemini-3.1-pro-preview");
  await testWithRealSize("gemini-2.5-flash");  // 비교
}
main();
