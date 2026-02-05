export type AnalysisScores = {
  재물운: number;
  연애운: number;
  직장운: number;
  건강운: number;
  대인운: number;
};

function normalizeScoreValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object" && "score" in value) {
    const raw = (value as { score?: unknown }).score;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
  }
  return 0;
}

export function normalizeScores(scores: unknown): AnalysisScores {
  const record = (scores && typeof scores === "object" ? scores : {}) as Record<string, unknown>;
  return {
    재물운: normalizeScoreValue(record["재물운"]),
    연애운: normalizeScoreValue(record["연애운"]),
    직장운: normalizeScoreValue(record["직장운"]),
    건강운: normalizeScoreValue(record["건강운"]),
    대인운: normalizeScoreValue(record["대인운"]),
  };
}
