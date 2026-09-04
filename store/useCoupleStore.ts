// couple("우리 결혼해도 되는 사주일까") 입력 스토어 — 상대(B) 정보만 담는다.
//
// ★본인(A)은 여기 담지 않는다. 기존 useInputStore(자체입력) 또는 대표사주를 그대로 쓴다.
//   A 를 따로 담으면 정규화 경로가 갈라져 buildInputHash 가 달라지고, 같은 사람인데
//   해시가 어긋나 **중복 차감**이 난다. 이 프로젝트가 이미 겪은 사고(75건/54명)와 같은 계열이다.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PartnerDraft = {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  isLeapMonth: boolean;
  /** 시간을 모르면 true. ★빈 값을 0시로 읽으면 있지도 않은 시주가 생긴다. */
  unknownBirthTime: boolean;
  birthHour: string;
  birthMinute: string;
  gender: "" | "남성" | "여성";
  birthLocation: string;
};

export const EMPTY_PARTNER: PartnerDraft = {
  name: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  calendarType: "solar",
  isLeapMonth: false,
  unknownBirthTime: true,
  birthHour: "",
  birthMinute: "",
  gender: "",
  birthLocation: "서울",
};

type CoupleStore = {
  partner: PartnerDraft;
  setPartner: (patch: Partial<PartnerDraft>) => void;
  reset: () => void;
};

export const useCoupleStore = create<CoupleStore>()(
  persist(
    (set) => ({
      partner: EMPTY_PARTNER,
      setPartner: (patch) => set((s) => ({ partner: { ...s.partner, ...patch } })),
      reset: () => set({ partner: EMPTY_PARTNER }),
    }),
    { name: "couple-input" },
  ),
);

/** 필수값이 다 찼는지. 서버(validatePartnerInput)와 같은 기준 — 시간은 선택이다. */
export function isPartnerReady(p: PartnerDraft): boolean {
  return Boolean(p.name.trim() && p.birthYear && p.birthMonth && p.birthDay && p.gender);
}
