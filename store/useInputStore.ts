import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AnalysisScores = {
  재물운: number;
  연애운: number;
  직장운: number;
  건강운: number;
  대인운: number;
};

export type AnalysisResult = {
  tier: {
    grade: string;
    composite: number;
    percentileRank: number;
    topPercent: number;
    title: string;
    description: string;
  };
  scores: AnalysisScores;
  sections: Array<{
    icon: string;
    title: string;
    content: string;
  }>;
  coreFearAxisBlock: string;
};

export type TeaserResult = {
  tier: {
    grade: string;
    composite: number;
    percentileRank: number;
    topPercent: number;
    title: string;
    description: string;
  };
  scores: AnalysisScores;
  sections: Array<{
    icon: string;
    title: string;
  }>;
  coreFearAxisBlock: string;
};

// 핵심 결핍/공포 축 타입
export type CoreFearAxis = "DISMISS" | "ABANDON" | "INCOMPETENT" | "LOSS_OF_CONTROL";

export type InputState = {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: CoreFearAxis | "";
  unknownBirthTime: boolean;
  analysisResult: AnalysisResult | TeaserResult | null;
  setField: <K extends keyof InputState>(key: K, value: InputState[K]) => void;
  setFields: (values: Partial<InputState>) => void;
  setAnalysisResult: (result: AnalysisResult | TeaserResult | null) => void;
  reset: () => void;
};

const initialState = {
  name: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  calendarType: "solar" as const,
  birthHour: "",
  birthMinute: "",
  birthLocation: "",
  gender: "",
  relationshipStatus: "",
  employmentStatus: "",
  coreFearAxis: "" as CoreFearAxis | "",
  unknownBirthTime: false,
  analysisResult: null,
};

export const useInputStore = create<InputState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value } as Partial<InputState>),
      setFields: (values) => set(values),
      setAnalysisResult: (result) => set({ analysisResult: result }),
      reset: () => set(initialState),
    }),
    {
      name: "saju-input-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
    }
  )
);

// 개별 필드 선택자 - 불필요한 리렌더링 방지
export const useInputField = <K extends keyof InputState>(key: K) =>
  useInputStore((state) => state[key]);

// 여러 필드를 한번에 선택 (shallow compare)
export const useInputFields = <K extends keyof InputState>(keys: K[]) =>
  useInputStore((state) => {
    const result = {} as Pick<InputState, K>;
    for (const key of keys) {
      result[key] = state[key];
    }
    return result;
  });

// 자주 사용되는 조합을 위한 선택자
export const useBirthInputs = () =>
  useInputStore((state) => ({
    birthYear: state.birthYear,
    birthMonth: state.birthMonth,
    birthDay: state.birthDay,
    calendarType: state.calendarType,
    birthHour: state.birthHour,
    birthMinute: state.birthMinute,
    unknownBirthTime: state.unknownBirthTime,
  }));

export const useAllInputs = () =>
  useInputStore((state) => ({
    name: state.name,
    birthYear: state.birthYear,
    birthMonth: state.birthMonth,
    birthDay: state.birthDay,
    calendarType: state.calendarType,
    birthHour: state.birthHour,
    birthMinute: state.birthMinute,
    birthLocation: state.birthLocation,
    gender: state.gender,
    relationshipStatus: state.relationshipStatus,
    employmentStatus: state.employmentStatus,
    coreFearAxis: state.coreFearAxis,
    unknownBirthTime: state.unknownBirthTime,
  }));

export const useStoreActions = () =>
  useInputStore((state) => ({
    setField: state.setField,
    setFields: state.setFields,
    setAnalysisResult: state.setAnalysisResult,
    reset: state.reset,
  }));
