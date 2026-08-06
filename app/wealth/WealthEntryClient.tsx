"use client";

// 재물운 심층 검사 진입 화면 — app/marriage/MarriageEntryClient.tsx 2-경로 패턴 미러.
// marriage와 차이:
//  · 로그인 강제 없음(app/wealth/page.tsx가 requireSession 게이트를 제거) — 비로그인도 진입해
//    설명을 보고 자체입력 경로로 들어갈 수 있다. 로그인은 SajuInputFlow 제출 시점에만.
//  · 대표사주 응답에서 읽는 값은 hasWealthScore(이전 분석 존재 여부)뿐이다. 점수 숫자는
//    등급의 결정론 입력이라 결제 전에 내려받지 않는다.
//  · 결제(10알)는 여기서 하지 않는다 — wealth/start는 무료 teaser, wealth/analyze에서만 차감.
// 2-경로:
//  · 대표사주 있음(로그인 + from-primary 200) → 지름길(/wealth/input, source:"primary")
//    + 다른 사주로 보기(/wealth/self, source:"self")
//  · 대표사주 없음/신규(비로그인 포함) → 자체입력(/wealth/self)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Coins, Vault, CalendarBlank } from "@phosphor-icons/react";
import Header from "@/components/layout/Header";
import { SkeletonBar } from "@/components/loading";

type FromPrimaryData = {
  hasWealthScore: boolean;
  sourceResultId: string;
};

// 재물운이 실제로 짚어주는 것 — 재물 관점의 원국 해석 3축. 일반 운세 한 줄과 다른 값어치를
// 구체적으로 보여준다(클리셰·제네릭 금지). 명리 근거: 재성(정재·편재), 재를 담는 그릇(신강·신약),
// 세운 타이밍.
const WEALTH_VALUES = [
  {
    Icon: Coins,
    title: "타고난 재물의 결",
    desc: "정재·편재 어느 쪽이 강한지, 꾸준히 버는 결인지 크게 당기는 결인지 봐.",
  },
  {
    Icon: Vault,
    title: "재물을 담는 그릇",
    desc: "그 재물을 감당하는 그릇이 얼마나 되는지, 신강·신약과 재성의 균형으로 짚어.",
  },
  {
    Icon: CalendarBlank,
    title: "재물운이 열리는 때",
    desc: "언제 돈이 붙고, 언제 지출·투자를 조심해야 하는지 시기를 짚어.",
  },
] as const;

// 재물운으로 무엇을 봐주는지 — 모든 정상 상태에서 공통 노출(설명 열람은 비로그인도 가능).
function AboutCard({ hasWealthScore }: { hasWealthScore?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="space-y-5">
        {WEALTH_VALUES.map(({ Icon, title, desc }) => (
          <div key={title} className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Icon size={22} weight="duotone" className="text-primary" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[16px] font-bold leading-snug text-text-primary break-keep">
                {title}
              </h3>
              <p className="mt-1 text-[14px] leading-relaxed text-text-secondary break-keep">
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-background-secondary border border-white/5 px-5 py-4 space-y-2">
        <p className="text-[13px] leading-relaxed text-text-tertiary break-keep">
          가벼운 운세 한 줄이 아니야. 사주 원국을 그대로 계산한 뒤,{" "}
          <span className="font-medium text-text-secondary">재물 관점만 따로 깊이</span> 풀어줘.
        </p>
        {hasWealthScore && (
          <p className="text-[13px] leading-relaxed text-text-tertiary break-keep">
            지난 분석에서 재물운은 이미 나와 있지. 그{" "}
            <span className="font-medium text-text-secondary">결과 뒤에 있는 이유</span>를 파볼게.
          </p>
        )}
      </div>
    </div>
  );
}

export default function WealthEntryClient() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [primary, setPrimary] = useState<FromPrimaryData | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      // 비로그인 — 대표사주 조회 없이 자체입력 경로 안내로 바로 진입.
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
          // 대표사주 없음 — 에러가 아니라 자체입력으로 안내할 정상 상태.
          setPrimary(null);
        } else if (!res.ok) {
          setPrimaryError(data?.error || "재물운 정보를 못 불러왔어.");
        } else {
          setPrimary({
            hasWealthScore: data?.hasWealthScore === true,
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
  }, [status, isAuthenticated]);

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

          {status === "loading" || primaryLoading ? (
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
          ) : primary ? (
            // 대표사주 있음 — 지름길(primary) + 다른 사주로 보기(self)
            <>
              <AboutCard hasWealthScore={primary.hasWealthScore} />
              <div className="px-1 space-y-3">
                <button
                  onClick={() => router.push("/wealth/input")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  내 사주로 재물운 보기
                </button>
                <button
                  onClick={() => router.push("/wealth/self")}
                  className="btn-secondary w-full h-[48px] rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform"
                >
                  다른 사주로 보기
                </button>
              </div>
            </>
          ) : (
            // 대표사주 없음/신규(비로그인 포함) — 자체입력 경로
            <>
              <AboutCard />
              <div className="px-1">
                <button
                  onClick={() => router.push("/wealth/self")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  생년월일 넣고 재물운 보기
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
