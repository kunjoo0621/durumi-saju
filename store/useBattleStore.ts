import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BattlePlayerInput, BattleResult, RelationshipType } from "@/types/battle";

export type BattleState = {
  // Player A (me)
  playerA: BattlePlayerInput;
  playerAMode: "new" | "existing" | "";
  existingResultId: string | null;

  // Player B (opponent)
  playerB: BattlePlayerInput;

  // Meta
  relationshipType: RelationshipType | "";
  step: number;

  // Result
  battleResult: BattleResult | null;

  // Actions
  setPlayerA: (data: Partial<BattlePlayerInput>) => void;
  setPlayerAMode: (mode: "new" | "existing" | "") => void;
  setExistingResultId: (id: string | null) => void;
  setPlayerB: (data: Partial<BattlePlayerInput>) => void;
  setPlayerBField: <K extends keyof BattlePlayerInput>(key: K, value: BattlePlayerInput[K]) => void;
  setRelationshipType: (type: RelationshipType | "") => void;
  setStep: (step: number) => void;
  setBattleResult: (result: BattleResult | null) => void;
  reset: () => void;
};

const emptyPlayer: BattlePlayerInput = {
  name: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  calendarType: "solar",
  birthHour: "",
  birthMinute: "",
  birthLocation: "",
  gender: "",
  relationshipStatus: "",
  employmentStatus: "",
  coreFearAxis: "",
  unknownBirthTime: false,
};

const initialState = {
  playerA: { ...emptyPlayer },
  playerAMode: "" as const,
  existingResultId: null as string | null,
  playerB: { ...emptyPlayer },
  relationshipType: "" as RelationshipType | "",
  step: 0,
  battleResult: null as BattleResult | null,
};

export const useBattleStore = create<BattleState>()(
  persist(
    (set) => ({
      ...initialState,
      setPlayerA: (data) =>
        set((state) => ({ playerA: { ...state.playerA, ...data } })),
      setPlayerAMode: (mode) => set({ playerAMode: mode }),
      setExistingResultId: (id) => set({ existingResultId: id }),
      setPlayerB: (data) =>
        set((state) => ({ playerB: { ...state.playerB, ...data } })),
      setPlayerBField: (key, value) =>
        set((state) => ({ playerB: { ...state.playerB, [key]: value } })),
      setRelationshipType: (type) => set({ relationshipType: type }),
      setStep: (step) => set({ step }),
      setBattleResult: (result) => set({ battleResult: result }),
      reset: () => set({ ...initialState, playerA: { ...emptyPlayer }, playerB: { ...emptyPlayer } }),
    }),
    {
      name: "saju-battle-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
    }
  )
);

/** localStorage에서 hydration이 완료되었는지 동기 체크 */
export const hasBattleHydrated = () => useBattleStore.persist.hasHydrated();

// Selector hooks
export const useBattlePlayerA = () => useBattleStore((s) => s.playerA);
export const useBattlePlayerB = () => useBattleStore((s) => s.playerB);
export const useBattleResult = () => useBattleStore((s) => s.battleResult);
export const useBattleStep = () => useBattleStore((s) => s.step);
export const useBattleRelationship = () => useBattleStore((s) => s.relationshipType);
export const useBattleActions = () =>
  useBattleStore((s) => ({
    setPlayerA: s.setPlayerA,
    setPlayerAMode: s.setPlayerAMode,
    setExistingResultId: s.setExistingResultId,
    setPlayerB: s.setPlayerB,
    setPlayerBField: s.setPlayerBField,
    setRelationshipType: s.setRelationshipType,
    setStep: s.setStep,
    setBattleResult: s.setBattleResult,
    reset: s.reset,
  }));
