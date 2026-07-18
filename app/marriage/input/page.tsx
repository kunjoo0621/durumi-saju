"use client";

// 결혼운/애정운 심층 검사 — 관계상태 4분법 프리필 + 원탭 확인 화면.
// app/today/input/page.tsx의 결제 UI(잔액 체크 → 충전 시트 → 충전 후 자동 재시도) 패턴 미러.
//
// today/yearly input과의 구조적 차이:
// - SajuInputFlow(생년월일 등 멀티스텝 입력)를 쓰지 않는다 — 이 검사는 대표사주 필수라
//   /api/marriage/{from-primary,start,analyze} 전부 대표사주(getPrimarySajuData)만 본다.
//   즉 이 화면의 "입력"은 관계상태 4분법 한 문항뿐(스펙 §2).
// - today/yearly는 start에서 결제하지만, 결혼운은 start가 무료 teaser이고 analyze에서만
//   차감한다(app/api/marriage/analyze/route.ts 주석 참고) — 그래서 잔액 부족(402 insufficient)은
//   analyze 응답에서 갈릴 수 있어 start 이후에도 한 번 더 분기한다.
//
// 결제 라우팅 주의(운영자 확인 필요, 이 태스크 파일 범위 밖이라 미수정):
// hooks/useCharge.ts의 SUCCESS_PAGE_RETURNS와 app/coins/charge-success/page.tsx의
// RETURN_WHITELIST가 "/today"·"/today/input"·"/yearly"·"/yearly/input"만 허용한다.
// "/marriage/input"이 이 화이트리스트에 없는 동안은 실결제(PortOne) 시 charge-success를
// 경유하지 않고 이 페이지로 직접 redirect되며 afterCharge=1 신호도 오지 않는다 — 그 경우도
// 코인 자체는 정상 충전되지만(단지 자동 재시도가 안 걸릴 뿐) 사용자가 버튼을 한 번 더 누르면
// (그때는 잔액이 충분하므로) 정상 진행된다. Mock 결제(현재 기본값, CLAUDE.md)에서는 리다이렉트
// 자체가 없어 이 문제가 발생하지 않는다. 아래 afterCharge 처리는 화이트리스트가 나중에
// 추가됐을 때 바로 동작하도록 미리 넣어둔다.

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading, SkeletonBar } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import { MARRIAGE_COST } from "@/lib/constants/coins";
import { useCoinStore } from "@/store/useCoinStore";
import type { MaritalStatus } from "@/lib/marriage-facts";

type PrimaryState = "loading" | "ready" | "missing" | "error";

const STATUS_OPTIONS: Array<{ value: MaritalStatus; label: string; hint: string }> = [
  { value: "솔로", label: "솔로", hint: "지금은 혼자야" },
  { value: "연애중", label: "연애중", hint: "만나는 사람이 있어" },
  { value: "기혼", label: "기혼", hint: "결혼한 상태야" },
  { value: "다시 혼자", label: "다시 혼자", hint: "이혼·사별 등으로 지금은 혼자야" },
];

const STATUS_VALUES: MaritalStatus[] = STATUS_OPTIONS.map((o) => o.value);

const MARRIAGE_LOADING_STEPS: Array<{ message: string; delay: number }> = [
  { message: "사주 데이터를 다시 불러오고 있어", delay: 0 },
  { message: "배우자궁과 배우자성을 짚어보는 중", delay: 15_000 },
  { message: "인연이 강해지는 시기를 찾는 중", delay: 45_000 },
  { message: "결과를 정리하고 있어", delay: 80_000 },
];

export default function MarriageInputPage() {
  const router = useRouter();
  const { status } = useSession();
  const { balance, setBalance, fetchBalance } = useCoinStore();

  const [primaryState, setPrimaryState] = useState<PrimaryState>("loading");
  const [primaryErrorMsg, setPrimaryErrorMsg] = useState<string | null>(null);
  const [prefillStatus, setPrefillStatus] = useState<MaritalStatus | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<MaritalStatus | null>(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  // 대표사주 기반 프리필 로드
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/marriage/from-primary");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          // 대표사주 없음 — 막다른 안내 대신 자체입력(생년월일 질문)으로 바로 보낸다.
          router.replace("/marriage/self");
          return;
        }
        if (!res.ok) {
          setPrimaryErrorMsg(data?.error || "결혼운 정보를 못 불러왔어.");
          setPrimaryState("error");
          return;
        }
        const prefill: MaritalStatus = STATUS_VALUES.includes(data?.prefillStatus)
          ? data.prefillStatus
          : "솔로";
        setPrefillStatus(prefill);
        setSelectedStatus(prefill);
        setPrimaryState("ready");
      } catch {
        if (!cancelled) {
          setPrimaryErrorMsg("결혼운 정보를 못 불러왔어.");
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

  const runMarriageFlow = useCallback(
    async (maritalStatus: MaritalStatus, overrideBalance?: number) => {
      // client 잔액 선체크 — 부족하면 API 호출 없이 충전 시트 (today/input 패턴).
      // overrideBalance: 충전 직후 setBalance가 비동기라 closure의 balance가 stale일 때 명시 전달.
      const effectiveBalance = overrideBalance ?? balance;
      if (effectiveBalance !== null && effectiveBalance < MARRIAGE_COST) {
        setProcessing(false);
        setShowChargeSheet(true);
        return;
      }

      setError(null);
      setProcessing(true);
      try {
        // 1) start — 무료 teaser row 생성/재사용 (결제 없음)
        const startRes = await fetch("/api/marriage/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maritalStatus }),
        });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          throw new Error(startData?.error || "결혼운 준비에 실패했어.");
        }

        // 2) analyze — 여기서 실제 차감(멱등) + 분석
        const analyzeRes = await fetch("/api/marriage/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maritalStatus }),
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

        sessionStorage.setItem("marriageJustPaid", "1");
        router.replace(`/marriage/result?id=${resultId}`);
      } catch (err: any) {
        setError(err?.message || "처리 중 오류가 발생했어.");
        setProcessing(false);
      }
    },
    [balance, router, setBalance],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedStatus) return;
    if (status !== "authenticated") {
      signIn("kakao", { callbackUrl: "/marriage/input" });
      return;
    }
    void runMarriageFlow(selectedStatus);
  }, [selectedStatus, status, runMarriageFlow]);

  // 충전 완료 콜백 — balance 갱신 후 자동으로 분석 재시도
  const handleChargeComplete = useCallback(
    async (newBalance: number) => {
      setBalance(newBalance);
      setShowChargeSheet(false);
      if (!selectedStatus) return;
      await runMarriageFlow(selectedStatus, newBalance);
    },
    [setBalance, runMarriageFlow, selectedStatus],
  );

  // charge-success 복귀 처리 — 화이트리스트 추가 후를 대비한 선반영(파일 상단 주석 참고).
  // 프리필(selectedStatus) 로드 전에는 재시도하지 않고 대기했다가 로드되면 실행.
  const afterChargeRanRef = useRef(false);
  useEffect(() => {
    if (afterChargeRanRef.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("afterCharge") !== "1") return;
    if (primaryState === "missing" || primaryState === "error") {
      afterChargeRanRef.current = true;
      window.history.replaceState({}, "", "/marriage/input");
      return;
    }
    if (primaryState !== "ready" || !selectedStatus) return; // 아직 로딩 중 — 로드되면 재실행
    afterChargeRanRef.current = true;
    setProcessing(true);
    window.history.replaceState({}, "", "/marriage/input");
    (async () => {
      const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
      const bal = typeof r?.balance === "number" ? r.balance : undefined;
      if (typeof bal === "number") setBalance(bal);
      await runMarriageFlow(selectedStatus, bal);
    })();
  }, [primaryState, selectedStatus, runMarriageFlow, setBalance]);

  if (processing) {
    return (
      <FullScreenLoading
        steps={MARRIAGE_LOADING_STEPS}
        estimatedDuration={90000}
        subMessage="보통 1~2분 걸려"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={() => router.push("/marriage")} />

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-12 space-y-8">
          {status === "unauthenticated" ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">
                결혼운 검사는 로그인하고 봐야 해.
              </p>
              <button
                onClick={() => signIn("kakao", { callbackUrl: "/marriage/input" })}
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
                생년월일만 넣으면 바로 결혼운을 볼 수 있어.
              </p>
              <button
                onClick={() => router.push("/marriage/self")}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                생년월일 넣고 결혼운 보기
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
                  지금 상태를 알려줘
                </h1>
                <p className="text-body-2 text-text-secondary">
                  정답은 없어. 지금 있는 그대로 골라줘.
                </p>
              </div>

              <div className="space-y-3" role="radiogroup" aria-label="지금 관계 상태">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedStatus(opt.value)}
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
                        {opt.value === prefillStatus && (
                          <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 whitespace-nowrap">
                            저장된 상태
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-1 space-y-6 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">소비 알</span>
                    <span className="text-[17px] font-bold text-text-primary">{MARRIAGE_COST}알</span>
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
                  disabled={!selectedStatus}
                  className="btn-primary w-full h-[56px] rounded-xl text-[17px] font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
                >
                  {selectedStatus && selectedStatus === prefillStatus
                    ? "이대로 결혼운 보기"
                    : "이 상태로 결혼운 보기"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={MARRIAGE_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/marriage/input"
      />
    </div>
  );
}
