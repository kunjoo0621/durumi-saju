import { create } from "zustand";

interface CoinState {
  balance: number | null;
  isLoading: boolean;
  fetchBalance: () => Promise<void>;
  setBalance: (n: number) => void;
}

export const useCoinStore = create<CoinState>()((set, get) => ({
  balance: null,
  isLoading: false,

  fetchBalance: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await fetch("/api/coins/balance");
      if (!res.ok) {
        set({ isLoading: false });
        return;
      }
      const data = await res.json();
      set({
        balance: typeof data.balance === "number" ? data.balance : 0,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setBalance: (n: number) => set({ balance: n }),
}));
