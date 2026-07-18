"use client";

// 재물운 심층 검사 — 관심사 4분법 원탭 확인 화면. app/marriage/input/page.tsx의 결제 UI
// (잔액 체크 → 충전 시트 → 충전 후 자동 재시도) 패턴 그대로 미러.
//
// marriage/input과의 구조적 차이:
// - 관심사(interest)는 프리필하지 않는다. 결혼운의 관계상태는 대표사주(relationship_status)에서
//   가져올 값이 이미 있었지만, 재물 관심사는 새로 묻는 질문이라 원국에서 끌어올 "저장된 답"이
//   없다 — 이 화면의 4개 버튼은 전부 미선택 상태로 시작하고, 사용자가 직접 골라야만 확인 버튼이
//   활성화된다(app/api/wealth/start·analyze/route.ts도 interest 화이트리스트 검증만 하지 프리필
//   소스가 없다).
// - 대표사주 존재 여부(primaryState)는 여전히 확인한다 — /api/wealth/from-primary가 404를
//   내면(대표사주 없음) "먼저 사주 분석" 안내로 흡수(marriage와 동일 패턴). 다만 여기서는
//   facts/wealthScore를 이 화면에 쓰지 않으므로 응답 바디는 존재 확인 용도로만 쓴다.
//
// 결제 라우팅 주의(운영자 확인 필요, 이 태스크 파일 범위 밖이라 미수정):
// hooks/useCharge.ts의 SUCCESS_PAGE_RETURNS와 app/coins/charge-success/page.tsx의
// RETURN_WHITELIST가 "/today"·"/today/input"·"/yearly"·"/yearly/input"·"/marriage"·
// "/marriage/input"만 허용한다. "/wealth/input"이 이 화이트리스트에 없는 동안은 실결제(PortOne)
// 시 charge-success를 경유하지 않고 이 페이지로 직접 redirect되며 afterCharge=1 신호도 오지
// 않는다 — 코인 자체는 정상 충전되고(단지 자동 재시도가 안 걸릴 뿐) 사용자가 버튼을 한 번 더
// 누르면 정상 진행된다. Mock 결제(현재 기본값)에서는 이 문제가 발생하지 않는다. 아래 afterCharge
// 처리는 화이트리스트가 나중에 추가됐을 때 바로 동작하도록 미리 넣어둔다(marriage 패턴 상속).

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading, SkeletonBar } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import { WEALTH_COST } from "@/lib/constants/coins";
import { useCoinStore } from "@/store/useCoinStore";
import type { WealthInterest } from "@/lib/wealth-facts";

type PrimaryState = "loading" | "ready" | "missing" | "error";

const INTEREST_OPTIONS: Array<{ value: WealthInterest; label: string; hint: string }> = [
  { value: "목돈·노후 준비", label: "목돈·노후 준비", hint: "안정적으로 모으고 싶어" },
  { value: "투자로 불리기", label: "투자로 불리기", hint: "굴려서 불리고 싶어" },
  { value: "사업·수입 키우기", label: "사업·수입 키우기", hint: "벌이 자체를 키우고 싶어" },
  { value: "지출·빚 관리", label: "지출·빚 관리", hint: "새는 돈부터 잡고 싶어" },
];

const WEALTH_LOADING_STEPS: Array<{ message: string; delay: number }> = [
  { message: "사주 데이터를 다시 불러오고 있어", delay: 0 },
  { message: "재성과 재를 담는 그릇을 짚어보는 중", delay: 15_000 },
  { message: "재물이 강해지는 시기를 찾는 중", delay: 45_000 },
  { message: "결과를 정리하고 있어", delay: 80_000 },
];

export default function WealthInputPage() {
  const router = useRouter();
  const { status } = useSession();
  const { balance, setBalance, fetchBalance } = useCoinStore();

  const [primaryState, setPrimaryState] = useState<PrimaryState>("loading");
  const [primaryErrorMsg, setPrimaryErrorMsg] = useState<string | null>(null);
  const [selectedInterest, setSelectedInterest] = useState<WealthInterest | null>(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  // 대표사주 존재 확인만 — 관심사는 프리필하지 않는다(파일 상단 주석 참고).
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wealth/from-primary");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setPrimaryState("missing");
          return;
        }
        if (!res.ok) {
          setPrimaryErrorMsg(data?.error || "재물운 정보를 못 불러왔어.");
          setPrimaryState("error");
          return;
        }
        setPrimaryState("ready");
      } catch {
        if (!cancelled) {
          setPrimaryErrorMsg("재물운 정보를 못 불러왔어.");
          setPrimaryState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // 진입 시 잔액 한 번 가져오기 — client 잔액 선체크용
  useEffect(() => {
    if (status === "authenticated") fetchBalance();
  }, [status, fetchBalance]);

  const runWealthFlow = useCallback(
    async (interest: WealthInterest, overrideBalance?: number) => {
      // client 잔액 선체크 — 부족하면 API 호출 없이 충전 시트 (marriage/input 패턴).
      const effectiveBalance = overrideBalance ?? balance;
      if (effectiveBalance !== null && effectiveBalance < WEALTH_COST) {
        setProcessing(false);
        setShowChargeSheet(true);
        return;
      }

      setError(null);
      setProcessing(true);
      try {
        // 1) start — 무료 teaser row 생성/재사용 (결제 없음)
        const startRes = await fetch("/api/wealth/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interest }),
        });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          throw new Error(startData?.error || "재물운 준비에 실패했어.");
        }

        // 2) analyze — 여기서 실제 차감(멱등) + 분석
        const analyzeRes = await fetch("/api/wealth/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interest }),
        });
        const analyzeData = await analyzeRes.json().catch(() => ({}));

        if (analyzeRes.status === 402 || analyzeData?.insufficient) {
          if (typeof analyzeData?.balance === "number") setBalance(analyzeData.balance);
          setProcessing(false);
          setShowChargeSheet(true);
          return;
        }
        if (!analyzeRes.ok) {
          throw new Error(
            analyzeData?.error ||
              (analyzeData?.refunded ? "분석에 실패했어. 알은 환불됐어." : "분석에 실패했어."),
          );
        }

        const resultId: string | undefined = analyzeData?.resultId;
        if (!resultId) throw new Error("결과 ID를 받지 못했어.");

        sessionStorage.setItem("wealthJustPaid", "1");
        router.replace(`/wealth/result?id=${resultId}`);
      } catch (err: any) {
        setError(err?.message || "처리 중 오류가 발생했어.");
        setProcessing(false);
      }
    },
    [balance, router, setBalance],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedInterest) return;
    if (status !== "authenticated") {
      signIn("kakao", { callbackUrl: "/wealth/input" });
      return;
    }
    void runWealthFlow(selectedInterest);
  }, [selectedInterest, status, runWealthFlow]);

  // 충전 완료 콜백 — balance 갱신 후 자동으로 분석 재시도
  const handleChargeComplete = useCallback(
    async (newBalance: number) => {
      setBalance(newBalance);
      setShowChargeSheet(false);
      if (!selectedInterest) return;
      await runWealthFlow(selectedInterest, newBalance);
    },
    [setBalance, runWealthFlow, selectedInterest],
  );

  // charge-success 복귀 처리 — 화이트리스트 추가 후를 대비한 선반영(파일 상단 주석 참고).
  // 관심사 선택 전에는 재시도하지 않고 대기(marriage와 달리 프리필이 없어 여기서
  // selectedInterest가 비어 있으면 영영 재시도가 안 걸릴 수 있음 — 그 경우는 그냥 URL 정리만
  // 하고 사용자가 직접 선택하게 둔다).
  const afterChargeRanRef = useRef(false);
  useEffect(() => {
    if (afterChargeRanRef.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("afterCharge") !== "1") return;
    if (primaryState === "missing" || primaryState === "error") {
      afterChargeRanRef.current = true;
      window.history.replaceState({}, "", "/wealth/input");
      return;
    }
    if (primaryState !== "ready") return; // 아직 로딩 중 — 로드되면 재실행
    if (!selectedInterest) {
      // 프리필이 없어 선택된 관심사가 없다 — 자동 재시도할 값이 없으므로 URL만 정리.
      afterChargeRanRef.current = true;
      window.history.replaceState({}, "", "/wealth/input");
      return;
    }
    afterChargeRanRef.current = true;
    setProcessing(true);
    window.history.replaceState({}, "", "/wealth/input");
    (async () => {
      const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
      const bal = typeof r?.balance === "number" ? r.balance : undefined;
      if (typeof bal === "number") setBalance(bal);
      await runWealthFlow(selectedInterest, bal);
    })();
  }, [primaryState, selectedInterest, runWealthFlow, setBalance]);

  if (processing) {
    return (
      <FullScreenLoading
        steps={WEALTH_LOADING_STEPS}
        estimatedDuration={90000}
        subMessage="보통 1~2분 걸려"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={() => router.push("/wealth")} />

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-12 space-y-8">
          {status === "unauthenticated" ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">
                재물운 검사는 로그인하고 봐야 해.
              </p>
              <button
                onClick={() => signIn("kakao", { callbackUrl: "/wealth/input" })}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                카카오로 로그인
              </button>
            </div>
          ) : status === "loading" || primaryState === "loading" ? (
            <>
              <div className="text-center space-y-2">
                <SkeletonBar className="h-6 w-48 mx-auto" />
                <SkeletonBar className="h-4 w-64 mx-auto" />
              </div>
              <div className="space-y-3">
                <SkeletonBar className="h-[76px] w-full rounded-2xl" />
                <SkeletonBar className="h-[76px] w-full rounded-2xl" />
                <SkeletonBar className="h-[76px] w-full rounded-2xl" />
                <SkeletonBar className="h-[76px] w-full rounded-2xl" />
              </div>
              <SkeletonBar className="h-[56px] w-full rounded-xl" />
            </>
          ) : primaryState === "missing" ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">
                재물운 검사는 이미 본 사주 분석 결과를 확장해서 풀어줘.
                <br />
                먼저 사주 분석부터 마쳐야 볼 수 있어.
              </p>
              <button
                onClick={() => router.push("/start")}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                내 사주 분석 먼저 하기
              </button>
            </div>
          ) : primaryState === "error" ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">{primaryErrorMsg}</p>
              <button
                onClick={() => router.push("/menu")}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                메뉴로 가기
              </button>
            </div>
          ) : (
            <>
              {/* 한 화면 = 한 질문(시니어 가독성) */}
              <div className="text-center space-y-2">
                <h1 className="text-[22px] font-bold font-aggro text-text-primary">
                  지금 재물 관심사를 알려줘
                </h1>
                <p className="text-body-2 text-text-secondary">
                  정답은 없어. 지금 가장 궁금한 걸 골라줘.
                </p>
              </div>

              <div className="space-y-3" role="radiogroup" aria-label="지금 재물 관심사">
                {INTEREST_OPTIONS.map((opt) => {
                  const isSelected = selectedInterest === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedInterest(opt.value)}
                      role="radio"
                      aria-checked={isSelected}
                      className={`btn-option w-full rounded-2xl px-5 py-5 text-left transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                        isSelected
                          ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.25)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="shrink-0 w-[22px] text-[18px] leading-none"
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[18px] font-bold">{opt.label}</span>
                          <span
                            className={`block text-[13.5px] mt-1 ${
                              isSelected ? "text-text-primary/80" : "text-text-tertiary"
                            }`}
                          >
                            {opt.hint}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-1 space-y-6 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">소비 알</span>
                    <span className="text-[17px] font-bold text-text-primary">{WEALTH_COST}알</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">현재 보유</span>
                    <span className="text-[15px] text-text-primary">{balance ?? "-"}알</span>
                  </div>
                </div>

                {error && (
                  <p className="text-[13px] text-amber-400 text-center">{error}</p>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={!selectedInterest}
                  className="btn-primary w-full h-[56px] rounded-xl text-[17px] font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
                >
                  이 관심사로 재물운 보기
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={WEALTH_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/wealth/input"
      />
    </div>
  );
}
