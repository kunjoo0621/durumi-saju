"use server";

import { calculateSaju, enrichSajuData } from "@/lib/utils/saju";

export type SajuTag = {
  label: string;
  element: string | null; // KoreanElement: "목" | "화" | "토" | "금" | "수"
};

type TagInput = {
  birthYear: string | number;
  birthMonth: string | number;
  birthDay: string | number;
  birthHour?: string | number;
  birthMinute?: string | number;
  birthLocation?: string;
  unknownBirthTime?: boolean;
};

export async function getQuickSajuTags(input: TagInput): Promise<SajuTag[]> {
  try {
    const saju = await calculateSaju(
      Number(input.birthYear),
      Number(input.birthMonth),
      Number(input.birthDay),
      input.unknownBirthTime ? undefined : Number(input.birthHour),
      input.unknownBirthTime ? undefined : Number(input.birthMinute),
      { birthLocation: input.birthLocation },
    );
    if (!saju) return [];

    const enriched = enrichSajuData(saju, { isTimeUnknown: input.unknownBirthTime });

    const tags: SajuTag[] = [];

    // 1. Day master: 자연물 표현 (큰 나무, 태양, etc.)
    const DAY_MASTER_LABELS: Record<string, Record<string, string>> = {
      목: { 양: "큰 나무", 음: "풀꽃" },
      화: { 양: "태양", 음: "촛불" },
      토: { 양: "큰 산", 음: "들판" },
      금: { 양: "바위", 음: "보석" },
      수: { 양: "바다", 음: "빗물" },
    };
    const yy = enriched.dayMaster.yinYang === "양" ? "양" : "음";
    const dayLabel = DAY_MASTER_LABELS[enriched.dayMaster.element]?.[yy] ?? `${yy}${enriched.dayMaster.element}`;
    tags.push({ label: dayLabel, element: enriched.dayMaster.element });

    // 2. Strength: 신강/신약
    if (enriched.strength?.legacy) {
      tags.push({ label: enriched.strength.legacy, element: null });
    }

    // 3. First notable good shinsal (도화, 역마, etc.)
    const notable = enriched.shinsal.matches.find(
      (s) => s.type === "good" && ["도화", "역마살", "천을귀인", "문창귀인"].includes(s.label),
    );
    if (notable) {
      tags.push({ label: notable.label, element: null });
    }

    return tags;
  } catch {
    return [];
  }
}
