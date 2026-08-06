"use client";

// 결혼운/애정운 심층 검사 진입 화면 — app/today/TodayEntryClient.tsx 2-경로 패턴 미러.
// today와의 차이:
//  · 로그인 강제 없음(app/marriage/page.tsx가 requireSession 게이트를 제거) — 비로그인도 진입해
//    설명을 보고 자체입력 경로로 들어갈 수 있다. 로그인은 SajuInputFlow 제출 시점에만.
//  · 결제(10알)는 여기서 하지 않는다 — 관계상태 확인/미리보기는 다음 화면, 결제는 그 이후
//    (marriage/start는 무료 teaser, marriage/analyze에서만 차감).
// 2-경로:
//  · 대표사주 있음(로그인 + from-primary 200) → 지름길(/marriage/input, source:"primary")
//    + 다른 사주로 보기(/marriage/self, source:"self")
//  · 대표사주 없음/신규(비로그인 포함) → 자체입력(/marriage/self)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { HouseLine, Heart, Clock } from "@phosphor-icons/react";
import Header from "@/components/layout/Header";
import { SkeletonBar } from "@/components/loading";

type FromPrimaryData = {
  hasLoveScore: boolean;
  sourceResultId: string;
};

// 결혼운이 실제로 짚어주는 것 — 배우자 관점의 원국 해석 3축. 일반 운세 한 줄과 다른 값어치를
// 구체적으로 보여준다(클리셰·제네릭 금지). 명리 근거: 배우자궁=일지, 배우자성, 세운 타이밍.
const MARRIAGE_VALUES = [
  {
    Icon: HouseLine,
    title: "배우자궁이 지금 어떤 상태인지",
    desc: "타고난 배우자 자리(일지)가 안정적으로 받쳐주는지, 흔들리는지 짚어.",
  },
  {
    Icon: Heart,
    title: "나에게 오는 인연의 결",
    desc: "어떤 사람에게 끌리고, 관계에서 어떤 패턴이 반복되는지 풀어.",
  },
  {
    Icon: Clock,
    title: "인연이 무르익는 때",
    desc: "언제 인연이 강해지고, 언제 한 박자 쉬어야 하는지 시기를 봐.",
  },
] as const;

// 결혼운으로 무엇을 봐주는지 — 모든 정상 상태에서 공통 노출(설명 열람은 비로그인도 가능).
function AboutCard({ hasLoveScore }: { hasLoveScore?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="space-y-5">
        {MARRIAGE_VALUES.map(({ Icon, title, desc }) => (
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
          <span className="font-medium text-text-secondary">배우자 관점만 따로 깊이</span> 풀어줘.
        </p>
        {hasLoveScore && (
          <p className="text-[13px] leading-relaxed text-text-tertiary break-keep">
            지난 분석에서 연애운은 이미 나와 있지. 그{" "}
            <span className="font-medium text-text-secondary">결과 뒤에 있는 이유</span>를 파볼게.
          </p>
        )}
      </div>
    </div>
  );
}

export default function MarriageEntryClient() {
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
        const res = await fetch("/api/marriage/from-primary");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          // 대표사주 없음 — 에러가 아니라 자체입력으로 안내할 정상 상태.
          setPrimary(null);
        } else if (!res.ok) {
          setPrimaryError(data?.error || "결혼운 정보를 못 불러왔어.");
        } else {
          setPrimary({
            hasLoveScore: data?.hasLoveScore === true,
            sourceResultId: data?.sourceResultId || "",
          });
        }
      } catch {
        if (!cancelled) setPrimaryError("결혼운 정보를 못 불러왔어.");
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
              결혼운 · 애정운 심층 검사
            </h1>
            <p className="text-body-2 text-text-secondary">
              같은 사주를 배우자궁까지 더 깊이 들여다봐.
              <br />
              지금 혼자여도, 함께여도, 다시 혼자여도 다 괜찮아.
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
              <AboutCard hasLoveScore={primary.hasLoveScore} />
              <div className="px-1 space-y-3">
                <button
                  onClick={() => router.push("/marriage/input")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  내 사주로 결혼운 보기
                </button>
                <button
                  onClick={() => router.push("/marriage/self")}
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
                  onClick={() => router.push("/marriage/self")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  생년월일 넣고 결혼운 보기
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
