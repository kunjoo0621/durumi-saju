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
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  brand: "\x1b[38;5;203m",
  // grade colors (실제 사이트 컬러 매칭)
  rankS: "\x1b[38;5;203m",
  rankA: "\x1b[38;5;205m",
  rankB: "\x1b[38;5;208m",
  rankC: "\x1b[38;5;110m",
  rankD: "\x1b[38;5;130m",
};

const HR = c.gray + "━".repeat(64) + c.reset;
function section(title: string) {
  console.log("");
  console.log(HR);
  console.log(`  ${c.bold}${c.cyan}${title}${c.reset}`);
  console.log(HR);
}

const now = Date.now();
const H24 = new Date(now - 24 * 3600_000).toISOString();
const D7 = new Date(now - 7 * 24 * 3600_000).toISOString();

function bar(value: number, max: number, width = 24, color = c.green) {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return color + "█".repeat(filled) + c.gray + "·".repeat(Math.max(0, width - filled)) + c.reset;
}

function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xff00 && code <= 0xff60)) w += 2;
    else w += 1;
  }
  return w;
}
function padR(s: string, n: number) { return s + " ".repeat(Math.max(0, n - visualWidth(s))); }
function padL(s: string, n: number) { return " ".repeat(Math.max(0, n - visualWidth(s))) + s; }

function ageGroup(birth: string | null): string {
  if (!birth) return "?";
  const y = parseInt(birth.slice(0, 4));
  if (isNaN(y)) return "?";
  const age = 2026 - y;
  if (age < 20) return "10대";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  if (age < 70) return "60대";
  return "70대+";
}

async function main() {
  console.log("");
  console.log(`  ${c.bold}${c.brand}🥚 사주보는 두루미${c.reset}  ${c.dim}디테일 대시보드${c.reset}`);
  console.log(`  ${c.dim}${new Date(now + 9 * 3600_000).toISOString().slice(0, 19).replace("T", " ")} KST${c.reset}`);

  // 7일치 분석 전부 가져오기
  const { data: results, error } = await sb
    .from("saju_results")
    .select("id, name, birth_date, gender, region, created_at, full_json, user_id, saju_text")
    .gte("created_at", D7)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return;
  }

  const rows = results ?? [];
  const total = rows.length;

  // 1. 분석 성공률
  const completed = rows.filter((r) => r.full_json && !(r.full_json as any)._error);
  const failed = rows.filter((r) => r.full_json && (r.full_json as any)._error);
  const pending = rows.filter((r) => !r.full_json);
  const sajuTextMissing = completed.filter((r) => !r.saju_text || r.saju_text.length < 100).length;

  section(`📦  분석 품질  ${c.dim}(최근 7일 ${total}건)${c.reset}`);
  console.log(`  ${padR("완료", 12)} ${c.green}${padL(String(completed.length), 4)}${c.reset}건  ${bar(completed.length, total, 24, c.green)}  ${c.dim}${total > 0 ? Math.round((completed.length / total) * 100) : 0}%${c.reset}`);
  console.log(`  ${padR("실패(에러)", 12)} ${c.red}${padL(String(failed.length), 4)}${c.reset}건  ${bar(failed.length, total, 24, c.red)}`);
  console.log(`  ${padR("진행중/대기", 12)} ${c.yellow}${padL(String(pending.length), 4)}${c.reset}건  ${bar(pending.length, total, 24, c.yellow)}`);
  if (sajuTextMissing > 0) {
    console.log(`  ${c.dim}└ saju_text 누락(품질 의심): ${sajuTextMissing}건${c.reset}`);
  }

  // 2. 등급 분포
  const grades: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  const composites: number[] = [];
  const categoryScores: Record<string, number[]> = { 건강운: [], 대인운: [], 연애운: [], 재물운: [], 직장운: [] };

  for (const r of completed) {
    const tier = (r.full_json as any)?.tier;
    if (tier?.grade && grades[tier.grade] !== undefined) grades[tier.grade]++;
    if (typeof tier?.composite === "number") composites.push(tier.composite);
    const scores = (r.full_json as any)?.scores;
    if (scores) {
      for (const [k, v] of Object.entries(scores)) {
        if (categoryScores[k] && typeof v === "number") categoryScores[k].push(v);
      }
    }
  }

  const gradeMax = Math.max(...Object.values(grades), 1);
  const gradeColors: Record<string, string> = { S: c.rankS, A: c.rankA, B: c.rankB, C: c.rankC, D: c.rankD };
  const gradeRanges: Record<string, string> = { S: "≥86", A: "80~85", B: "69~79", C: "45~68", D: "<45" };
  const totalGraded = Object.values(grades).reduce((a, b) => a + b, 0);

  section(`🏆  등급 분포  ${c.dim}(${totalGraded}건)${c.reset}`);
  for (const g of ["S", "A", "B", "C", "D"]) {
    const cnt = grades[g];
    const pct = totalGraded > 0 ? ((cnt / totalGraded) * 100).toFixed(1) : "0";
    console.log(
      `  ${gradeColors[g]}${c.bold} ${g}${c.reset}  ${c.dim}${gradeRanges[g].padEnd(7)}${c.reset}  ${gradeColors[g]}${padL(String(cnt), 3)}${c.reset}건  ${bar(cnt, gradeMax, 28, gradeColors[g])}  ${c.dim}${pct}%${c.reset}`,
    );
  }

  // 3. 점수 통계
  if (composites.length > 0) {
    composites.sort((a, b) => a - b);
    const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
    const median = composites[Math.floor(composites.length / 2)];
    const min = composites[0];
    const max = composites[composites.length - 1];
    section(`📊  종합 점수 분포  ${c.dim}(${composites.length}건)${c.reset}`);
    console.log(`  ${padR("평균", 8)} ${c.bold}${avg.toFixed(1)}${c.reset}점`);
    console.log(`  ${padR("중앙값", 8)} ${c.bold}${median}${c.reset}점`);
    console.log(`  ${padR("최저", 8)} ${c.dim}${min}${c.reset}점`);
    console.log(`  ${padR("최고", 8)} ${c.green}${max}${c.reset}점`);
  }

  // 4. 카테고리별 평균
  section(`💎  카테고리별 평균 점수`);
  for (const [cat, vals] of Object.entries(categoryScores)) {
    if (vals.length === 0) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const color = avg >= 70 ? c.green : avg >= 50 ? c.yellow : c.red;
    console.log(`  ${padR(cat, 8)} ${color}${avg.toFixed(1)}${c.reset}점  ${bar(Math.round(avg), 100, 30, color)}`);
  }

  // 5. 연령대 분포
  const ageMap = new Map<string, number>();
  for (const r of rows) {
    const g = ageGroup(r.birth_date);
    ageMap.set(g, (ageMap.get(g) ?? 0) + 1);
  }
  const ageMax = Math.max(...ageMap.values(), 1);
  const ageOrder = ["10대", "20대", "30대", "40대", "50대", "60대", "70대+", "?"];
  section(`🎂  분석 대상 연령 분포`);
  for (const a of ageOrder) {
    const cnt = ageMap.get(a) ?? 0;
    if (cnt === 0) continue;
    console.log(`  ${padR(a, 6)} ${padL(String(cnt), 3)}건  ${bar(cnt, ageMax, 26, c.cyan)}`);
  }

  // 6. 성별
  const genderMap = new Map<string, number>();
  for (const r of rows) genderMap.set(r.gender ?? "?", (genderMap.get(r.gender ?? "?") ?? 0) + 1);
  section(`⚧  성별 분포`);
  for (const [g, cnt] of [...genderMap.entries()].sort((a, b) => b[1] - a[1])) {
    const color = g === "남성" ? c.blue : g === "여성" ? c.magenta : c.dim;
    console.log(`  ${color}${padR(g, 6)}${c.reset} ${padL(String(cnt), 3)}건  ${bar(cnt, total, 26, color)}`);
  }

  // 7. 지역 분포
  const regionMap = new Map<string, number>();
  for (const r of rows) regionMap.set(r.region ?? "?", (regionMap.get(r.region ?? "?") ?? 0) + 1);
  const regionTop = [...regionMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const regionMax = regionTop[0]?.[1] ?? 1;
  section(`🗺  지역 TOP 8`);
  for (const [reg, cnt] of regionTop) {
    console.log(`  ${padR(reg, 6)} ${padL(String(cnt), 3)}건  ${bar(cnt, regionMax, 26, c.green)}`);
  }

  // 8. 시간대별 분석 유입 (24h)
  const hourMap = new Map<number, number>();
  for (const r of rows.filter((r) => r.created_at >= H24)) {
    const h = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).getUTCHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const hourMax = Math.max(...hourMap.values(), 1);
  section(`⏰  최근 24시간 시간대별 분석 유입`);
  for (let h = 0; h < 24; h++) {
    const cnt = hourMap.get(h) ?? 0;
    if (cnt === 0) {
      console.log(`  ${c.dim}${String(h).padStart(2, "0")}시  ${"·".repeat(20)}${c.reset}`);
    } else {
      console.log(`  ${String(h).padStart(2, "0")}시  ${c.green}${"█".repeat(Math.round((cnt / hourMax) * 20))}${c.reset}${c.gray}${".".repeat(Math.max(0, 20 - Math.round((cnt / hourMax) * 20)))}${c.reset}  ${cnt}건`);
    }
  }

  // 9. 이름 입력 패턴
  const namePatterns = { real: 0, initial: 0, anon: 0, emoji: 0 };
  for (const r of rows) {
    const n = (r.name ?? "").trim();
    if (!n || /^[ㅇㅎㅁㄴㅏㅡㅣㅛㅗㅜ]+$/.test(n) || n === "?" || n.length === 1) namePatterns.anon++;
    else if (/^[A-Za-z\.\s]+$/.test(n)) namePatterns.initial++;
    else if (/[💕💖✨🌟⭐]/.test(n)) namePatterns.emoji++;
    else namePatterns.real++;
  }
  section(`✍️  이름 입력 패턴`);
  console.log(`  ${padR("실명형", 8)} ${c.green}${namePatterns.real}${c.reset}건`);
  console.log(`  ${padR("이니셜", 8)} ${c.yellow}${namePatterns.initial}${c.reset}건`);
  console.log(`  ${padR("익명형", 8)} ${c.dim}${namePatterns.anon}${c.reset}건  ${c.dim}(ㅇㅇ, ㅛ 등)${c.reset}`);
  console.log(`  ${padR("이모지", 8)} ${c.magenta}${namePatterns.emoji}${c.reset}건`);

  // 10. 전체 분석 리스트 (가장 마지막)
  // 가입자 닉네임 가져오기
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const userMap = new Map<string, { nickname: string | null; kakao_id: string | null }>();
  if (userIds.length > 0) {
    const { data: users } = await sb.from("users").select("id, nickname, kakao_id").in("id", userIds);
    for (const u of users ?? []) userMap.set(u.id, { nickname: u.nickname, kakao_id: u.kakao_id });
  }

  section(`📋  전체 분석 리스트  ${c.dim}(${rows.length}건, 최신순)${c.reset}`);
  const head =
    `${padR("시각", 13)} ${padR("등급", 5)} ${padR("점수", 5)} ${padR("가입자", 14)} ${padR("분석대상", 14)} ${padR("생년월일", 12)} ${padR("성", 4)} ${padR("지역", 6)} ${padR("건강", 5)} ${padR("대인", 5)} ${padR("연애", 5)} ${padR("재물", 5)} ${padR("직장", 5)}`;
  console.log("  " + c.dim + head + c.reset);
  console.log("  " + c.dim + "─".repeat(visualWidth(head)) + c.reset);

  for (const r of rows) {
    const fj = r.full_json as any;
    const grade = fj?.tier?.grade ?? "—";
    const composite = fj?.tier?.composite;
    const sc = fj?.scores ?? {};
    const isError = fj?._error;
    const isPending = !fj;

    const gradeColor = gradeColors[grade] ?? c.dim;
    const u = r.user_id ? userMap.get(r.user_id) : null;
    const nick = u?.nickname ?? (r.user_id ? "(없음)" : "게스트");
    const member = r.user_id ? c.green + "●" : c.dim + "○";

    const ts = (() => {
      const d = new Date(new Date(r.created_at!).getTime() + 9 * 3600_000);
      return d.toISOString().slice(5, 16).replace("T", " ");
    })();

    const status = isError ? c.red + "ERR" + c.reset : isPending ? c.yellow + "..." + c.reset : `${gradeColor}${c.bold}${grade}${c.reset}`;
    const score = isError || isPending ? c.dim + "—" + c.reset : `${gradeColor}${composite}${c.reset}`;
    const gen = r.gender === "남성" ? c.blue + "남" + c.reset : r.gender === "여성" ? c.magenta + "여" + c.reset : c.dim + "?" + c.reset;

    const fmtScore = (v: any) => {
      if (typeof v !== "number") return c.dim + "—" + c.reset;
      const col = v >= 70 ? c.green : v >= 50 ? c.yellow : c.red;
      return col + String(v).padStart(2) + c.reset;
    };

    console.log(
      `  ${padR(ts, 13)} ${padR(status, 5 + (isError ? c.red.length + c.reset.length : isPending ? c.yellow.length + c.reset.length : gradeColor.length + c.bold.length + c.reset.length))} ${padR(score, 5 + (gradeColor.length + c.reset.length))} ${member} ${padR(nick.slice(0, 12), 13)} ${padR((r.name ?? "—").slice(0, 12), 14)} ${padR(r.birth_date ?? "—", 12)} ${padR(gen, 4 + (r.gender ? c.blue.length + c.reset.length : c.dim.length + c.reset.length))} ${padR((r.region ?? "—").slice(0, 6), 6)} ${padR(fmtScore(sc.건강운), 5 + 9)} ${padR(fmtScore(sc.대인운), 5 + 9)} ${padR(fmtScore(sc.연애운), 5 + 9)} ${padR(fmtScore(sc.재물운), 5 + 9)} ${padR(fmtScore(sc.직장운), 5 + 9)}`,
    );
  }

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
