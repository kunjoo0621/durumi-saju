// 유료 리포트의 "차감 1회 = 리포트 1건 = 환불 최대 1회" 불변식.
//
// ★왜 뽑는가: 이 로직이 app/api/{marriage,wealth,career}/analyze/route.ts 에 **세 벌**
//   복사돼 있다(refundMarriageUnlock:66 / refundWealthUnlock:66 / refundCareerUnlock:54,
//   ORPHAN_GRACE_MS 도 각각). 실측으로 세 벌의 로직은 아직 같지만(주석만 다르다)
//   **테스트가 한 줄도 없다.** couple 을 그냥 붙이면 네 벌이 된다.
//   이 프로젝트는 이미 이중과금 사고(75건/54명)를 겪었고, 반대 방향인 이중 환불도
//   똑같이 위험하다 — refundCoins 는 참조 기준 멱등이 아니라 두 번 부르면 코인이 는다.
//
// ★기존 3개 라우트는 건드리지 않는다(광범위 리팩토링 금지 · 회귀 리스크 0).
//   신규 couple 만 이 모듈을 쓰고, 여기에는 3벌에 없던 테스트가 붙는다.
//
// ★store 주입 구조인 이유: Supabase 클라이언트를 목으로 흉내 내면 "목의 동작"을
//   테스트하게 된다. 인메모리 가짜 store 로 진짜 로직을 돌린다
//   (lib/battle-idempotency.ts 의 사내 선례와 같은 방식).

/**
 * 크래시로 full_json 없이 남은 unlock 을 "진행 중"으로 볼 유예 시간.
 * 이 안이면 재차감을 막고 409로 잠시 후 재시도를 안내한다(동시 요청 보호).
 */
export const ORPHAN_GRACE_MS = 3 * 60 * 1000;

export interface UnlockStore {
  /** 이 order_id 로 이미 환불이 기록됐는지. 조회 자체가 실패하면 ok:false. */
  hasRefund(userId: string, orderId: string): Promise<{ ok: boolean; found: boolean }>;
  /** order_id 로 unlock 삭제. deletedCount 가 원자적 승자 결정에 쓰인다. */
  deleteUnlock(orderId: string): Promise<{ ok: boolean; deletedCount: number }>;
  refund(userId: string, amount: number, orderId: string): Promise<void>;
}

/**
 * 환불 책임자를 원자적으로 한 명만 뽑아 환불한다.
 *
 * 순서가 곧 안전장치다:
 * 1. 환불 기록 조회 — **fail-closed**. 조회가 실패했는데 "기록 없음"으로 오판하면
 *    이중 환불이 된다. 실패면 unlock 을 건드리지 않고 false 를 돌려준다.
 * 2. unlock 삭제 — 삭제된 row 가 있어야 이 호출이 환불 자격을 얻는다.
 *    동시/중복 호출이 와도 삭제에 성공한 단 하나만 다음으로 넘어간다.
 * 3. 이미 환불 기록이 있으면 삭제만 하고 재환불하지 않는다(방어적 케이스).
 *
 * @returns 처리 완료 여부. false 면 호출부가 500 을 내야 한다(조용히 넘기지 마라).
 */
export async function refundReportUnlock(
  store: UnlockStore,
  userId: string,
  orderId: string,
  cost: number,
): Promise<boolean> {
  const prior = await store.hasRefund(userId, orderId);
  if (!prior.ok) return false;

  const deleted = await store.deleteUnlock(orderId);
  if (!deleted.ok) return false;

  // 다른 경로가 이미 이 unlock 을 정리·환불했다 — 재환불 금지. 실패는 아니다.
  if (deleted.deletedCount === 0) return true;

  // 환불은 이미 기록됐는데 unlock 만 남아 있던 경우 — 삭제만 하고 끝낸다.
  if (prior.found) return true;

  await store.refund(userId, cost, orderId);
  return true;
}

/**
 * unlock 이 orphan(이전 시도가 도중에 끊긴 흔적)인지.
 * ★생성 시각을 모르면 orphan 으로 보지 않는다 — 모르는 것을 orphan 으로 처리하면
 *   진행 중인 요청을 죽이고 재차감으로 이어진다. 재차감 방지 쪽으로 기운다.
 */
export function isOrphanUnlock(createdAtMs: number | null, now: number): boolean {
  if (createdAtMs === null) return false;
  return now - createdAtMs > ORPHAN_GRACE_MS;
}
