/**
 * 배틀 멱등성 — 한 결제(prepayment_session)당 배틀 1건 보장.
 *
 * 배경(2026-07-25 실측): battle/analyze 가 body.sessionId 를 받아놓고 쓰지 않아
 * 더블탭·재시도·화면복귀 때마다 Gemini 재호출 + saju_battles row 중복 생성이 났다.
 * (정윤하 5ee54439: 배틀 17판 / -20알 결제 11건 → 6판 무과금, order_id 전부 null)
 *
 * 방어는 2단:
 *  1) 라우트 진입 직후 findBattleBySession — 이미 있으면 LLM 자체를 안 돈다(비용 0).
 *  2) insert 시 session_id UNIQUE 부분인덱스 위반(23505)을 잡아 기존 row 로 수렴 —
 *     선조회를 동시에 통과한 진짜 동시 요청(race)까지 막는다.
 *
 * 게스트(session_id = null)는 결제 개념이 없어 기존 동작을 그대로 둔다.
 * 부분인덱스가 WHERE session_id IS NOT NULL 이라 null 은 서로 충돌하지 않는다.
 */

/** Postgres unique_violation */
export const UNIQUE_VIOLATION = "23505";

export type DbError = { code?: string; message?: string } | null | undefined;

export type StoredBattle = {
  id: string;
  session_id: string | null;
  full_result: unknown;
};

export interface BattleStore {
  findBySessionId(sessionId: string): Promise<StoredBattle | null>;
  insert(row: Record<string, unknown>): Promise<{ row: StoredBattle | null; error: DbError }>;
}

export function isUniqueViolation(error: DbError): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

/**
 * 이 결제 세션으로 만들어진 배틀이 이미 있는지 조회.
 * sessionId 가 없으면(게스트·레거시 호출) 조회조차 하지 않는다.
 */
export async function findBattleBySession(
  store: BattleStore,
  sessionId: string | null | undefined
): Promise<StoredBattle | null> {
  if (!sessionId) return null;
  return store.findBySessionId(sessionId);
}

export type InsertOutcome = {
  battleId: string | null;
  result: unknown;
  /** 기존 row 를 재사용했는지 (= 중복 호출이었음) */
  reused: boolean;
  error: DbError;
};

/**
 * 배틀 row insert (일시 오류 1회 재시도 + UNIQUE 위반 시 기존 row 수렴).
 *
 * 반환 계약: 실패해도 throw 하지 않고 error 를 담아 돌려준다 —
 * 호출부(라우트)가 기존처럼 500 응답을 직접 만들 수 있게.
 */
export async function insertBattleIdempotent(
  store: BattleStore,
  row: Record<string, unknown>,
  sessionId: string | null | undefined,
  opts: { retryDelayMs?: number } = {}
): Promise<InsertOutcome> {
  const rowToInsert = { ...row, session_id: sessionId || null };
  let lastError: DbError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { row: inserted, error } = await store.insert(rowToInsert);

    if (!error && inserted?.id) {
      return { battleId: inserted.id, result: inserted.full_result ?? row.full_result, reused: false, error: null };
    }

    lastError = error;

    // 동시 요청이 먼저 넣었다 → 재시도하지 않고 그 row 로 수렴 (LLM 결과는 버린다)
    if (isUniqueViolation(error)) {
      const existing = await findBattleBySession(store, sessionId);
      if (existing) {
        return { battleId: existing.id, result: existing.full_result, reused: true, error: null };
      }
      // 위반인데 조회가 비는 비정상 상황 — 재시도해도 같은 결과라 즉시 종료
      break;
    }

    if (attempt === 0) {
      const delay = opts.retryDelayMs ?? 500;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { battleId: null, result: row.full_result ?? null, reused: false, error: lastError };
}
