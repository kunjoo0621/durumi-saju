/**
 * 월운(月運) 산출 — 한 해 12개월의 흐름.
 *
 * 명리학에서 월운은 세운 다음 단계 시기성. 12개월 각각의 천간지지(월건 月建)를
 * 일간 기준으로 십성·12운성으로 매핑.
 *
 * SDK calculateMonthlyLuck(year, 1, 12)이 절기 기준 월건을 산출 — 단순 양력 월 X.
 */

import { getTenGodForStem } from "@gracefullight/saju";
import { STEM_ELEMENT, BRANCH_INFO } from "./saju-enrichment";

// 12운성 한국어 (saju-fortune.ts와 동일 — 중복 정의)
const STAGE_KOREAN = [
  "장생", "목욕", "관대", "건록", "제왕", "쇠",
  "병", "사", "묘", "절", "태", "양",
] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const YANG_BIRTH: Record<string, string> = { 甲: "亥", 丙: "寅", 戊: "寅", 庚: "巳", 壬: "申" };
const YIN_BIRTH: Record<string, string> = { 乙: "午", 丁: "酉", 己: "酉", 辛: "子", 癸: "卯" };

function getTwelveStageKr(dayStem: string, branch: string): string {
  const isYang = YANG_STEMS.has(dayStem);
  const birthBranch = isYang ? YANG_BIRTH[dayStem] : YIN_BIRTH[dayStem];
  if (!birthBranch) return "알수없음";
  const birthIdx = BRANCHES.indexOf(birthBranch as typeof BRANCHES[number]);
  const targetIdx = BRANCHES.indexOf(branch as typeof BRANCHES[number]);
  if (birthIdx < 0 || targetIdx < 0) return "알수없음";
  const stageIdx = isYang
    ? (targetIdx - birthIdx + 12) % 12
    : (birthIdx - targetIdx + 12) % 12;
  return STAGE_KOREAN[stageIdx];
}

/** 12운성 → mood 단순화 라벨 */
const STAGE_MOOD: Record<string, MonthlyMood> = {
  장생: "강세", 관대: "강세", 건록: "강세", 제왕: "강세",
  목욕: "보통", 쇠: "보통", 태: "보통", 양: "보통",
  병: "주의", 사: "주의",
  묘: "위기", 절: "위기",
};

export type MonthlyMood = "강세" | "보통" | "주의" | "위기";

export interface MonthlyEntry {
  month: number;          // 1~12
  pillar: string;         // 庚寅
  stem: string;
  branch: string;
  stemKorean: string;     // 경
  branchKorean: string;   // 인
  pillarKorean: string;   // 경인
  tenStar: string;        // 정인
  twelveStage: string;    // 목욕
  mood: MonthlyMood;
}

const STEM_HANJA_LIST = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

function isValidStem(s: string): boolean {
  return STEM_HANJA_LIST.includes(s);
}

/**
 * 12개월별 천간지지·십성·12운성·mood 산출.
 * dayStem이 비어있으면 null.
 */
export async function calculateYearlyMonthlyFlow(
  targetYear: number,
  dayStem: string,
): Promise<MonthlyEntry[] | null> {
  if (!isValidStem(dayStem)) return null;

  try {
    const { calculateMonthlyLuck } = await import("@gracefullight/saju");
    const monthly = calculateMonthlyLuck(targetYear, 1, 12);

    const result: MonthlyEntry[] = monthly.map((m: any) => {
      const stem: string = m.stem;
      const branch: string = m.branch;
      const tenGod = getTenGodForStem(dayStem, stem);
      const twelveStage = getTwelveStageKr(dayStem, branch);
      const mood = STAGE_MOOD[twelveStage] ?? "보통";
      return {
        month: m.month,
        pillar: m.pillar,
        stem,
        branch,
        stemKorean: STEM_ELEMENT[stem]?.korean ?? stem,
        branchKorean: BRANCH_INFO[branch]?.korean ?? branch,
        pillarKorean: `${STEM_ELEMENT[stem]?.korean ?? stem}${BRANCH_INFO[branch]?.korean ?? branch}`,
        tenStar: tenGod.korean,
        twelveStage,
        mood,
      };
    });

    return result;
  } catch (error) {
    console.warn("[YEARLY_MONTHLY] failed", error);
    return null;
  }
}

/** 프롬프트용 12개월 흐름 텍스트 블록. */
export function buildMonthlyFlowBlock(monthly: MonthlyEntry[] | null): string {
  if (!monthly || monthly.length === 0) return "";
  const lines = ["\n[월별 흐름 — 12개월 (월운 月運)]"];
  for (const m of monthly) {
    lines.push(
      `${m.month}월: ${m.pillarKorean}(${m.pillar}) / ${m.tenStar}·12운성 ${m.twelveStage} → ${m.mood}`,
    );
  }
  return lines.join("\n");
}
