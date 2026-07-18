import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MaritalStatus } from "@/lib/marriage-facts";

// 결혼운 자체입력(self) 경로에서 관계상태(maritalStatus)를 OAuth 왕복·페이지 이동 사이에
// 유지하기 위한 persist 스토어. 생년월일 등 selfInput은 useInputStore(useAllInputs)를 재사용하고
// 여기서는 서비스 고유 질문인 관계상태만 담는다.
// ★ /marriage/self(관계상태 선택)에서 쓴 값을 /marriage/teaser가 그대로 읽어 start·analyze에
//   동일하게 넘긴다 — teaser가 결제 row를 매칭하는 값의 단일 소스.
export type MarriageState = {
  maritalStatus: MaritalStatus | null;
  setMaritalStatus: (status: MaritalStatus | null) => void;
  reset: () => void;
};

const initialState = {
  maritalStatus: null as MaritalStatus | null,
};

export const useMarriageStore = create<MarriageState>()(
  persist(
    (set) => ({
      ...initialState,
      setMaritalStatus: (status) => set({ maritalStatus: status }),
      reset: () => set(initialState),
    }),
    {
      name: "saju-marriage-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
    }
  )
);

/** localStorage에서 hydration이 완료되었는지 동기 체크 */
export const hasMarriageHydrated = () => useMarriageStore.persist.hasHydrated();
