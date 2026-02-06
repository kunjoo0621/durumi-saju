"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MenuDrawer from "../MenuDrawer";
import { useAllInputs } from "@/store/useInputStore";

function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
      <div className="text-text-secondary text-[14px]">화면 로딩 중...</div>
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputs = useAllInputs();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRequiredInput = useMemo(() => {
    if (
      !inputs.name.trim() ||
      !inputs.birthYear ||
      !inputs.birthMonth ||
      !inputs.birthDay ||
      !inputs.birthLocation ||
      !inputs.gender ||
      !inputs.relationshipStatus ||
      !inputs.employmentStatus ||
      !inputs.coreFearAxis
    ) {
      return false;
    }

    if (!inputs.unknownBirthTime && (!inputs.birthHour || !inputs.birthMinute)) {
      return false;
    }

    return true;
  }, [inputs]);

  useEffect(() => {
    if (!hasRequiredInput) {
      router.replace("/start");
    }
  }, [hasRequiredInput, router]);

  useEffect(() => {
    if (searchParams?.get("error") === "payment") {
      setError("결제가 완료되지 않았습니다. 다시 시도해 주세요.");
    }
  }, [searchParams]);

  const handleProceed = async () => {
    if (!hasRequiredInput || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/intake/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "결제 준비에 실패했습니다.");
      }

      const data = await res.json();
      const sessionId = typeof data?.sessionId === "string" ? data.sessionId : "";
      if (!sessionId) {
        throw new Error("결제 세션을 만들지 못했습니다.");
      }

      router.push(`/payment?returnTo=/result&sessionId=${encodeURIComponent(sessionId)}`);
    } catch (err: any) {
      setError(err?.message || "결제 준비 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
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
          <h1 className="text-title-3 text-text-primary font-aggro">결제 전 확인</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-40">
        <div className="max-w-[640px] mx-auto pt-20 space-y-4">
          <p className="text-[18px] font-semibold">전체 결과표 + 8개 섹션 리포트가 열려요</p>
          <p className="text-[15px] text-text-secondary">결과는 계정에 저장돼서 다시 볼 수 있어요</p>
          {error && (
            <div className="rounded-xl bg-background-secondary px-4 py-3 text-[14px] text-text-secondary">
              {error}
            </div>
          )}
        </div>
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handleProceed}
            disabled={submitting || !hasRequiredInput}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            {submitting ? "결제 준비 중..." : "1,000원 내고 사주 보기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}
