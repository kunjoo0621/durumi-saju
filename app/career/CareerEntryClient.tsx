"use client";

// 커리어운 심층 검사 진입 화면 — app/wealth/WealthEntryClient.tsx 2-경로 패턴 미러.
//  · 로그인 강제 없음(app/career/page.tsx가 requireSession 미적용) — 비로그인도 진입해 설명을 보고
//    자체입력 경로로 들어갈 수 있다. 로그인은 SajuInputFlow 제출 시점에만.
//  · 대표사주 응답에서 읽는 값은 careerScore(개인사주 직장운 점수).
//  · 결제(10알)는 여기서 하지 않는다 — career/start는 무료 teaser, career/analyze에서만 차감.
// 2-경로: 대표사주 있음 → 지름길(/career/input, primary) + 다른 사주(/career/self, self) /
//         대표사주 없음(비로그인 포함) → 자체입력(/career/self)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Briefcase, Ladder, CalendarBlank } from "@phosphor-icons/react";
import Header from "@/components/layout/Header";
import { SkeletonBar } from "@/components/loading";

type FromPrimaryData = {
  careerScore: number;
  sourceResultId: string;
};

// 커리어운이 실제로 짚어주는 것 — 직업 관점의 원국 해석 3축(클리셰·제네릭 금지).
// 명리 근거: 관성(정관·편관), 관을 담는 그릇(신강·신약), 세운 타이밍.
const CAREER_VALUES = [
  {
    Icon: Briefcase,
    title: "타고난 커리어의 결",
    desc: "정관·편관 어느 쪽이 강한지, 조직에서 안정적으로 크는 결인지 돌파·독립하는 결인지 봐.",
  },
  {
    Icon: Ladder,
    title: "자리를 감당하는 그릇",
    desc: "책임·직위를 감당하는 힘이 얼마나 되는지, 신강·신약과 관성의 균형으로 짚어.",
  },
  {
    Icon: CalendarBlank,
    title: "자리가 열리는 때",
    desc: "언제 승진·이직·독립의 문이 열리고, 언제 한 템포 다져야 하는지 시기를 짚어.",
  },
] as const;

// 커리어운으로 무엇을 봐주는지 — 모든 정상 상태에서 공통 노출(설명 열람은 비로그인도 가능).
function AboutCard({ careerScore }: { careerScore?: number }) {
  return (
    <div className="space-y-5">
      <div className="space-y-5">
        {CAREER_VALUES.map(({ Icon, title, desc }) => (
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
          <span className="font-medium text-text-secondary">직업·자리 관점만 따로 깊이</span> 풀어줘.
        </p>
        {typeof careerScore === "number" && careerScore > 0 && (
          <p className="text-[13px] leading-relaxed text-text-tertiary break-keep">
            지난 분석에서 직장운{" "}
            <span className="font-medium text-text-secondary">{careerScore}점</span>이 나왔지. 그
            점수 뒤에 있는 이유를 파볼게.
          </p>
        )}
      </div>
    </div>
  );
}

export default function CareerEntryClient() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [primary, setPrimary] = useState<FromPrimaryData | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      setPrimaryLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/career/from-primary");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setPrimary(null);
        } else if (!res.ok) {
          setPrimaryError(data?.error || "커리어운 정보를 못 불러왔어.");
        } else {
          setPrimary({
            careerScore: typeof data?.careerScore === "number" ? data.careerScore : 0,
            sourceResultId: data?.sourceResultId || "",
          });
        }
      } catch {
        if (!cancelled) setPrimaryError("커리어운 정보를 못 불러왔어.");
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
              커리어운 심층 검사
            </h1>
            <p className="text-body-2 text-text-secondary">
              같은 사주를 관성까지 더 깊이 들여다봐.
              <br />
              어떤 그릇으로 어느 길을 가야 하는지 그 결을 짚어줄게.
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
            <>
              <AboutCard careerScore={primary.careerScore} />
              <div className="px-1 space-y-3">
                <button
                  onClick={() => router.push("/career/input")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  내 사주로 커리어운 보기
                </button>
                <button
                  onClick={() => router.push("/career/self")}
                  className="btn-secondary w-full h-[48px] rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform"
                >
                  다른 사주로 보기
                </button>
              </div>
            </>
          ) : (
            <>
              <AboutCard />
              <div className="px-1">
                <button
                  onClick={() => router.push("/career/self")}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  생년월일 넣고 커리어운 보기
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
