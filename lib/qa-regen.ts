// LLM 리포트 생성 공용 QA 재생성 루프 — lib/pet-compat.ts:604-634 패턴의 일반화.
// 원칙: 가드가 문장을 "삭제"만 하면 걸릴수록 리포트가 짧아진다(유료 리포트 품질 하락).
// 위반이 잡히면 위반 목록을 프롬프트에 덧붙여 1회 재생성하고, 그래도 위반이면
// 스크럽본을 출고한다(기존과 동일한 안전 하한 — 리포트를 비우지 않음).
// Gemini 의존을 주입(callModel)으로 끊어 node --import tsx --test 단위 테스트 가능.

export interface QaGenOptions<T> {
  prompt: string;
  systemPrompt: string;
  models: string[];
  temperature?: number;
  callModel: (
    model: string,
    prompt: string,
    systemPrompt: string,
    cfg: { temperature: number },
  ) => Promise<{ ok: boolean; text?: string; status?: number; apiStatus?: string; message?: string }>;
  shouldFallback: (status: number, apiStatus?: string) => boolean;
  parse: (text: string) => unknown;
  validateBlocks: (parsed: unknown) => string[];
  applyGuards: (parsed: unknown) => { blocks: T; violations: string[] };
  softValidate?: (blocks: T) => string[];
  maxAttempts?: number;
}

export type QaGenResult<T> =
  | { ok: true; blocks: T; violations: string[]; softIssues: string[]; attempts: number }
  | { ok: false; error: string };

export async function generateWithQaRegen<T>(opts: QaGenOptions<T>): Promise<QaGenResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 2;
  const temperature = opts.temperature ?? 0.75;
  let extra = "";
  let lastError = "분석 생성 실패";
  let lastGuarded: { blocks: T; violations: string[] } | null = null;
  let lastAttempt = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastAttempt = attempt;

    // ── 모델 폴백 체인 (기존 analyze 라우트 루프와 동일 의미) ──
    let parsed: unknown = null;
    for (const model of opts.models) {
      const res = await opts.callModel(model, opts.prompt + extra, opts.systemPrompt, { temperature });
      if (res.ok && typeof res.text === "string") {
        try {
          const candidate = opts.parse(res.text);
          const blockIssues = opts.validateBlocks(candidate);
          if (blockIssues.length > 0) {
            lastError = `블록 검증 실패: ${blockIssues.join(", ")}`;
            continue; // 다음 모델
          }
          parsed = candidate;
          break;
        } catch (err: any) {
          lastError = `JSON 파싱 실패: ${err?.message ?? "unknown"}`;
          continue;
        }
      }
      lastError = res.message ?? "LLM 호출 실패";
      if (!opts.shouldFallback(res.status ?? 500, res.apiStatus)) break;
    }
    if (parsed === null) continue; // 이번 attempt 전체 실패 → 재시도

    const guarded = opts.applyGuards(parsed);
    lastGuarded = guarded;

    // ★위반 유무와 무관하게 softValidate 실행 — 위반+얇음 동시 케이스도 regen note에 richness
    //  채움경로가 실리도록(2026-07-21 실측: 위반0인데도 얇은 리포트가 미달 사실 없이 출고되던 갭).
    const softIssues = opts.softValidate ? opts.softValidate(guarded.blocks) : [];

    if (guarded.violations.length === 0 && softIssues.length === 0) {
      return { ok: true, blocks: guarded.blocks, violations: [], softIssues: [], attempts: attempt };
    }
    if (attempt < maxAttempts) {
      const notes = [...guarded.violations, ...softIssues];
      extra = `\n\n[★ 직전 출력이 다음 룰을 위반했다. 아래 위반이 없도록 해당 부분을 완전히 새로 써라: ${notes.join(" / ")}]`;
    }
  }

  if (lastGuarded) {
    // 재생성으로도 못 없앤 위반/얇음 → 스크럽본 출고(호출부가 postGuard 검증·감사 기록 담당).
    // softIssues를 마지막 blocks 기준으로 재계산해 반환 → 호출부가 richness 미달 최종출고를 기록 가능.
    return {
      ok: true,
      blocks: lastGuarded.blocks,
      violations: lastGuarded.violations,
      softIssues: opts.softValidate ? opts.softValidate(lastGuarded.blocks) : [],
      attempts: lastAttempt,
    };
  }
  return { ok: false, error: lastError };
}
