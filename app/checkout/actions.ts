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

    // 1. Day master: 양목, 음화, etc.
    const yy = enriched.dayMaster.yinYang === "양" ? "양" : "음";
    tags.push({ label: `${yy}${enriched.dayMaster.element}`, element: enriched.dayMaster.element });

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
