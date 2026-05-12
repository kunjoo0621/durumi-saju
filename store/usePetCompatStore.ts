// 펫 궁합 입력 상태 — 배틀 스토어 패턴 따름
// 보호자(나) 입력 + 펫 입력을 단계별로 받아 /checkout?type=pet으로 전달

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PetSpecies = "dog" | "cat";
export type PetGender = "male" | "female" | "unknown" | "";
export type BirthTier = 1 | 2 | 3 | 4;
export type AdoptionRoute = "purchase" | "rescue" | "gift" | "unknown" | "";

// 보호자 입력 (사주 단일 분석과 동일 필드 — 재사용 가능)
export interface PetCompatOwnerInput {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  unknownBirthTime: boolean;
  birthLocation: string;
  gender: "male" | "female" | "";
}

export interface PetCompatPetInput {
  name: string;
  species: PetSpecies | "";
  breed: string;
  gender: PetGender;

  birthTier: BirthTier | 0;     // 0 = 미선택
  birthDate: string;             // tier 1·2: "YYYY-MM-DD"
  birthTime: string;             // tier 1: "HH:mm"
  birthYearEstimated: string;    // tier 3
  birthMonthEstimated: string;   // tier 3
  adoptionDate: string;          // tier 4
  calendarType: "solar" | "lunar" | "";

  adoptionRoute: AdoptionRoute;

  // v0.6 — 사진 (옵션, AI 일러스트 변환용)
  photoPath: string;             // Supabase Storage 경로 (pet-uploads 버킷 안)
  photoUrl: string;              // 미리보기용 signed URL (1시간 유효)
}

export interface PetCompatState {
  ownerMode: "new" | "existing" | "";   // 기존 사주 재사용 vs 새 입력
  existingOwnerResultId: string | null;
  owner: PetCompatOwnerInput;
  pet: PetCompatPetInput;
  step: number;

  setOwnerMode: (m: "new" | "existing" | "") => void;
  setExistingOwnerResultId: (id: string | null) => void;
  setOwner: (data: Partial<PetCompatOwnerInput>) => void;
  setOwnerField: <K extends keyof PetCompatOwnerInput>(k: K, v: PetCompatOwnerInput[K]) => void;
  setPet: (data: Partial<PetCompatPetInput>) => void;
  setPetField: <K extends keyof PetCompatPetInput>(k: K, v: PetCompatPetInput[K]) => void;
  setStep: (s: number) => void;
  reset: () => void;
}

const emptyOwner: PetCompatOwnerInput = {
  name: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  calendarType: "solar",
  birthHour: "",
  birthMinute: "",
  unknownBirthTime: false,
  birthLocation: "",
  gender: "",
};

const emptyPet: PetCompatPetInput = {
  name: "",
  species: "",
  breed: "",
  gender: "",
  birthTier: 0,
  birthDate: "",
  birthTime: "",
  birthYearEstimated: "",
  birthMonthEstimated: "",
  adoptionDate: "",
  calendarType: "",
  adoptionRoute: "",
  photoPath: "",
  photoUrl: "",
};

const initialState = {
  ownerMode: "" as const,
  existingOwnerResultId: null as string | null,
  owner: { ...emptyOwner },
  pet: { ...emptyPet },
  step: 0,
};

export const usePetCompatStore = create<PetCompatState>()(
  persist(
    (set) => ({
      ...initialState,
      setOwnerMode: (m) => set({ ownerMode: m }),
      setExistingOwnerResultId: (id) => set({ existingOwnerResultId: id }),
      setOwner: (data) => set((s) => ({ owner: { ...s.owner, ...data } })),
      setOwnerField: (k, v) => set((s) => ({ owner: { ...s.owner, [k]: v } })),
      setPet: (data) => set((s) => ({ pet: { ...s.pet, ...data } })),
      setPetField: (k, v) => set((s) => ({ pet: { ...s.pet, [k]: v } })),
      setStep: (s) => set({ step: s }),
      reset: () => set({ ...initialState, owner: { ...emptyOwner }, pet: { ...emptyPet } }),
    }),
    {
      name: "pet-compat-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
    }
  )
);

export const hasPetCompatHydrated = () => usePetCompatStore.persist.hasHydrated();

export const usePetCompatOwner = () => usePetCompatStore((s) => s.owner);
export const usePetCompatPet = () => usePetCompatStore((s) => s.pet);
export const usePetCompatStep = () => usePetCompatStore((s) => s.step);
export const usePetCompatActions = () =>
  usePetCompatStore((s) => ({
    setOwnerMode: s.setOwnerMode,
    setExistingOwnerResultId: s.setExistingOwnerResultId,
    setOwner: s.setOwner,
    setOwnerField: s.setOwnerField,
    setPet: s.setPet,
    setPetField: s.setPetField,
    setStep: s.setStep,
    reset: s.reset,
  }));
