import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const DEPLOY_TIME = "2026-04-25T07:00:00Z"; // 배포 시각 16:00 KST = 07:00 UTC

// 패턴 정의
const PATTERNS = {
  threats: [
    /안\s*[\w]*하면/g,           // "안 ~하면"
    /안\s+그러면/g,              // "안 그러면"
    /이렇게\s+가다간/g,           // "이렇게 가다간"
    /지금처럼.*면/g,              // "지금처럼 ~면"
    /이대로\s+가면/g,             // "이대로 가면"
  ],
  consequences: [
    /\w*[게을] 거야/g,            // "~게 될 거야", "~을 거야"
    /터질\s*[것뿐거야]/g,         // "터질 것"
    /후회할\s+거야/g,             // "후회할 거야"
  ],
  similes: [
    /마치\s+\w+\s+같아/g,         // "마치 ~ 같아"
    /\w+처럼/g,                   // "~처럼"
  ],
  metaphors: {
    배터리: /배터리/g,
    수도꼭지: /수도꼭지/g,
    양동이: /양동이/g,
    수조: /수조/g,
    댐: /댐/g,
    안개: /안개/g,
    배수구: /배수구/g,
    엔진: /엔진/g,
    브레이크: /브레이크/g,
    구멍: /구멍/g,
  },
  bridges: [
    /이 말이 나오는 이유는/g,
    /왜냐하면/g,
    /근거는/g,
  ],
  repeated_anchors: [
    /자기 자신/g,                  // "자기 자신" 반복
    /솔직히/g,
    /결국/g,
  ],
};

function countPatterns(text: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, p) => sum + (text.match(p)?.length ?? 0), 0);
}

async function main() {
  const { data: results } = await sb
    .from("saju_results")
    .select("id, name, full_json, created_at")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
    .not("full_json", "is", null)
    .order("created_at", { ascending: false });

  if (!results) return;

  // full_json.sections + tier.description + coreFearAxisBlock 모두 합쳐서 분석 텍스트로 사용
  const extractText = (r: any): string => {
    const fj = r.full_json;
    if (!fj || fj._error) return "";
    const parts: string[] = [];
    if (fj.tier?.description) parts.push(fj.tier.description);
    if (fj.coreFearAxisBlock) parts.push(fj.coreFearAxisBlock);
    if (Array.isArray(fj.sections)) {
      for (const s of fj.sections) {
        if (s.title) parts.push(s.title);
        if (s.content) parts.push(s.content);
      }
    }
    return parts.join("\n\n");
  };

  const valid = results
    .map((r) => ({ ...r, _text: extractText(r) }))
    .filter((r) => r._text.length > 500);

  const before = valid.filter((r) => r.created_at < DEPLOY_TIME);
  const after = valid.filter((r) => r.created_at >= DEPLOY_TIME);

  console.log(`\n${c.bold}${c.cyan}=== 모델 교체 전후 텍스트 패턴 비교 ===${c.reset}`);
  console.log(`${c.dim}배포 시각: ${DEPLOY_TIME} (UTC) = 16:00 KST${c.reset}\n`);
  console.log(`${c.dim}배포 전 (Gemini 2.5 Flash): ${before.length}건${c.reset}`);
  console.log(`${c.dim}배포 후 (Gemini 3 Flash):   ${after.length}건${c.reset}`);

  if (before.length === 0 || after.length === 0) {
    console.log(`\n${c.red}한쪽 그룹이 비어있어 비교 불가${c.reset}`);
    return;
  }

  function aggregate(group: typeof valid, label: string) {
    const totalChars = group.reduce((s, r) => s + (r._text?.length ?? 0), 0);
    const avgChars = Math.round(totalChars / group.length);

    const sums: Record<string, number> = {};
    for (const [name, ps] of Object.entries(PATTERNS)) {
      if (Array.isArray(ps)) {
        sums[name] = group.reduce((s, r) => s + countPatterns(r._text ?? "", ps), 0);
      }
    }

    // 메타포는 별도
    const meta: Record<string, number> = {};
    for (const [name, p] of Object.entries(PATTERNS.metaphors)) {
      meta[name] = group.reduce((s, r) => s + ((r._text ?? "").match(p)?.length ?? 0), 0);
    }

    return { totalChars, avgChars, sums, meta, n: group.length };
  }

  const A = aggregate(before, "배포 전");
  const B = aggregate(after, "배포 후");

  // 출력
  console.log(`\n${c.bold}📏 평균 분석 길이${c.reset}`);
  console.log(`  배포 전:  ${c.dim}${A.avgChars.toLocaleString()}자 / 분석${c.reset}`);
  console.log(`  배포 후:  ${c.dim}${B.avgChars.toLocaleString()}자 / 분석${c.reset}`);

  function row(label: string, before: number, after: number, beforeN: number, afterN: number) {
    const beforePerAnalysis = before / beforeN;
    const afterPerAnalysis = after / afterN;
    const delta = afterPerAnalysis - beforePerAnalysis;
    const arrow = delta > 0.5 ? c.red + "↑" + c.reset : delta < -0.5 ? c.green + "↓" + c.reset : c.dim + "→" + c.reset;
    console.log(
      `  ${label.padEnd(18)} ${c.dim}분석당:${c.reset} 전 ${beforePerAnalysis.toFixed(1)} → 후 ${afterPerAnalysis.toFixed(1)}  ${arrow} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
    );
  }

  console.log(`\n${c.bold}🚨 위협조 어미 빈도${c.reset} ${c.dim}(낮을수록 좋음)${c.reset}`);
  row("안~하면 류", A.sums.threats, B.sums.threats, A.n, B.n);
  row("결과/후회 류", A.sums.consequences, B.sums.consequences, A.n, B.n);

  console.log(`\n${c.bold}🎭 직유·반복 표현${c.reset}`);
  row("마치 ~ 같아", A.sums.similes, B.sums.similes, A.n, B.n);
  row("자기자신/솔직히/결국", A.sums.repeated_anchors, B.sums.repeated_anchors, A.n, B.n);
  row("브릿지 정형구", A.sums.bridges, B.sums.bridges, A.n, B.n);

  console.log(`\n${c.bold}🔧 핵심 메타포 단어 사용${c.reset}`);
  for (const key of Object.keys(PATTERNS.metaphors)) {
    const aPer = A.meta[key] / A.n;
    const bPer = B.meta[key] / B.n;
    const delta = bPer - aPer;
    const arrow = Math.abs(delta) < 0.1 ? c.dim + "→" : delta > 0 ? c.red + "↑" : c.green + "↓";
    console.log(`  ${key.padEnd(8)}  전 ${aPer.toFixed(2)}/건  후 ${bPer.toFixed(2)}/건  ${arrow}${c.reset}`);
  }

  // 샘플 비교
  console.log(`\n${c.bold}${c.cyan}=== 샘플 텍스트 비교 (각 1건) ===${c.reset}`);
  if (before.length > 0) {
    const r = before[0];
    console.log(`\n${c.yellow}[배포 전]${c.reset} ${r.name} ${r.created_at?.slice(5, 16)}`);
    console.log(c.dim + (r._text ?? "").slice(0, 400) + "..." + c.reset);
  }
  if (after.length > 0) {
    const r = after[0];
    console.log(`\n${c.green}[배포 후]${c.reset} ${r.name} ${r.created_at?.slice(5, 16)}`);
    console.log(c.dim + (r._text ?? "").slice(0, 400) + "..." + c.reset);
  }
}
main();
