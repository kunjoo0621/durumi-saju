// 유료 리포트의 "서사 수(move)" 재사용률 실측 — 의미 반복 측정기.
//
// ★왜 필요한가: wm-repeat-phrases.mts(12자 문자열 겹침)는 패러프레이즈 반복을 못 잡는다.
//   2026-08-06 감사에서 문자열 반복은 3상품 모두 0%였는데, 육안으로는 재물운 9건이
//   [좋은 해] → [조심할 해] → [씨앗·수확 비유] → ["조급해하지 마"] 로 사실상 같은 대본이었다.
//   문장은 다 다른데 골격이 같으면 "내 얘기" 느낌이 죽는다 — 그게 "두루뭉술하다"의 정체다.
//   이 스크립트는 문장이 아니라 '수'의 출현율을 세서 그 골격 반복을 숫자로 만든다.
//
// ★정규식 주의: 이건 프록시지 판정기가 아니다. 넓게 잡으면 진단 문장·관용구까지 세어
//   반복률이 부풀고, 좁게 잡으면 변주를 놓친다. 수치가 튀면 정규식부터 의심하고
//   반드시 원문을 눈으로 확인하라. 오프너(^앵커)만 오탐이 구조적으로 적다.
//
// 읽는 법: 한 수가 여러 리포트에 30%+ 나오면 그건 개인화가 아니라 대본이다.
//   프롬프트에서 그 수를 지시하고 있는지부터 확인할 것(4차 사이클 교훈 —
//   "금지가 부족한가"보다 "무엇을 시키고 있나"를 먼저 봐라).
//
// 실행: npx tsx scripts/wm-narrative-moves.mts [YYYY-MM-DD]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true } as any);

const MOVES: Array<[string, RegExp]> = [
  ["오프너 '~보면'",          /^(네 사주를 보면|타이밍을 보면|앞으로의 흐름을 보면|흐름을 보면)/],
  ["'조급해하지 마' 안심",     /조급(해하지 ?마|할 필요|해할 필요|하게 (굴지|정하지) ?마)/],
  ["씨앗·수확 비유",           /(씨앗|씨를 뿌|수확(의|기|을)|열매를 맺)/],
  ["'놓치더라도 또 온다'",     /(놓치더라도|놓친다면|이 시기를 지나친)/],
  ["'체력·기초를 기르는 때'",  /(체력을 기르|기초 체력|내공|갈고닦|실력을 다지)/],
  ["'지갑 단속·내실'",         /(지갑(을)? ?(단속|꽉|문을)|내실을 (다지|기하)|수성에)/],
  ["'큰 파도·물결' 비유",      /(큰 파도|물결|파도를 타)/],
  ["'가만히 있어도' 수동",     /가만히 (있어도|앉아)/],
];

const SPECS = [
  ["재물운", "wealth_results", "timingFlow"],
  ["결혼운", "marriage_results", "timingFlow"],
  ["커리어운", "career_results", "timingFlow"],
] as const;

async function main() {
  const since = process.argv[2] ?? "2026-07-28";
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");
  for (const [svc, table, key] of SPECS) {
    const { data, error } = await supabaseAdmin
      .from(table).select("full_json").gte("created_at", since).not("full_json", "is", null);
    if (error) { console.log(`${svc}: 조회 실패 ${error.message}`); continue; }
    const docs = ((data ?? []) as any[]).map((r) => String(r.full_json?.[key] ?? "")).filter(Boolean);
    if (docs.length < 3) { console.log(`\n${svc}: 표본 ${docs.length}건(부족)`); continue; }

    console.log(`\n===== ${svc} ${key} (${docs.length}건, ${since} 이후) =====`);
    const rows = MOVES.map(([label, re]) => [label, docs.filter((d) => re.test(d)).length] as const)
      .sort((a, b) => b[1] - a[1]);
    for (const [label, n] of rows) {
      const p = (n / docs.length) * 100;
      const flag = p >= 30 ? " ← 대본 의심" : "";
      console.log(`  ${label.padEnd(24)} ${String(n).padStart(3)}/${docs.length}  ${p.toFixed(0).padStart(3)}%  ${"█".repeat(Math.round(p / 5))}${flag}`);
    }
    const per = docs.map((d) => MOVES.filter(([, re]) => re.test(d)).length);
    console.log(`  → 리포트당 평균 ${(per.reduce((a, b) => a + b, 0) / per.length).toFixed(1)}개 / ${MOVES.length}개 중`);
    if (docs.length < 15) console.log(`  ※ n=${docs.length}은 작다. 한두 건 차이로 비율이 크게 흔들리니 추세로만 볼 것.`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
