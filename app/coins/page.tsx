"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import { useCharge } from "@/hooks/useCharge";
import { ButtonSpinner, FullScreenLoading } from "@/components/loading";
import CoinPackageCard from "@/components/CoinPackageCard";
import { COIN_PACKAGES, SAJU_COST, BATTLE_COST } from "@/lib/constants/coins";
import { useCoinStore } from "@/store/useCoinStore";
import { Egg, CaretDown } from "@phosphor-icons/react";

// 코인 페이지 진입 시 PortOne SDK 스크립트를 미리 로드
if (typeof window !== "undefined" && !document.querySelector('link[href*="cdn.portone.io"]')) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "script";
  link.href = "https://cdn.portone.io/v2/browser-sdk.js";
  document.head.appendChild(link);
}

const TX_TYPE_LABELS: Record<string, string> = {
  charge: "충전",
  spend: "사용",
  bonus: "보너스",
  refund: "환불",
};

const TX_TYPE_COLORS: Record<string, string> = {
  charge: "text-saju-water-muted",
  spend: "text-primary",
  bonus: "text-saju-earth-muted",
  refund: "text-saju-wood-muted",
};

export default function CoinsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { login } = useKakaoLogin();
  const { balance, fetchBalance, setBalance } = useCoinStore();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // pendingSpend redirect 처리 중 여부
  const hasPendingSpend = typeof window !== "undefined" && !!sessionStorage.getItem("pendingSpend");
  const [processingSpend, setProcessingSpend] = useState(hasPendingSpend);

  const { charge, charging, error } = useCharge({
    customerName: session?.user?.name || undefined,
    onSuccess: (data) => {
      setBalance(data.balance);
      setToast(`${data.charged}알 ${data.bonus > 0 ? `+ ${data.bonus}알 보너스 ` : ""}충전 완료!`);
      fetchHistory();
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      login("/coins");
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/coins/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.transactions ?? []);
      }
    } catch {} finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    setLoading(true);
    Promise.all([fetchBalance(), fetchHistory()]).finally(() => setLoading(false));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // PortOne redirect 복귀 처리
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const chargeOrderId = params.get("chargeOrderId");
    const packageId = params.get("packageId");
    const amount = params.get("amount");
    const paymentId = params.get("paymentId");

    if (!chargeOrderId || !packageId || !amount) return;
    if (params.get("code")) {
      setRedirectError(params.get("message") || "결제가 취소되었습니다.");
      sessionStorage.removeItem("pendingSpend");
      window.history.replaceState({}, "", "/coins");
      return;
    }

    const effectivePaymentId = paymentId || chargeOrderId;

    fetch("/api/coins/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId,
        orderId: chargeOrderId,
        paymentId: effectivePaymentId,
        amount: Number(amount),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "충전에 실패했습니다.");
        }
        return res.json();
      })
      .then(async (data) => {
        setBalance(data.balance);
        window.history.replaceState({}, "", "/coins");

        // pendingSpend가 있으면 자동 spend → 결과 페이지
        const raw = sessionStorage.getItem("pendingSpend");
        if (raw) {
          sessionStorage.removeItem("pendingSpend");
          try {
            const pending = JSON.parse(raw) as { sessionId: string; type: "analysis" | "battle" };
            const spendRes = await fetch("/api/coins/spend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: pending.sessionId, type: pending.type }),
            });
            const spendData = await spendRes.json().catch(() => ({}));

            if (spendData.insufficient) {
              setToast("알이 아직 부족해. 더 충전해줘.");
              return;
            }
            if (!spendRes.ok) {
              throw new Error(spendData?.error || "처리에 실패했습니다.");
            }

            if (pending.type === "battle") {
              // 배틀: analyze API 호출
              const analyzeRes = await fetch("/api/battle/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  playerA: (pending as any).playerA,
                  playerB: (pending as any).playerB,
                  relationshipType: (pending as any).relationshipType,
                  sessionId: pending.sessionId,
                }),
              });
              if (!analyzeRes.ok) throw new Error("배틀 분석에 실패했습니다.");
              const analyzeData = await analyzeRes.json();
              sessionStorage.setItem("sajuBattleJustPaid", "1");
              router.replace(`/battle/result${analyzeData.battleId ? `?id=${analyzeData.battleId}` : ""}`);
            } else {
              // 사주 분석: 결과 페이지로
              sessionStorage.setItem("sajuJustPaid", "1");
              const resultParams = new URLSearchParams();
              if (spendData.resultId) resultParams.set("resultId", spendData.resultId);
              if (spendData.pending) resultParams.set("pending", "true");
              router.replace(`/result?${resultParams.toString()}`);
            }
            return;
          } catch (err: any) {
            console.error("[COINS] pendingSpend error:", err?.message);
            setRedirectError(err?.message || "결과 처리에 실패했습니다. 알은 충전되었습니다.");
            setProcessingSpend(false);
          }
        }

        // pendingSpend 없으면 일반 충전 완료
        setToast(`${data.charged}알 ${data.bonus > 0 ? `+ ${data.bonus}알 보너스 ` : ""}충전 완료!`);
        fetchHistory();
      })
      .catch((err) => {
        setRedirectError(err?.message || "충전에 실패했습니다.");
        setProcessingSpend(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 토스트 자동 숨김
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const sajuCount = balance !== null ? Math.floor(balance / SAJU_COST) : 0;
  const battleCount = balance !== null ? Math.floor(balance / BATTLE_COST) : 0;

  const displayError = error || redirectError;

  // 결제 후 자동 충전→차감 처리 중
  if (processingSpend) {
    return (
      <FullScreenLoading
        steps={[
          { message: "충전을 처리하고 있어", delay: 0 },
          { message: "결과를 준비하고 있어", delay: 3000 },
        ]}
        subMessage="잠깐이면 돼"
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background-primary text-text-primary flex flex-col">
      <Header title="알 충전" showBack sticky />

      <main className="flex-1 px-5 pb-10">
        <div className="max-w-[640px] mx-auto pt-10 space-y-6">
          {/* 잔액 표시 */}
          <div className="text-center">
            <div className="text-[28px] font-bold font-aggro text-text-primary">
              <Egg size={28} weight="fill" className="inline-block -mt-1" /> {loading ? "..." : (balance ?? 0)}알
            </div>
            {!loading && balance !== null && (
              <p className="text-[14px] text-text-secondary mt-2">
                사주 {sajuCount}회 / 배틀 {battleCount}회 이용 가능
              </p>
            )}
          </div>

          {/* 패키지 카드 */}
          <div className="space-y-3">
            {COIN_PACKAGES.map((pkg) => (
              <CoinPackageCard
                key={pkg.id}
                pkg={pkg}
                onClick={() => charge(pkg)}
                disabled={charging || loading}
              />
            ))}
          </div>

          {charging && (
            <div className="flex justify-center py-2">
              <ButtonSpinner message="충전 처리 중..." />
            </div>
          )}

          {displayError && (
            <div className="rounded-xl bg-background-secondary px-4 py-3 text-[14px] text-text-secondary">
              {displayError}
            </div>
          )}

          {/* 안내문 */}
          <p className="text-caption text-text-tertiary text-center">
            충전한 알은 1년간 유효합니다
          </p>

          {/* 이용 내역 (아코디언) */}
          {!loading && history.length > 0 && (
            <div className="rounded-2xl bg-background-secondary overflow-hidden mt-4">
              <button
                type="button"
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
              >
                <span className="text-[15px] font-semibold text-text-secondary">
                  이용 내역
                </span>
                <CaretDown
                  size={18}
                  weight="bold"
                  className={`shrink-0 text-text-tertiary transition-transform duration-200 ${
                    historyOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {historyOpen && (
                <div>
                  <div className="h-px mx-4" style={{ background: "rgba(255,255,255,0.06)" }} />
                  {(() => {
                    // charge+bonus 병합: 같은 시간(60초 이내)의 charge 뒤 bonus를 한 행으로 합침
                    const merged: Array<{ id: string; type: string; amount: number; bonus?: number; balance_after: number; created_at: string }> = [];
                    for (let i = 0; i < history.length; i++) {
                      const tx = history[i];
                      if (tx.type === "bonus") continue; // bonus는 charge에 병합됨
                      if (tx.type === "charge") {
                        // 다음 항목이 bonus이고 60초 이내면 병합
                        const next = history[i + 1];
                        if (next?.type === "bonus" && Math.abs(new Date(tx.created_at).getTime() - new Date(next.created_at).getTime()) < 60000) {
                          merged.push({ ...tx, bonus: next.amount, balance_after: next.balance_after });
                          i++; // bonus 건너뜀
                          continue;
                        }
                      }
                      merged.push(tx);
                    }
                    return merged.map((tx, i) => {
                      const typeLabel = TX_TYPE_LABELS[tx.type] ?? tx.type;
                      const typeColor = TX_TYPE_COLORS[tx.type] ?? "text-text-secondary";
                      const sign = tx.amount > 0 ? "+" : "";
                      const date = new Date(tx.created_at);
                      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

                      return (
                        <div key={tx.id}>
                          {i > 0 && <div className="h-px mx-4" style={{ background: "rgba(255,255,255,0.06)" }} />}
                          <div className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className={`text-[13px] font-semibold ${typeColor} w-[42px]`}>
                                {typeLabel}
                              </span>
                              <span className="text-[13px] text-text-tertiary">{dateStr}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[14px] font-semibold ${tx.amount > 0 ? "text-text-primary" : "text-text-secondary"}`}>
                                {sign}{tx.amount}알
                                {tx.bonus ? <span className="text-primary ml-1">+{tx.bonus}</span> : null}
                              </span>
                              <span className="text-[12px] text-text-tertiary w-[48px] text-right">
                                잔액 {tx.balance_after}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 토스트 */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-background-secondary rounded-2xl px-5 py-3 text-[14px] font-semibold text-text-primary shadow-lg animate-fadeIn flex items-center gap-1.5">
          <Egg size={16} weight="fill" /> {toast}
        </div>
      )}
    </div>
  );
}
