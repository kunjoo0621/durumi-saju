"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import MenuDrawer from "../MenuDrawer";

export default function CoinsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnTo, setReturnTo] = useState("/start");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("returnTo");
    if (target && target.startsWith("/")) {
      setReturnTo(target);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("kakao", { callbackUrl: "/coins" });
    }
  }, [status]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    const fetchBalance = async () => {
      setLoading(true);
      const res = await fetch("/api/coins/balance");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setBalance(typeof data.balance === "number" ? data.balance : 0);
        setLoading(false);
      }
    };
    fetchBalance();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handlePurchase = async () => {
    setLoading(true);
    const res = await fetch("/api/coins/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1 }),
    });

    if (res.ok) {
      router.push(returnTo);
      return;
    }
    setLoading(false);
  };

  const subtitle = useMemo(() => {
    if (balance === null) return "코인 잔액을 불러오는 중입니다.";
    return `현재 잔액: ${balance}코인`;
  }, [balance]);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <header className="sticky top-0 z-[100] bg-background-primary px-5 py-5">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="이전 화면"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 text-text-primary font-aggro">코인 구매</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-40">
        <div className="max-w-[640px] mx-auto pt-10 space-y-6">
          <div className="bg-background-secondary rounded-2xl p-5 space-y-2">
            <div className="text-[18px] font-semibold">1코인 = 1,000원</div>
            <p className="text-[14px] text-text-secondary">{subtitle}</p>
          </div>

          <div className="bg-background-secondary rounded-2xl p-5">
            <div className="text-[16px] font-semibold mb-2">결제는 현재 Mock 처리</div>
            <p className="text-[14px] text-text-secondary">
              실제 결제 연동 전이므로 버튼을 누르면 코인이 즉시 충전됩니다.
            </p>
          </div>
        </div>
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            {loading ? "처리 중..." : "코인 1개(1000원) 구매"}
          </button>
        </div>
      </div>
    </div>
  );
}
