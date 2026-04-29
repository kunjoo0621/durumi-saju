import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
process.env.GEMINI_API_KEY = envVars.GEMINI_API_KEY;

async function rawTest(modelId: string) {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: '{"test":"ok"} 만 출력해. 다른 텍스트 금지.' }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json();
  console.log(`\n=== ${modelId} 전체 응답 ===`);
  console.log(JSON.stringify(data, null, 2).slice(0, 2500));
}

async function main() {
  await rawTest("gemini-3-flash-preview");
  await rawTest("gemini-3.1-pro-preview");
}
main();
