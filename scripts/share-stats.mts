/**
 * 공유 보상 집계 — 카카오톡 공유가 실제로 몇 건 일어났는지 본다.
 *
 *   npx tsx scripts/share-stats.mts          # 최근 7일
 *   npx tsx scripts/share-stats.mts 30       # 최근 30일
 *
 * 데이터 출처:
 *   share_kakao_webhook_log — 카카오가 "전송 성공" 시점에만 보내주는 웹훅 수신 기록
 *   share_kakao_nonces      — 누가(user_id) 어느 결과지로 공유를 시작했는지
 *   share_reward_grants     — 실제 지급 원장(종류당 1회)
 *
 * ⚠️ 이 숫자는 "로그인 유저의 카카오톡 공유"만이다. 하한선으로 읽을 것:
 *   - 비로그인 공유는 nonce가 없어 웹훅 자체가 오지 않는다 → 통계에서 빠진다
 *   - 받은 사람이 열었는지는 카카오가 알려주지 않는다
 *   - 카톡 외 경로(링크 복사 등)는 애초에 잡히지 않는다
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

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
};

const DAYS = Number(process.argv[2] ?? 7);
const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

const KIND_LABEL: Record<string, string> = {
  result: "사주",
  battle: "배틀",
  yearly: "신년",
  pet: "펫",
  wealth: "재물",
  marriage: "결혼",
  career: "커리어",
};

const CHAT_LABEL: Record<string, string> = {
  DirectChat: "1:1",
  MultiChat: "단체방",
  OpenDirectChat: "오픈1:1",
  OpenMultiChat: "오픈단체",
  MemoChat: "나와의채팅",
};

// Supabase select는 기본 1000행에서 잘린다. 집계가 어긋나면 원인 찾기 어려우니
// 페이지네이션으로 전량을 가져온다.
async function fetchAll<T>(
  table: string,
  columns: string,
  build: (q: any) => any
): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(
      sb.from(table).select(columns).range(from, from + PAGE - 1)
    );
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function kstDate(iso: string): string {
  // KST 기준 날짜로 묶는다 (운영자가 보는 날짜와 맞춰야 해석이 된다)
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(5, 10).replace("-", "-");
}

type Hook = {
  received_at: string;
  nonce: string | null;
  chat_type: string | null;
  result_kind: string | null;
  verdict: string;
  latency_ms: number | null;
};
type Nonce = { nonce: string; user_id: string; result_kind: string; created_at: string };

async function main() {
  const hooks = await fetchAll<Hook>(
    "share_kakao_webhook_log",
    "received_at, nonce, chat_type, result_kind, verdict, latency_ms",
    (q) => q.gte("received_at", since).order("received_at", { ascending: false })
  );

  const nonces = await fetchAll<Nonce>(
    "share_kakao_nonces",
    "nonce, user_id, result_kind, created_at",
    (q) => q.gte("created_at", since)
  );
  const userByNonce = new Map(nonces.map((n) => [n.nonce, n.user_id]));

  console.log(
    `\n${c.bold}공유 보상 집계${c.reset} ${c.gray}— 최근 ${DAYS}일 (KST)${c.reset}\n`
  );

  if (hooks.length === 0) {
    console.log(`${c.gray}아직 카카오 웹훅 수신 기록이 없습니다.${c.reset}`);
    console.log(
      `${c.gray}공유 시도(nonce 발급)는 ${nonces.length}건 있었습니다. 전송까지 이어지지 않았다는 뜻입니다.${c.reset}\n`
    );
    return;
  }

  // 실제 전송으로 인정되는 건 (거부·인증실패 제외)
  const sent = hooks.filter(
    (h) => h.verdict === "granted" || h.verdict === "already_granted"
  );
  const rejected = hooks.filter((h) => h.verdict.startsWith("rejected_"));
  const problems = hooks.filter(
    (h) => !["granted", "already_granted", "already_consumed"].includes(h.verdict) && !h.verdict.startsWith("rejected_")
  );

  // ── 일자별 ──────────────────────────────────
  const byDay = new Map<
    string,
    { total: number; granted: number; repeat: number; chats: Map<string, number> }
  >();
  for (const h of sent) {
    const d = kstDate(h.received_at);
    if (!byDay.has(d))
      byDay.set(d, { total: 0, granted: 0, repeat: 0, chats: new Map() });
    const row = byDay.get(d)!;
    row.total++;
    if (h.verdict === "granted") row.granted++;
    else row.repeat++;
    const ct = h.chat_type ?? "?";
    row.chats.set(ct, (row.chats.get(ct) ?? 0) + 1);
  }

  console.log(
    `${c.bold}날짜     공유  지급  재공유   1:1  단체  오픈  나와의채팅${c.reset}`
  );
  for (const [day, r] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    const g = (k: string) => String(r.chats.get(k) ?? 0).padStart(4);
    const open = (r.chats.get("OpenDirectChat") ?? 0) + (r.chats.get("OpenMultiChat") ?? 0);
    console.log(
      `${day}   ${String(r.total).padStart(4)}  ${c.green}${String(r.granted).padStart(4)}${c.reset}  ${c.cyan}${String(r.repeat).padStart(5)}${c.reset}  ${g("DirectChat")}  ${g("MultiChat")}  ${String(open).padStart(4)}  ${g("MemoChat").padStart(9)}`
    );
  }

  // ── 결과지별 ────────────────────────────────
  const byKind = new Map<string, number>();
  for (const h of sent) {
    const k = h.result_kind ?? "?";
    byKind.set(k, (byKind.get(k) ?? 0) + 1);
  }
  const kindStr = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${KIND_LABEL[k] ?? k} ${v}`)
    .join(" · ");
  console.log(`\n${c.bold}결과지별${c.reset}  ${kindStr || "-"}`);

  // ── 사람 ────────────────────────────────────
  const byUser = new Map<string, number>();
  let unknownUser = 0;
  for (const h of sent) {
    const u = h.nonce ? userByNonce.get(h.nonce) : undefined;
    if (!u) {
      unknownUser++;
      continue;
    }
    byUser.set(u, (byUser.get(u) ?? 0) + 1);
  }
  const repeaters = [...byUser.values()].filter((v) => v >= 2).length;
  console.log(
    `${c.bold}공유한 사람${c.reset}  ${byUser.size}명${repeaters ? ` (2회 이상 ${c.cyan}${repeaters}명${c.reset})` : ""}` +
      (unknownUser ? ` ${c.gray}· nonce 만료로 사용자 미상 ${unknownUser}건${c.reset}` : "")
  );

  // 많이 공유한 사람 상위 5
  const top = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, v]) => v >= 2);
  if (top.length) {
    console.log(`${c.gray}  많이 공유한 사람: ${top.map(([u, v]) => `${u.slice(0, 8)}… ${v}회`).join(" · ")}${c.reset}`);
  }

  // ── 거부·이상 ───────────────────────────────
  if (rejected.length) {
    const byReason = new Map<string, number>();
    for (const h of rejected) byReason.set(h.verdict, (byReason.get(h.verdict) ?? 0) + 1);
    console.log(
      `${c.bold}거부${c.reset}  ${[...byReason.entries()].map(([k, v]) => `${k.replace("rejected_", "")} ${v}`).join(" · ")} ${c.gray}(지급 안 됨, nonce는 살아있어 재전송 시 지급)${c.reset}`
    );
  }
  if (problems.length) {
    const byV = new Map<string, number>();
    for (const h of problems) byV.set(h.verdict, (byV.get(h.verdict) ?? 0) + 1);
    console.log(
      `${c.red}${c.bold}이상${c.reset}  ${[...byV.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")} ${c.gray}← 확인 필요${c.reset}`
    );
  }

  // ── 응답 속도 (카카오 3초 제한) ──────────────
  const lat = hooks.map((h) => h.latency_ms).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  if (lat.length) {
    const p95 = lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))];
    const warn = p95 > 1500 ? `${c.red} ← 3초 제한 대비 위험${c.reset}` : "";
    console.log(
      `${c.bold}웹훅 응답${c.reset}  중앙값 ${lat[Math.floor(lat.length / 2)]}ms · p95 ${p95}ms${warn}`
    );
  }

  // ── 전환: 공유 시도 → 실제 전송 ──────────────
  if (nonces.length) {
    const rate = ((sent.length / nonces.length) * 100).toFixed(0);
    console.log(
      `\n${c.bold}버튼 누름 → 실제 전송${c.reset}  ${sent.length}/${nonces.length} (${rate}%)`
    );
    console.log(
      `${c.gray}  나머지는 공유창에서 취소했거나, 전송 전에 이탈한 경우입니다.${c.reset}`
    );
  }

  console.log(
    `\n${c.gray}※ 로그인 유저의 카톡 공유만 집계됩니다. 비로그인 공유·수신자 열람은 알 수 없습니다.${c.reset}\n`
  );
}

main().catch((e) => {
  console.error(`${c.red}실패:${c.reset}`, e?.message ?? e);
  process.exit(1);
});
