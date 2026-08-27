/**
 * 조후용신 == 기신 충돌 감사 (2026-08-27)
 *
 * Phase 1 변경(프롬프트 노트 부착)의 전수 검증용.
 *   ① 충돌 인원이 실측치(282명)와 일치하는가
 *   ② 충돌자 전원에게 노트가 붙는가 (부착률 100%)
 *   ③ 비충돌자에게는 안 붙는가 (오염 0)
 *   ④ n=0/1/2+ 분기별 분포 (문구 튜닝 재료)
 *
 * ★TZ=UTC 필수 (절기 경계). ★Supabase 1000행 잘림 → 페이지네이션 필수.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const { calculateSaju, enrichSajuData } = await import("../lib/utils/saju");
const { formatEnrichedSajuText } = await import("../lib/utils/saju-enrichment");

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const rows: any[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("saju_results").select("id, birth_date, birth_time").range(from, from + 999);
  if (error) throw new Error(error.message);
  if (!data?.length) break;
  rows.push(...data);
  if (data.length < 1000) break;
}

let n = 0, johuDeclared = 0, collision = 0, noteAttached = 0, falsePositive = 0;
const byBucket: Record<string, number> = { "0": 0, "1": 0, "2+": 0 };
for (const r of rows) {
  if (!r.birth_date) continue;
  const d = new Date(r.birth_date);
  const [hh, mm] = String(r.birth_time ?? "12:00").split(":").map(Number);
  let e: any;
  try {
    const s: any = await calculateSaju(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
      Number.isFinite(hh) ? hh : 12, Number.isFinite(mm) ? mm : 0);
    if (!s) continue;
    e = enrichSajuData(s, { isTimeUnknown: !r.birth_time });
  } catch { continue; }
  const y = e?.yongshin; if (!y) continue;
  n++;
  const text = formatEnrichedSajuText(e);
  const line = text.split("\n").find((l: string) => l.startsWith("기신:")) ?? "";
  const hasNote = line.includes("★조후 충돌");
  if (!y.johu) { if (hasNote) falsePositive++; continue; }
  johuDeclared++;
  if (y.johu === y.gisin) {
    collision++;
    if (hasNote) noteAttached++;
    const c = e.elementDist?.[y.johu] ?? 0;
    byBucket[c === 0 ? "0" : c === 1 ? "1" : "2+"]++;
  } else if (hasNote) falsePositive++;
}
console.log(`대상 ${n}명 · 조후 선언 ${johuDeclared}명`);
console.log(`  충돌(조후==기신): ${collision}명`);
console.log(`  └ 노트 부착: ${noteAttached}명  ${collision === noteAttached ? "✓ 100%" : "★누락 " + (collision - noteAttached)}`);
console.log(`  비충돌 오염(노트 잘못 붙음): ${falsePositive}명 ${falsePositive === 0 ? "✓" : "★"}`);
console.log(`  분기 분포 — n=0: ${byBucket["0"]} · n=1: ${byBucket["1"]} · n>=2: ${byBucket["2+"]}`);
