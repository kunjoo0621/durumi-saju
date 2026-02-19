"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MenuDrawer from "../MenuDrawer";

export default function MenuPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isBattleDisabled = false;
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);

  const handleSajuClick = async () => {
    if (checking) return;
    setChecking(true);
    setCheckError(false);
    try {
      const res = await fetch("/api/results");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length > 0) {
        router.push("/my/results");
      } else {
        router.push("/start");
      }
    } catch {
      setChecking(false);
      setCheckError(true);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] flex items-center justify-center px-5">
        <div className="max-w-[640px] mx-auto w-full text-center text-[14px] text-zinc-400">
          로그인 확인 중...
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] text-white flex flex-col">
      <header className="sticky top-0 z-[100] bg-[rgb(var(--c-dark-bg))] px-5 py-5 border-b border-white/5">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 font-aggro text-white">메뉴 선택</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-12">
        <section className="max-w-[640px] mx-auto pt-10 space-y-4">
          <button
            type="button"
            onClick={handleSajuClick}
            disabled={checking}
            className={[
              "w-full rounded-2xl border border-white/10 bg-zinc-900 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              checking ? "opacity-70 cursor-wait" : "group hover:bg-zinc-800",
            ].join(" ")}
          >
            <div className="px-5 py-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/60">
                  {checking ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-white"
                    >
                      <path
                        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 7.5v9"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8.5 10.25h7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[18px] leading-tight font-aggro text-white">
                      {checking ? "내 사주 내역 확인 중…" : "내 사주 보러가기"}
                    </div>
                    <span className={[
                      "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200",
                      checking ? "border border-white/10 bg-zinc-800/40" : "btn-primary group-hover:translate-x-0.5",
                    ].join(" ")}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="text-white"
                      >
                        <path
                          d="M9 18l6-6-6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>

                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                    <span className="block">1,000원으로 내 사주 등급을 확인해요.</span>
                    <span className="block">근거 + 2주 행동팁까지 한 번에 받아요.</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                      등급
                    </span>
                    <span className="rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                      근거
                    </span>
                    <span className="rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                      2주 행동팁
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </button>

          {checkError && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900 px-5 py-5 space-y-4">
              <p className="text-[15px] text-zinc-300">
                내 사주 내역을 불러오지 못했어요. 다시 시도할까요?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSajuClick}
                  className="flex-1 h-11 rounded-xl bg-primary text-white text-[14px] font-semibold"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/start")}
                  className="flex-1 h-11 rounded-xl border border-white/10 bg-zinc-800 text-zinc-300 text-[14px] font-semibold"
                >
                  새로 사주 보기
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={isBattleDisabled}
            onClick={() => {
              if (isBattleDisabled) return;
              router.push("/battle");
            }}
            className={[
              "w-full rounded-2xl border border-white/10 bg-zinc-900 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isBattleDisabled ? "cursor-not-allowed opacity-55" : "group hover:bg-zinc-800",
            ].join(" ")}
          >
            <div className="relative px-5 py-6">
              {isBattleDisabled && (
                <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                  준비 중
                </div>
              )}
              <div className="flex items-start gap-4">
                <div
                  className={[
                    "mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10",
                    isBattleDisabled ? "bg-zinc-800/30" : "bg-zinc-800/60",
                  ].join(" ")}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className="text-white"
                  >
                    <path
                      d="M7 7h10v10H7V7z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.5 9.5h5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.5 12h2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.5 14.5h4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[18px] leading-tight font-aggro text-white">
                      1:1 사주배틀
                    </div>
                    <span
                      className={[
                        "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200",
                        isBattleDisabled
                          ? "border border-white/10 bg-zinc-800/40 text-zinc-400"
                          : "btn-primary group-hover:translate-x-0.5",
                      ].join(" ")}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className={isBattleDisabled ? "text-zinc-400" : "text-white"}
                      >
                        <path
                          d="M9 18l6-6-6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>

                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                    <span className="block">2,000원으로 누가 더 좋은 사주인지 대결해요.</span>
                    <span className="block">결과는 등급으로 깔끔하게 정리해요.</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                      비교
                    </span>
                    <span className="rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                      대결
                    </span>
                    <span className="rounded-full border border-white/10 bg-[rgb(var(--c-dark-bg))] px-3 py-1 text-[12px] text-zinc-400">
                      결과표
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
}
