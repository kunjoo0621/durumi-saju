/**
 * 다른 AI 지적 검증:
 * 1) 본문에 "단독 등급 표현"(A로, B에서, S로 같은 X+조사) 얼마나 빈번한가
 * 2) 새 분석 저장 시 transformGradesDeep 적용되는가 (DB raw에 옛 라벨 그대로?)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

// 본문 sample — 최근 50건
const { data: rows } = await sb
  .from("saju_results")
  .select("name, created_at, full_json")
  .not("full_json", "is", null)
  .gte("created_at", "2026-05-01")
  .order("created_at", { ascending: false })
  .limit(50);

// 단독 등급 표현 — 영문 앞이 한글이고 뒤에 한글 조사가 오는 경우.
// "X등급" 패턴은 제외 (suffix 자리에 "등급"이 오면 다른 정규식이 잡음).
const STANDALONE_PATTERNS = [
  /(\s|[가-힣])([SABCD])(로|에서|에게|에|부터|까지|처럼|라는|이라는|의|보다|와|과|이|가|은|는|로의|로서|로써)([가-힣\s,.!?])/g,
];

const counts = new Map<string, number>();
const samples: string[] = [];

for (const r of rows ?? []) {
  const fj = r.full_json as any;
  const sections = fj?.sections ?? [];
  const description = fj?.tier?.description ?? "";

  const allText = [description, ...sections.map((s: any) => s?.content ?? "")].join("\n");
  for (const pat of STANDALONE_PATTERNS) {
    const matches = allText.matchAll(new RegExp(pat.source, pat.flags));
    for (const m of matches) {
      // "X등급" 같이 suffix가 "등급"으로 가는 케이스 제외
      if (m[3] === "의" && allText.slice(allText.indexOf(m[0]) + m[0].length).startsWith("등급")) continue;
      const key = `${m[2]}${m[3]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (samples.length < 8) {
        const idx = allText.indexOf(m[0]);
        samples.push(`[${r.name}] ...${allText.slice(Math.max(0, idx - 30), idx + 40)}...`);
      }
    }
  }
}

console.log(`\n## 1) 단독 등급 표현 빈도 (50건 본문 검사)\n`);
const total = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`총 발견 ${total}건 / 평균 ${(total / 50).toFixed(1)}건/풀이\n`);
for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(10)}  ${v}회`);
}
console.log("\n샘플:");
for (const s of samples) console.log(`  ${s}`);

// 2) 새 분석 저장 흐름 — lib/analysis.ts / payment-complete에서 transformGradesDeep 호출하는지
console.log("\n\n## 2) DB 저장 시 변환 적용 여부\n");

const filesToCheck = [
  "lib/analysis.ts",
  "lib/utils/saju-scoring.ts",
  "app/api/payment/complete/route.ts",
  "app/api/analyze/route.ts",
  "lib/surgical-rewrite.ts",
];

for (const f of filesToCheck) {
  try {
    const content = readFileSync(f, "utf-8");
    const usesTransform = /transformGrade|displayGrade/g.test(content);
    const insertsResults = /saju_results.*(?:insert|upsert|update)/i.test(content);
    console.log(`  ${f.padEnd(45)}  transformGrade호출=${usesTransform}  saju_results기록=${insertsResults}`);
  } catch {
    console.log(`  ${f}  (파일 없음)`);
  }
}
