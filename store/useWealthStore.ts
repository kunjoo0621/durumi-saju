import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WealthInterest } from "@/lib/wealth-facts";

// 재물운 자체입력(self) 경로에서 관심사(interest)를 OAuth 왕복·페이지 이동 사이에
// 유지하기 위한 persist 스토어. 생년월일 등 selfInput은 useInputStore(useAllInputs)를 재사용하고
// 여기서는 서비스 고유 질문인 관심사(4분법)만 담는다.
// ★ /wealth/self(관심사 선택)에서 쓴 값을 /wealth/teaser가 그대로 읽어 start·analyze에
//   동일하게 넘긴다 — teaser가 결제 row를 매칭하는 값의 단일 소스.
// (store/useMarriageStore.ts 미러 — maritalStatus → interest 치환.)
export type WealthState = {
  interest: WealthInterest | null;
  setInterest: (interest: WealthInterest | null) => void;
  reset: () => void;
};

const initialState = {
  interest: null as WealthInterest | null,
};

export const useWealthStore = create<WealthState>()(
  persist(
    (set) => ({
      ...initialState,
      setInterest: (interest) => set({ interest }),
      reset: () => set(initialState),
    }),
    {
      name: "saju-wealth-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
    }
  )
);

/** localStorage에서 hydration이 완료되었는지 동기 체크 */
export const hasWealthHydrated = () => useWealthStore.persist.hasHydrated();
