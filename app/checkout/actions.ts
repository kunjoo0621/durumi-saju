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

    // 3. 눈에 띄는 신살 1개
    //
    // ★2026-08-27: 이 태그는 여태 한 번도 표시된 적이 없었다. 필터가 이중으로 죽어 있었다.
    //   ① 도화·역마는 엔진에서 type:"neutral" 인데 조건이 type==="good" 이었다.
    //   ② 실제 label 은 "천을귀인(天乙貴人)" 처럼 한자가 병기된 형태라
    //      ["도화","역마살","천을귀인","문창귀인"].includes(label) 이 완전일치로 전부 실패했다.
    //
    //   label 은 한자 병기·공망처럼 위치 접미(공망-시지)가 붙는 동적 변형이 있어 매칭 키로 취약하다.
    //   검출기 고유 식별자인 key 로 맞춘다. 우선순위는 SHINSAL_DEFS 정의 순서를 그대로 따르며
    //   (도화 > 역마 > 천을 > 문창) 대중 인지도가 높은 쪽이 먼저 잡혀 티저 훅 목적에 맞는다.
    //   ★칩이 11px 소형이라 한자 병기는 넘친다 — 괄호를 떼고 한글만 남긴다.
    const NOTABLE_SHINSAL_KEYS = new Set(["dohwa", "yeokma", "chuneul", "munchang"]);
    const notable = enriched.shinsal.matches.find((s) => NOTABLE_SHINSAL_KEYS.has(s.key));
    if (notable) {
      tags.push({ label: notable.label.replace(/\s*\(.*?\)/, ""), element: null });
    }

    return tags;
  } catch {
    return [];
  }
}
