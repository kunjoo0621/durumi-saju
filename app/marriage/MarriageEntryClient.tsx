"use client";

// 결혼운/애정운 심층 검사 진입 화면 — app/today/TodayEntryClient.tsx 미러.
// today와 차이: 대표사주 필수(가벼운 자체 입력 경로 없음) — /api/marriage/from-primary가
// 대표사주 없으면 404를 낸다(app/api/marriage/from-primary/route.ts:38). today/from-primary는
// 항상 200 + result:null이라 여기서만 404를 "대표사주 없음"으로 별도 흡수한다.
// 결제(10알)는 여기서 하지 않는다 — 관계상태 확인은 /marriage/input에서, 결제는 그 확인 이후
// (marriage/start는 무료 teaser, marriage/analyze에서만 차감. 스펙 §2·§5 참고).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { SkeletonBar } from "@/components/loading";

type FromPrimaryData = {
  loveScore: number;
  sourceResultId: string;
};

export default function MarriageEntryClient() {
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
        const res = await fetch("/api/marriage/from-primary");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          // 대표사주 없음 — 에러가 아니라 "먼저 사주 분석"으로 안내할 정상 상태.
          setPrimary(null);
        } else if (!res.ok) {
          setPrimaryError(data?.error || "결혼운 정보를 불러올 수 없어요.");
        } else {
          setPrimary({
            loveScore: typeof data?.loveScore === "number" ? data.loveScore : 0,
            sourceResultId: data?.sourceResultId || "",
          });
        }
      } catch {
        if (!cancelled) setPrimaryError("결혼운 정보를 불러올 수 없어요.");
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
              결혼운 · 애정운 심층 검사
            </h1>
            <p className="text-body-2 text-text-secondary">
              같은 사주를 배우자궁까지 더 깊이 들여다봐.
              <br />
              지금 혼자여도, 함께여도, 다시 혼자여도 다 괜찮아.
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
                결혼운 검사는 이미 본 사주 분석 결과를 확장해서 풀어줘.
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
                    <li>· 배우자궁(일지)이 지금 어떤 상태인지</li>
                    <li>· 나에게 끌리는 배우자상과 연애·관계 패턴</li>
                    <li>· 인연이 강해지는 시기와 조심할 시기</li>
                  </ul>
                </div>
                {primary.loveScore > 0 && (
                  <p className="text-[13px] text-text-tertiary border-t border-white/5 pt-3">
                    지난 사주 분석에서 연애운 {primary.loveScore}점이 나왔었지. 그 점수 뒤에 있는 이유를 더 파볼게.
                  </p>
                )}
              </div>

              <div className="px-1">
                <button
                  onClick={() => router.push("/marriage/input")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  내 사주로 결혼운 보기
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
