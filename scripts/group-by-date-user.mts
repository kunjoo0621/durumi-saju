import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// 최근 9일 분석 데이터
const since = new Date();
since.setDate(since.getDate() - 9);

const { data: results, error } = await sb
  .from("saju_results")
  .select("created_at, user_id, name, full_json")
  .gte("created_at", since.toISOString())
  .order("created_at", { ascending: false });

if (error || !results) {
  console.error("쿼리 실패:", error);
  process.exit(1);
}

// users 정보 가져오기
const userIds = [...new Set(results.map(r => r.user_id).filter(Boolean))];
const { data: users } = await sb
  .from("users")
  .select("id, nickname, kakao_id")
  .in("id", userIds);

const userMap = new Map((users ?? []).map(u => [u.id, u]));

// KST 변환
const toKST = (iso: string) => {
  const d = new Date(iso);
  d.setHours(d.getHours() + 9);
  return d.toISOString().slice(0, 10);
};

// 일자별 → 가입자별 그룹핑
type Entry = {
  time: string;
  target: string;
  score: number | null;
  grade: string | null;
};
type UserGroup = {
  nickname: string;
  kakaoId: string;
  entries: Entry[];
};
const byDate = new Map<string, Map<string, UserGroup>>();

for (const r of results) {
  const date = toKST(r.created_at);
  const u = r.user_id ? userMap.get(r.user_id) : null;
  const nickname = u?.nickname ?? "(게스트/탈퇴)";
  const kakaoId = u?.kakao_id ?? "—";
  const userKey = r.user_id ?? `guest-${r.created_at}`;

  if (!byDate.has(date)) byDate.set(date, new Map());
  const dateMap = byDate.get(date)!;
  if (!dateMap.has(userKey)) {
    dateMap.set(userKey, { nickname, kakaoId, entries: [] });
  }
  const fj = r.full_json as any;
  const grade = fj?.tier?.grade ?? null;
  const score = fj?.composite_score ?? fj?.composite ?? null;
  dateMap.get(userKey)!.entries.push({
    time: new Date(r.created_at).toLocaleTimeString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" }).slice(0, 5),
    target: r.name ?? "—",
    score,
    grade,
  });
}

// 출력
const dates = [...byDate.keys()].sort().reverse();

console.log("\n📅 일자 × 가입자 그룹핑 (최근 9일 분석)\n");
console.log("─".repeat(80));

for (const date of dates) {
  const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][new Date(date).getDay()];
  const dateMap = byDate.get(date)!;
  const totalCount = [...dateMap.values()].reduce((s, g) => s + g.entries.length, 0);
  const userCount = dateMap.size;

  console.log(`\n■ ${date} (${dayOfWeek})  —  ${userCount}명 / 분석 ${totalCount}건`);
  console.log("─".repeat(80));

  // 가입자별 정렬: 분석 건수 많은 순 → 가나다순
  const sortedUsers = [...dateMap.entries()].sort(([, a], [, b]) => {
    if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
    return a.nickname.localeCompare(b.nickname);
  });

  for (const [, group] of sortedUsers) {
    const count = group.entries.length;
    const countLabel = count > 1 ? `\x1b[33m[${count}건]\x1b[0m` : `[1건]`;
    console.log(`  ${countLabel} ${group.nickname.padEnd(15)}  kakao=${group.kakaoId}`);
    for (const e of group.entries) {
      const grade = e.grade ?? "—";
      const score = e.score ?? "—";
      console.log(`    ${e.time}  → ${e.target.padEnd(20)}  ${grade}/${score}점`);
    }
  }
}

console.log("\n" + "─".repeat(80));
console.log(`\n총 ${dates.length}일 / 분석 ${results.length}건\n`);
