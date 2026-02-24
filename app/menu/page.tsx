"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MenuDrawer from "../MenuDrawer";
import { Sparkle, Sword, CaretRight } from "@phosphor-icons/react";

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
          <h2 className="text-2xl font-aggro text-white text-center">
            {session?.user?.name ? `${session.user.name}아, 뭐 볼 거야?` : '뭐 볼 거야?'}
          </h2>
          <button
            type="button"
            onClick={handleSajuClick}
            disabled={checking}
            className={[
              "w-full p-6 rounded-2xl text-left transition-colors duration-200 cursor-pointer",
              checking ? "opacity-70 cursor-wait" : "active:bg-white/5",
            ].join(" ")}
            style={{ backgroundColor: '#181414' }}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Sparkle weight="duotone" size={24} color="#FF6B6B" />
                <h2 className="font-aggro text-xl text-white font-bold">
                  {checking ? "내 사주 내역 확인 중…" : "내 사주 보러가기"}
                </h2>
              </div>
              <CaretRight weight="bold" size={20} className="text-gray-500 mt-1" />
            </div>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              천원이면 등급부터<br/>행동팁까지 전부 까발려줌
            </p>
            <p className="font-aggro text-lg font-bold mt-4" style={{ color: '#FF6B6B' }}>
              1,000원
            </p>
          </button>

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

          <button
            type="button"
            disabled={isBattleDisabled}
            onClick={() => { if (!isBattleDisabled) router.push("/battle"); }}
            className={[
              "w-full p-6 rounded-2xl text-left transition-colors duration-200 cursor-pointer",
              isBattleDisabled ? "cursor-not-allowed opacity-55" : "active:bg-white/5",
            ].join(" ")}
            style={{ backgroundColor: '#151418' }}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Sword weight="duotone" size={24} color="#A855F7" />
                <h2 className="font-aggro text-xl text-white font-bold">1:1 사주배틀</h2>
              </div>
              <CaretRight weight="bold" size={20} className="text-gray-500 mt-1" />
            </div>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              둘 중 누가 더 좋은 사주인지<br/>등급으로 딱 정리해줌
            </p>
            <p className="font-aggro text-lg font-bold mt-4" style={{ color: '#A855F7' }}>
              2,000원
            </p>
          </button>
        </section>
      </main>
    </div>
  );
}
