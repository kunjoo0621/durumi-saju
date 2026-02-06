"use client";

import { useRouter } from "next/navigation";
import MenuDrawer from "../MenuDrawer";

export default function BattlePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <header className="sticky top-0 z-[100] bg-background-primary px-5 py-5">
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

      <main className="flex-1 px-5 flex items-center">
        <div className="max-w-[640px] mx-auto w-full bg-background-secondary rounded-2xl p-5 text-center">
          <p className="text-[15px] text-text-secondary">준비 중인 기능입니다.</p>
        </div>
      </main>
    </div>
  );
}
