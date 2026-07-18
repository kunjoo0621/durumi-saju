"use client";

// 재물운 심층 검사 진입 화면 — app/marriage/MarriageEntryClient.tsx 미러.
// marriage와 차이: 대표사주 없으면 여전히 404지만(app/api/wealth/from-primary/route.ts:31),
// 여기서 읽는 필드는 loveScore가 아니라 wealthScore(개인사주 재물운 점수)다. 관심사(interest)는
// 아직 선택 전이라 이 화면에서는 프리필하지 않는다 — 관심사 선택은 /wealth/input의 몫.
// 결제(10알)는 여기서 하지 않는다 — wealth/start는 무료 teaser, wealth/analyze에서만 차감
// (app/api/wealth/analyze/route.ts 주석 참고).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { SkeletonBar } from "@/components/loading";

type FromPrimaryData = {
  wealthScore: number;
  sourceResultId: string;
};

export default function WealthEntryClient() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [primary, setPrimary] = useState<FromPrimaryData | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPrimaryLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wealth/from-primary");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          // 대표사주 없음 — 에러가 아니라 "먼저 사주 분석"으로 안내할 정상 상태.
          setPrimary(null);
        } else if (!res.ok) {
          setPrimaryError(data?.error || "재물운 정보를 못 불러왔어.");
        } else {
          setPrimary({
            wealthScore: typeof data?.wealthScore === "number" ? data.wealthScore : 0,
            sourceResultId: data?.sourceResultId || "",
          });
        }
      } catch {
        if (!cancelled) setPrimaryError("재물운 정보를 못 불러왔어.");
      } finally {
        if (!cancelled) setPrimaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-12 space-y-10">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold font-aggro text-text-primary">
              재물운 심층 검사
            </h1>
            <p className="text-body-2 text-text-secondary">
              같은 사주를 재성까지 더 깊이 들여다봐.
              <br />
              돈이 어떻게 들어오고, 어떻게 흘러가는지 그 결을 짚어줄게.
            </p>
          </div>

          {primaryLoading ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 space-y-3">
              <SkeletonBar className="h-5 w-40" />
              <SkeletonBar className="h-4 w-full" />
              <SkeletonBar className="h-4 w-3/4" />
              <SkeletonBar className="h-[54px] w-full rounded-xl mt-2" />
            </div>
          ) : primaryError ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">{primaryError}</p>
              <button
                onClick={() => router.push("/menu")}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                메뉴로 가기
              </button>
            </div>
          ) : !primary ? (
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
          ) : (
            <>
              <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 space-y-4">
                <div className="space-y-2.5">
                  <h2 className="text-[17px] font-bold text-text-primary">이런 걸 봐줘</h2>
                  <ul className="space-y-2 text-body-2 text-text-secondary">
                    <li>· 재성(정재·편재)이 어디에 있고 어떤 유형인지</li>
                    <li>· 그 재물을 담는 그릇이 얼마나 되는지</li>
                    <li>· 재물 흐름이 강해지는 시기와 관리가 필요한 시기</li>
                  </ul>
                </div>
                {primary.wealthScore > 0 && (
                  <p className="text-[13px] text-text-tertiary border-t border-white/5 pt-3">
                    지난 사주 분석에서 재물운 {primary.wealthScore}점이 나왔었지. 그 점수 뒤에 있는 이유를 더 파볼게.
                  </p>
                )}
              </div>

              <div className="px-1">
                <button
                  onClick={() => router.push("/wealth/input")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  내 사주로 재물운 보기
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
