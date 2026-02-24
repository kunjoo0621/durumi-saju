"use client";

import { useRouter } from "next/navigation";
import MenuDrawer from "../MenuDrawer";
import { useBattleStore } from "@/store/useBattleStore";

export default function BattlePage() {
  const router = useRouter();
  const reset = useBattleStore((s) => s.reset);

  const handleStart = () => {
    reset();
    router.push("/battle/input");
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col animate-fadeIn">
      <header className="sticky top-0 z-[100] bg-[#0D0D0D] px-6 py-5">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="이전 화면"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 font-aggro">1:1 사주배틀</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-6 flex flex-col items-center justify-center">
        <div className="max-w-[640px] mx-auto w-full text-center space-y-6">
          <div className="space-y-3">
            <h2 className="text-[28px] font-aggro leading-tight">
              누가 더 좋은 사주일까?
            </h2>
            <p className="text-[15px] text-text-secondary leading-relaxed">
              두 사람의 사주를 5개 카테고리로 비교해요.<br />
              냉정한 심판 두루미가 판정합니다.
            </p>
          </div>

          <div className="flex justify-center gap-8 py-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 flex items-center justify-center mx-auto">
                <span className="text-[24px]">甲</span>
              </div>
              <p className="mt-2 text-[13px] text-text-tertiary">나</p>
            </div>
            <div className="flex items-center">
              <span className="text-[20px] font-bold text-primary">VS</span>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center mx-auto">
                <span className="text-[24px]">乙</span>
              </div>
              <p className="mt-2 text-[13px] text-text-tertiary">상대</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {["재물운", "연애운", "직장운", "건강운", "대인운"].map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary"
              >
                {cat}
              </span>
            ))}
          </div>

          <p className="text-[13px] text-text-tertiary">2,000원</p>
        </div>
      </main>

      <div className="px-6 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            배틀 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
