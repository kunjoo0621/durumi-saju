import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CareerSituation } from "@/lib/career-facts";

// 커리어운 자체입력(self) 경로에서 상황(situation)을 OAuth 왕복·페이지 이동 사이에 유지하는
// persist 스토어. 생년월일 등 selfInput은 useInputStore(useAllInputs)를 재사용하고, 여기서는
// 서비스 고유 질문인 상황(4분법)만 담는다.
// ★ /career/self(상황 선택)에서 쓴 값을 /career/teaser가 그대로 읽어 start·analyze에 동일하게
//   넘긴다 — teaser가 결제 row를 매칭하는 값의 단일 소스.
// (store/useWealthStore.ts 미러 — interest → situation 치환.)
export type CareerState = {
  situation: CareerSituation | null;
  setSituation: (situation: CareerSituation | null) => void;
  reset: () => void;
};

const initialState = {
  situation: null as CareerSituation | null,
};

export const useCareerStore = create<CareerState>()(
  persist(
    (set) => ({
      ...initialState,
      setSituation: (situation) => set({ situation }),
      reset: () => set(initialState),
    }),
    {
      name: "saju-career-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
    }
  )
);

/** localStorage에서 hydration이 완료되었는지 동기 체크 */
export const hasCareerHydrated = () => useCareerStore.persist.hasHydrated();
