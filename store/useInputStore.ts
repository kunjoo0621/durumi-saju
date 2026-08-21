import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

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
    confidence?: "high" | "medium" | "low";
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
  fortune?: import("@/lib/utils/saju-fortune").FortuneResult | null;
};

export type TeaserResult = {
  tier: {
    grade: string;
    composite: number;
    percentileRank: number;
    topPercent: number;
    confidence?: "high" | "medium" | "low";
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
  /** 음력 입력일 때만 의미가 있다. 그 해 그 월에 윤달이 실재할 때만 UI 에 노출된다. */
  isLeapMonth: boolean;
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: CoreFearAxis | "";
  unknownBirthTime: boolean;
  analysisResult: AnalysisResult | TeaserResult | null;
  cachedResultResponse: Record<string, unknown> | null;
  setField: <K extends keyof InputState>(key: K, value: InputState[K]) => void;
  setFields: (values: Partial<InputState>) => void;
  setAnalysisResult: (result: AnalysisResult | TeaserResult | null) => void;
  setCachedResultResponse: (data: Record<string, unknown> | null) => void;
  reset: () => void;
};

const initialState = {
  name: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  calendarType: "solar" as const,
  isLeapMonth: false,
  birthHour: "",
  birthMinute: "",
  birthLocation: "",
  gender: "",
  relationshipStatus: "",
  employmentStatus: "",
  coreFearAxis: "" as CoreFearAxis | "",
  unknownBirthTime: false,
  analysisResult: null,
  cachedResultResponse: null,
};

export const useInputStore = create<InputState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value } as Partial<InputState>),
      setFields: (values) => set(values),
      setAnalysisResult: (result) => set({ analysisResult: result }),
      setCachedResultResponse: (data) => set({ cachedResultResponse: data }),
      reset: () => set(initialState),
    }),
    {
      name: "saju-input-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      partialize: (state) => {
        // cachedResultResponse는 일시적 데이터이므로 localStorage에 저장하지 않음
        const { cachedResultResponse, ...rest } = state;
        return rest as Partial<InputState>;
      },
    }
  )
);

/** localStorage에서 hydration이 완료되었는지 동기 체크 */
export const hasInputHydrated = () => useInputStore.persist.hasHydrated();

// 개별 필드 선택자 - 불필요한 리렌더링 방지
export const useInputField = <K extends keyof InputState>(key: K) =>
  useInputStore((state) => state[key]);

// ★★ 아래 "묶음(bag)" 선택자들은 반드시 useShallow로 감싼다.
//
// 이유: zustand의 useStore는 useSyncExternalStoreWithSelector에 위임하고, 그 selection 메모는
// [getSnapshot, getServerSnapshot, selector, isEqual]에 걸려 있다. 인라인 화살표 selector는
// 렌더마다 identity가 바뀌므로 메모가 매 렌더 폐기되고, 결과적으로 "내용은 같은데 참조는 새로운"
// 객체가 매 렌더 반환된다. 그러면 이 값을 useMemo/useEffect 의존성에 넣은 화면이 렌더마다
// effect를 재실행한다.
//
// 실제 사고(2026-07-29): /career/teaser가 이 경로로 무한 fetch 루프에 빠져 단일 유저 탭 하나가
// 5분간 /api/career/start에 22,674건(초당 ~76회, 평소 하루치 인보케이션 전량)을 쐈다.
// useShallow는 selector 자체를 메모하지는 않지만(래퍼는 매 렌더 새 함수) 내부 useRef로
// "shallow-equal이면 이전 객체를 그대로 반환"하므로 결과 참조가 고정된다 — 의존성 배열에
// 필요한 성질은 이쪽이다. 필드 값은 건드리지 않으므로 buildInputHash(결제 row 매칭)에 영향 없음.
export const useInputFields = <K extends keyof InputState>(keys: K[]) =>
  useInputStore(
    useShallow((state) => {
      const result = {} as Pick<InputState, K>;
      for (const key of keys) {
        result[key] = state[key];
      }
      return result;
    }),
  );

// 자주 사용되는 조합을 위한 선택자
export const useBirthInputs = () =>
  useInputStore(
    useShallow((state) => ({
      birthYear: state.birthYear,
      birthMonth: state.birthMonth,
      birthDay: state.birthDay,
      calendarType: state.calendarType,
      isLeapMonth: state.isLeapMonth,
      birthHour: state.birthHour,
      birthMinute: state.birthMinute,
      unknownBirthTime: state.unknownBirthTime,
    })),
  );

export const useAllInputs = () =>
  useInputStore(
    useShallow((state) => ({
      name: state.name,
      birthYear: state.birthYear,
      birthMonth: state.birthMonth,
      birthDay: state.birthDay,
      calendarType: state.calendarType,
      isLeapMonth: state.isLeapMonth,
      birthHour: state.birthHour,
      birthMinute: state.birthMinute,
      birthLocation: state.birthLocation,
      gender: state.gender,
      relationshipStatus: state.relationshipStatus,
      employmentStatus: state.employmentStatus,
      coreFearAxis: state.coreFearAxis,
      unknownBirthTime: state.unknownBirthTime,
    })),
  );

export const useStoreActions = () =>
  useInputStore(
    useShallow((state) => ({
      setField: state.setField,
      setFields: state.setFields,
      setAnalysisResult: state.setAnalysisResult,
      reset: state.reset,
    })),
  );
