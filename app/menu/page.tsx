"use client";

import { useState } from "react";
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
    if (!session?.user) {
      router.push("/start");
      return;
    }
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] flex items-center justify-center px-5">
        <div className="max-w-[640px] mx-auto w-full text-center text-[14px] text-zinc-400">
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] text-white flex flex-col">
      <header className="px-6 py-5 sticky top-0 z-[100] bg-[#0D0D0D]">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-zinc-800/40 transition-colors"
            aria-label="이전 화면"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 text-text-primary font-aggro">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-12">
        <section className="max-w-[640px] mx-auto pt-10 space-y-4">
          {/* 사주 카드 */}
          <div
            className="group relative bg-[#141414] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-pointer active:scale-[0.97] transition-transform duration-200 animate-[slideUp_0.5s_ease-out_both]"
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={handleSajuClick}
            role="button"
            tabIndex={0}
          >
            <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full blur-[60px] z-[1] pointer-events-none"
              style={{ background: 'rgba(255,107,107,0.08)' }} />

            <div className="relative z-[2] flex-1 min-w-0">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold mb-3"
                style={{ background: 'rgba(255,107,107,0.08)', color: '#FF6B6B' }}>
                개인 분석
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {checking ? "내 사주 내역 확인 중…" : "내 사주 보러가기"}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed mt-2">
                등급부터 운세 흐름까지<br/>낱낱이 해부해줄게
              </p>
              <p className="text-lg font-bold mt-3.5" style={{ color: '#FF6B6B' }}>
                1,000원
              </p>
            </div>

            <div className="relative z-[2] w-[120px] h-[120px] shrink-0 ml-2 flex items-center justify-center">
              <svg className="w-[112px] h-[112px] transition-transform duration-300 group-active:scale-110 group-active:-rotate-2" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} viewBox="0 0 96 96" fill="none">
                <ellipse cx="48" cy="82" rx="20" ry="4" fill="#FF6B6B" fillOpacity="0.1"/>
                <circle cx="48" cy="40" r="28" fill="#FF6B6B" fillOpacity="0.15"/>
                <circle cx="48" cy="40" r="28" stroke="#FF6B6B" strokeOpacity="0.45" strokeWidth="2.5"/>
                <ellipse cx="39" cy="29" rx="9" ry="5.5" fill="white" fillOpacity="0.12" transform="rotate(-20, 39, 29)"/>
                <path d="M48 26l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#FF6B6B" fillOpacity="0.6"/>
                <circle cx="37" cy="43" r="2.5" fill="#FF6B6B" fillOpacity="0.5"/>
                <circle cx="59" cy="35" r="2" fill="#FF6B6B" fillOpacity="0.45"/>
                <circle cx="53" cy="50" r="2" fill="#FF6B6B" fillOpacity="0.35"/>
                <path d="M37 70v-2a11 11 0 0 1 22 0v2" fill="#FF6B6B" fillOpacity="0.12" stroke="#FF6B6B" strokeOpacity="0.25" strokeWidth="2"/>
                <rect x="32" y="70" width="32" height="7" rx="3.5" fill="#FF6B6B" fillOpacity="0.2" stroke="#FF6B6B" strokeOpacity="0.3" strokeWidth="2"/>
                <circle cx="80" cy="20" r="3" fill="#FF6B6B" fillOpacity="0.5"/>
                <circle cx="18" cy="52" r="2.5" fill="#FF6B6B" fillOpacity="0.3"/>
                <path d="M74 50l1.2 3.5 3.5 1.2-3.5 1.2-1.2 3.5-1.2-3.5-3.5-1.2 3.5-1.2z" fill="#FF6B6B" fillOpacity="0.35"/>
                <path d="M22 22l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#FF6B6B" fillOpacity="0.25"/>
              </svg>
            </div>
          </div>

          {checkError && (
            <div className="rounded-2xl bg-zinc-900 px-5 py-5 space-y-4">
              <p className="text-[15px] text-zinc-300">
                내 사주 내역을 불러오지 못했어. 다시 시도할까?
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
                  className="flex-1 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-[14px] font-semibold"
                >
                  새로 사주 보기
                </button>
              </div>
            </div>
          )}

          {/* 배틀 카드 */}
          <div
            className={[
              "group relative bg-[#141414] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-pointer active:scale-[0.97] transition-transform duration-200 animate-[slideUp_0.5s_ease-out_0.1s_both]",
              isBattleDisabled ? "cursor-not-allowed opacity-55" : "",
            ].join(" ")}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={() => { if (!isBattleDisabled) router.push("/battle"); }}
            role="button"
            tabIndex={0}
          >
            <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full blur-[60px] z-[1] pointer-events-none"
              style={{ background: 'rgba(168,85,247,0.08)' }} />

            <div className="relative z-[2] flex-1 min-w-0">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold mb-3"
                style={{ background: 'rgba(168,85,247,0.08)', color: '#A855F7' }}>
                1:1 대결
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">사주 배틀 하러가기</h3>
              <p className="text-sm text-gray-400 leading-relaxed mt-2">
                둘 다 입력하면 5판 승부로<br/>판정해줄게
              </p>
              <p className="text-lg font-bold mt-3.5" style={{ color: '#A855F7' }}>
                2,000원
              </p>
            </div>

            <div className="relative z-[2] w-[120px] h-[120px] shrink-0 ml-2 flex items-center justify-center">
              <svg className="w-[112px] h-[112px] transition-transform duration-300 group-active:scale-110 group-active:-rotate-2" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} viewBox="0 0 96 96" fill="none">
                <path d="M48 8L80 22V50C80 68 48 88 48 88S16 68 16 50V22L48 8Z" fill="#A855F7" fillOpacity="0.15" stroke="#A855F7" strokeOpacity="0.5" strokeWidth="2.5" strokeLinejoin="round"/>
                <line x1="48" y1="22" x2="48" y2="76" stroke="#A855F7" strokeOpacity="0.3" strokeWidth="2"/>
                <circle cx="34" cy="36" r="5.5" fill="#A855F7" fillOpacity="0.35" stroke="#A855F7" strokeOpacity="0.45" strokeWidth="1.5"/>
                <path d="M25 55a9 9 0 0 1 18 0" fill="#A855F7" fillOpacity="0.2" stroke="#A855F7" strokeOpacity="0.3" strokeWidth="1.5"/>
                <circle cx="62" cy="36" r="5.5" fill="#A855F7" fillOpacity="0.35" stroke="#A855F7" strokeOpacity="0.45" strokeWidth="1.5"/>
                <path d="M53 55a9 9 0 0 1 18 0" fill="#A855F7" fillOpacity="0.2" stroke="#A855F7" strokeOpacity="0.3" strokeWidth="1.5"/>
                <text x="48" y="73" textAnchor="middle" fill="#A855F7" fillOpacity="0.7" fontSize="13" fontWeight="900" fontFamily="Pretendard">VS</text>
                <path d="M48 0l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#A855F7" fillOpacity="0.55"/>
                <circle cx="10" cy="40" r="2" fill="#A855F7" fillOpacity="0.3"/>
                <circle cx="86" cy="36" r="2.5" fill="#A855F7" fillOpacity="0.25"/>
              </svg>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
