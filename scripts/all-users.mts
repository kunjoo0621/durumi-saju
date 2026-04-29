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
  brand: "\x1b[38;5;203m",
};

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

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(5, 16).replace("T", " ");
};

async function main() {
  // 가입자 전부
  const { data: users } = await sb
    .from("users")
    .select("id, kakao_id, nickname, email, created_at")
    .order("created_at", { ascending: false });

  if (!users) return;

  const userIds = users.map((u) => u.id);

  // 분석 건수 + 분석 대상 이름들
  const { data: results } = await sb
    .from("saju_results")
    .select("user_id, name, full_json, created_at")
    .in("user_id", userIds);

  const resultsByUser = new Map<string, { count: number; targets: string[]; lastGrade: string | null; lastTime: string }>();
  for (const r of results ?? []) {
    if (!r.user_id) continue;
    const cur = resultsByUser.get(r.user_id) ?? { count: 0, targets: [], lastGrade: null, lastTime: "" };
    cur.count += 1;
    if (r.name) cur.targets.push(r.name);
    if (!cur.lastTime || (r.created_at ?? "") > cur.lastTime) {
      cur.lastTime = r.created_at ?? "";
      cur.lastGrade = (r.full_json as any)?.tier?.grade ?? null;
    }
    resultsByUser.set(r.user_id, cur);
  }

  // 결제
  const { data: payments } = await sb
    .from("payment_transactions")
    .select("user_id, amount")
    .eq("status", "success")
    .eq("method", "KAKAOPAY")
    .in("user_id", userIds);

  const paidByUser = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.user_id) paidByUser.set(p.user_id, (paidByUser.get(p.user_id) ?? 0) + (p.amount ?? 0));
  }

  // 잔고
  const { data: profiles } = await sb.from("profiles").select("user_id, coin_balance").in("user_id", userIds);
  const balanceByUser = new Map<string, number>();
  for (const p of profiles ?? []) balanceByUser.set(p.user_id, p.coin_balance ?? 0);

  const gradeColor: Record<string, string> = {
    S: "\x1b[38;5;203m", A: "\x1b[38;5;205m", B: "\x1b[38;5;208m", C: "\x1b[38;5;110m", D: "\x1b[38;5;130m",
  };

  // 헤더
  console.log("");
  console.log(`  ${c.bold}${c.brand}🥚 사주보는 두루미${c.reset}  ${c.dim}전체 가입자 리스트${c.reset}`);
  console.log(`  ${c.dim}${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC  /  총 ${users.length}명${c.reset}`);
  console.log("");

  const head = `  ${c.dim}#  ${padR("가입일시", 14)} ${padR("닉네임", 16)} ${padR("카카오ID", 14)} ${padL("분석", 4)} ${padL("등급", 4)} ${padL("결제", 7)} ${padL("잔고", 5)}  ${"분석대상"}${c.reset}`;
  console.log(head);
  console.log(c.gray + "  " + "─".repeat(110) + c.reset);

  // 통계
  let totalAnalyses = 0;
  let totalPaid = 0;
  let payerCount = 0;
  let multiAnalyzers = 0;

  let i = 1;
  for (const u of users) {
    const r = resultsByUser.get(u.id);
    const paid = paidByUser.get(u.id) ?? 0;
    const balance = balanceByUser.get(u.id) ?? 0;
    const nick = u.nickname ?? `(없음)`;
    const kakao = u.kakao_id?.slice(0, 12) ?? "?";

    if (r) totalAnalyses += r.count;
    if (paid > 0) { totalPaid += paid; payerCount += 1; }
    if (r && r.count >= 2) multiAnalyzers += 1;

    const cnt = r?.count ?? 0;
    const cntStr = cnt > 0 ? `${c.green}${cnt}${c.reset}` : `${c.dim}—${c.reset}`;
    const gradeStr = r?.lastGrade
      ? `${gradeColor[r.lastGrade] ?? c.dim}${c.bold}${r.lastGrade}${c.reset}`
      : `${c.dim}—${c.reset}`;
    const paidStr = paid > 0 ? `${c.bold}${c.green}${paid.toLocaleString()}${c.reset}` : `${c.dim}—${c.reset}`;
    const balStr = balance > 0 ? `${c.yellow}${balance}${c.reset}` : `${c.dim}0${c.reset}`;
    const targets = r?.targets.slice(0, 5).join(", ") ?? "";
    const targetsExtra = r && r.targets.length > 5 ? `... (+${r.targets.length - 5}건)` : "";

    const idxColor = i <= 5 ? c.bold + c.cyan : c.dim;
    console.log(
      `  ${idxColor}${String(i).padStart(2)}${c.reset}  ${padR(fmt(u.created_at), 14)} ${padR(nick.slice(0, 14), 16)} ${padR(kakao, 14)} ${padL(cntStr, 4 + (cnt > 0 ? c.green.length + c.reset.length : c.dim.length + c.reset.length))} ${padL(gradeStr, 4 + (r?.lastGrade ? (gradeColor[r.lastGrade]?.length ?? 0) + c.bold.length + c.reset.length : c.dim.length + c.reset.length))} ${padL(paidStr, 7 + (paid > 0 ? c.bold.length + c.green.length + c.reset.length : c.dim.length + c.reset.length))} ${padL(balStr, 5 + (balance > 0 ? c.yellow.length + c.reset.length : c.dim.length + c.reset.length))}  ${c.dim}${targets}${targetsExtra}${c.reset}`,
    );
    i += 1;
  }

  console.log(c.gray + "  " + "─".repeat(110) + c.reset);
  console.log("");
  console.log(`  ${c.bold}요약${c.reset}`);
  console.log(`  ${c.dim}─${c.reset}`);
  console.log(`  ${c.dim}총 가입자:${c.reset}     ${c.bold}${c.green}${users.length}${c.reset}명`);
  console.log(`  ${c.dim}총 분석:${c.reset}       ${c.bold}${totalAnalyses}${c.reset}건`);
  console.log(`  ${c.dim}2건 이상 분석:${c.reset} ${c.bold}${c.yellow}${multiAnalyzers}${c.reset}명`);
  console.log(`  ${c.dim}결제자:${c.reset}        ${c.bold}${c.green}${payerCount}${c.reset}명`);
  console.log(`  ${c.dim}총 매출:${c.reset}       ${c.bold}${c.green}${totalPaid.toLocaleString()}${c.reset}원`);
  console.log(`  ${c.dim}전환율(결제):${c.reset}  ${c.bold}${((payerCount / users.length) * 100).toFixed(1)}${c.reset}%`);
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
