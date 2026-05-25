// today 결제 흐름 공유 — TodayInputPage / TodayEntryClient 두 진입에서 같은 API 호출 사용.
// API 호출 + 응답 분기만 추출. setState/UI 처리는 호출처에 그대로.

export type TodayStartResult =
  | { kind: "reused"; resultId: string; refunded: boolean; balance: number | null }
  | { kind: "pending"; resultId: string; balance: number | null }
  | { kind: "insufficient"; balance: number }
  | { kind: "failed"; message: string; refunded: boolean };

export async function callTodayStart(params: {
  sessionId: string;
  targetDate: string;
  sourceResultId?: string | null;
}): Promise<TodayStartResult> {
  const body: Record<string, unknown> = {
    sessionId: params.sessionId,
    targetDate: params.targetDate,
  };
  if (params.sourceResultId) {
    body.sourceResultId = params.sourceResultId;
  }

  const res = await fetch("/api/today/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));

  if (data?.insufficient) {
    return { kind: "insufficient", balance: typeof data.balance === "number" ? data.balance : 0 };
  }
  if (!res.ok) {
    if (data?.refunded) {
      return { kind: "failed", message: "분석 준비에 실패했어. 알은 환불됐어.", refunded: true };
    }
    return {
      kind: "failed",
      message: typeof data?.error === "string" ? data.error : "처리에 실패했어.",
      refunded: false,
    };
  }

  const resultId = typeof data?.resultId === "string" ? data.resultId : "";
  if (!resultId) {
    return { kind: "failed", message: "결과 ID를 받지 못했어.", refunded: false };
  }

  const balance = typeof data?.balance === "number" ? data.balance : null;
  if (data?.reused) {
    return { kind: "reused", resultId, refunded: Boolean(data?.refunded), balance };
  }
  return { kind: "pending", resultId, balance };
}

export type TodayAnalyzeResult =
  | { kind: "completed" }
  | { kind: "failed"; message: string; refunded: boolean };

export async function callTodayAnalyze(resultId: string): Promise<TodayAnalyzeResult> {
  const res = await fetch("/api/today/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resultId }),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));

  if (!res.ok) {
    if (data?.refunded) {
      return { kind: "failed", message: "분석에 실패했어. 알은 환불됐어.", refunded: true };
    }
    return {
      kind: "failed",
      message: typeof data?.error === "string" ? data.error : "분석에 실패했어.",
      refunded: false,
    };
  }
  return { kind: "completed" };
}
