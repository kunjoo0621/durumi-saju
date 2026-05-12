/**
 * 협박 어미 패턴 — 실데이터 다수 결과에서 빈도 측정
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// 패턴 분류: 협박/위협 vs 냉철 진단
const PATTERNS = {
  threat_negative_future: [
    /안\s+(?:[가-힣]+\s+){0,3}(?:면|으면)\s+[^.!?\n]{1,40}\s*거다(?:\.|$)/g,
    /안\s+(?:[가-힣]+\s+){0,3}(?:면|으면)\s+[^.!?\n]{1,40}될\s+거다(?:\.|$)/g,
    /안\s+(?:[가-힣]+\s+){0,3}(?:면|으면)\s+[^.!?\n]{1,40}될\s+거야(?:\.|$)/g,
    /거야\s*$/gm,  // 부정 미래 어미 (광범위)
  ],
  threat_doom: [
    /괴물/g,
    /복을\s+걷어차/g,
    /발목을\s+(?:세게\s+)?잡/g,
    /후회할\s+때(?:는|에는)\s+이미/g,
    /돌이킬\s+수\s+없/g,
    /평생\s+(?:[가-힣]+\s+){0,2}못/g,
  ],
  threat_command: [
    /해라(?:\.|$)/gm,
    /절대\s+(?:[가-힣]+\s+){0,3}마/g,
  ],
  diagnosis_neutral: [
    /구조(?:이?다|야|지)(?:\.|$)/gm,
    /경향(?:이|을)\s+가/g,
    /패턴(?:이|을)/g,
  ],
};

const { data: rows } = await sb
  .from("saju_results")
  .select("name, full_json, created_at")
  .not("full_json", "is", null)
  .order("created_at", { ascending: false })
  .limit(20);

console.log(`샘플 ${(rows ?? []).length}건\n`);

const totalCounts: Record<string, number> = {};
let totalSentences = 0;
let totalLength = 0;

for (const r of rows ?? []) {
  const sections = (r as any).full_json?.sections ?? [];
  let allText = "";
  for (const s of sections) {
    allText += " " + (s.body ?? s.content ?? s.text ?? "");
  }
  const sentences = allText.split(/[.!?]\s+/).filter((s) => s.length > 5);
  totalSentences += sentences.length;
  totalLength += allText.length;

  for (const [cat, regs] of Object.entries(PATTERNS)) {
    for (const r of regs) {
      const matches = allText.match(r);
      if (matches) totalCounts[cat] = (totalCounts[cat] ?? 0) + matches.length;
    }
  }
}

console.log(`평균 분석 길이: ${Math.round(totalLength / (rows ?? []).length)}자`);
console.log(`평균 문장 수:    ${Math.round(totalSentences / (rows ?? []).length)}\n`);

console.log("━━━ 어미 패턴 빈도 (전체 합) ━━━");
for (const cat of Object.keys(PATTERNS)) {
  const c = totalCounts[cat] ?? 0;
  const perResult = (c / (rows ?? []).length).toFixed(1);
  console.log(`${cat.padEnd(28)}: ${c.toString().padStart(4)}회 (1건당 ${perResult}회)`);
}

// 샘플 매칭 보기
console.log("\n━━━ 협박 어미 매칭 사례 (3건) ━━━");
let count = 0;
for (const r of rows ?? []) {
  if (count >= 3) break;
  const sections = (r as any).full_json?.sections ?? [];
  let allText = "";
  for (const s of sections) allText += " " + (s.body ?? s.content ?? s.text ?? "");
  const matches = [
    ...(allText.match(/안\s+(?:[가-힣]+\s+){0,3}(?:면|으면)\s+[^.!?\n]{1,40}거다(?:\.|$)/g) ?? []),
    ...(allText.match(/괴물|복을\s+걷어차|발목을\s+(?:세게\s+)?잡/g) ?? []),
  ];
  if (matches.length > 0) {
    console.log(`\n[${(r as any).name}]`);
    matches.slice(0, 5).forEach((m) => console.log(`  • ${m}`));
    count++;
  }
}
