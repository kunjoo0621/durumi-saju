// 커리어운 결제 멱등성의 DB 기반 검증 — 실제 Supabase(career 테이블)에서 unique 제약 +
// 원자적 삭제 semantics를 확인한다. ★코인(spend_coins/refundCoins)은 건드리지 않는다
// (실사용자 잔액 오염·유령 환불 방지). 전체 spend→refund 흐름은 배포 후 브라우저에서.
// 테스트 row는 finally에서 반드시 정리. 실행: npx tsx scripts/career-payment-db-probe.ts
import { config } from "dotenv";
config({ path: ".env.local" });
// ★supabaseAdmin은 import 시점에 env를 eager 읽는다 — 정적 import는 config()보다 먼저 평가되므로
//  반드시 동적 import(아래 main 내부)로 config() 이후에 로드한다.

const TS = 1_753_000_000_000; // 고정 스탬프(Math.random/Date 미사용) — 테스트 격리용 접두
const HASH = `__career_dbprobe_${TS}__`;
const SIT = "현직 성장";
let ok = 0, fail = 0;
const check = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  pass ? ok++ : fail++;
};

async function main() {
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");
  // 실제 user_id 하나(읽기 참조만 — 유저/코인은 절대 수정 안 함)
  const { data: u } = await supabaseAdmin.from("users").select("id").limit(1).maybeSingle();
  if (!u?.id) throw new Error("테스트용 user_id 조회 실패");
  const userId = u.id as string;
  let resultId = "";

  try {
    // teaser row 생성(full_json null — my/results엔 잠깐 잠금상태로 보였다 정리됨)
    const ins = await supabaseAdmin.from("career_results").insert({
      user_id: userId, input_hash: HASH, situation: SIT, career_grade: "A", teaser_json: { probe: true },
    }).select("id").maybeSingle();
    check("career_results teaser insert", !ins.error && !!ins.data?.id, ins.error?.message);
    resultId = ins.data!.id as string;

    // 시나리오 1: 정상 unlock insert
    const o1 = `dbprobe_${TS}_1`;
    const u1 = await supabaseAdmin.from("career_result_unlocks").insert({
      user_id: userId, result_id: resultId, input_hash: HASH, situation: SIT, order_id: o1,
    });
    check("unlock insert (정상 결제 1건)", !u1.error, u1.error?.message);

    // 시나리오 2: 같은 order_id 재삽입 → 23505 (order_id unique = 중복 결제 기록 차단)
    const dupOrder = await supabaseAdmin.from("career_result_unlocks").insert({
      user_id: userId, result_id: resultId, input_hash: HASH, situation: SIT, order_id: o1,
    });
    check("중복 order_id → 23505 차단", dupOrder.error?.code === "23505", dupOrder.error?.code ?? "에러없음(FAIL)");

    // 시나리오 3: 같은 (user,hash,situation) 다른 order_id → 23505 (동시요청 loser 게이트)
    const o2 = `dbprobe_${TS}_2`;
    const concurrent = await supabaseAdmin.from("career_result_unlocks").insert({
      user_id: userId, result_id: resultId, input_hash: HASH, situation: SIT, order_id: o2,
    });
    check("동시요청 2번째(같은 상황) → 23505 loser 게이트", concurrent.error?.code === "23505", concurrent.error?.code ?? "에러없음(FAIL)");

    // 시나리오 4: 원자적 삭제 — order_id로 삭제 시 정확히 1건(환불 책임자 결정)
    const del1 = await supabaseAdmin.from("career_result_unlocks").delete().eq("order_id", o1).select("id");
    check("order_id 삭제 = 1건(원자적 환불 승자)", !del1.error && (del1.data?.length === 1), `삭제 ${del1.data?.length}건`);

    // 시나리오 5: 이미 삭제된 order_id 재삭제 → 0건(재환불 방지 semantics)
    const del2 = await supabaseAdmin.from("career_result_unlocks").delete().eq("order_id", o1).select("id");
    check("삭제된 order_id 재삭제 = 0건(재환불 금지)", !del2.error && (del2.data?.length === 0), `삭제 ${del2.data?.length}건`);

    // 시나리오 6: 상황이 다르면 별도 리포트 허용 (situation 4분법 분리)
    const o3 = `dbprobe_${TS}_3`;
    const otherSit = await supabaseAdmin.from("career_result_unlocks").insert({
      user_id: userId, result_id: resultId, input_hash: HASH, situation: "이직 고민", order_id: o3,
    });
    check("다른 상황(이직)은 별도 unlock 허용", !otherSit.error, otherSit.error?.message);
  } finally {
    // 정리 — 테스트 흔적 전부 제거(코인은 애초에 안 건드림)
    await supabaseAdmin.from("career_result_unlocks").delete().eq("input_hash", HASH);
    await supabaseAdmin.from("career_results").delete().eq("input_hash", HASH);
    console.log("\n🧹 테스트 row 정리 완료");
  }

  console.log(`\n결과: ${ok} 통과 / ${fail} 실패`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
