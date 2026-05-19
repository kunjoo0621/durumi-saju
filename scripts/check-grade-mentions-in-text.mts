/**
 * 풀이 본문(saju_text, full_json.sections)에 "S등급", "C등급" 같은 등급명 박혀 있는지 검사
 * - 박혀 있으면 UI 라벨만 변환 부족 → 풀이 텍스트도 변환 또는 재생성 필요
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

const { data: results } = await sb
  .from("saju_results")
  .select("id, name, saju_text, full_json")
  .gte("created_at", "2026-04-01T00:00:00Z")
  .not("full_json", "is", null);

const all = results ?? [];
console.log(`전체 검사 대상: ${all.length}건\n`);

// 검사할 등급 키워드 패턴
const patterns = [
  /S등급/g, /A등급/g, /B등급/g, /C등급/g, /D등급/g,
  /등급\s*S\b/g, /등급\s*A\b/g, /등급\s*B\b/g, /등급\s*C\b/g, /등급\s*D\b/g,
  /\bS급\b/g, /\bA급\b/g, /\bB급\b/g, /\bC급\b/g, /\bD급\b/g,
];

const counts = new Map<string, number>();
let textWithMentions = 0;
let fjWithMentions = 0;
const samples: Array<{ name: string; grade: string; snippets: string[] }> = [];

for (const r of all) {
  const txt = r.saju_text ?? "";
  const fjStr = JSON.stringify(r.full_json ?? {});

  let textHit = false;
  let fjHit = false;
  const localSnippets: string[] = [];

  for (const pat of patterns) {
    // saju_text
    const m1 = txt.match(pat);
    if (m1) {
      textHit = true;
      counts.set(`txt:${pat.source}`, (counts.get(`txt:${pat.source}`) ?? 0) + m1.length);
      const idx = txt.search(pat);
      if (idx >= 0 && localSnippets.length < 2) {
        localSnippets.push(`saju_text: ...${txt.slice(Math.max(0, idx - 20), idx + 30)}...`);
      }
    }
    // full_json
    const m2 = fjStr.match(pat);
    if (m2) {
      fjHit = true;
      counts.set(`fj:${pat.source}`, (counts.get(`fj:${pat.source}`) ?? 0) + m2.length);
      const idx = fjStr.search(pat);
      if (idx >= 0 && localSnippets.length < 2) {
        localSnippets.push(`full_json: ...${fjStr.slice(Math.max(0, idx - 20), idx + 30)}...`);
      }
    }
  }

  if (textHit) textWithMentions++;
  if (fjHit) fjWithMentions++;
  if ((textHit || fjHit) && samples.length < 5) {
    samples.push({
      name: r.name ?? "?",
      grade: r.full_json?.tier?.grade ?? "?",
      snippets: localSnippets,
    });
  }
}

console.log(`## 등급 표기 발견 (등급명이 풀이 안에 박혀 있는 사례)\n`);
console.log(`saju_text에 등급명 박힌 케이스:  ${textWithMentions} / ${all.length} (${(textWithMentions / all.length * 100).toFixed(1)}%)`);
console.log(`full_json에 등급명 박힌 케이스: ${fjWithMentions} / ${all.length} (${(fjWithMentions / all.length * 100).toFixed(1)}%)\n`);

console.log("패턴별 누적 빈도:");
for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(25)} ${v}회`);
}

console.log("\n샘플 (최대 5건):");
for (const s of samples) {
  console.log(`\n  [${s.name} / ${s.grade}등급]`);
  for (const snip of s.snippets) console.log(`    ${snip}`);
}

// tier.title / tier.description에 등급 단어 박혔는지 별도 검사
console.log("\n## tier.title / tier.description 내부 등급명 박힌 사례\n");
let tierTitleHits = 0;
let tierDescHits = 0;
for (const r of all) {
  const title = r.full_json?.tier?.title ?? "";
  const desc = r.full_json?.tier?.description ?? "";
  for (const pat of patterns) {
    if (title.match(pat)) tierTitleHits++;
    if (desc.match(pat)) tierDescHits++;
  }
}
console.log(`tier.title: ${tierTitleHits}건`);
console.log(`tier.description: ${tierDescHits}건`);
