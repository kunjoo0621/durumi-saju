"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MenuDrawer from "../MenuDrawer";

export default function MenuPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
        <div className="text-text-secondary text-[14px]">로그인 확인 중...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <header className="sticky top-0 z-[100] bg-background-primary px-5 py-5">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 font-aggro">메뉴 선택</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-12">
        <section className="max-w-xl mx-auto pt-12 space-y-5">
          <button
            type="button"
            onClick={() => router.push("/my/results")}
            className="group w-full overflow-hidden rounded-2xl border border-white/10 bg-background-secondary/60 text-left transition-all duration-200 hover:border-white/20 hover:bg-background-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="relative h-[160px] w-full overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(var(--primary),0.35)_0%,rgba(var(--primary),0.08)_42%,transparent_70%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(255,255,255,0.12)_0%,transparent_55%)]" />
              <div className="absolute inset-0 opacity-60 blur-2xl bg-[conic-gradient(from_200deg_at_30%_40%,rgba(var(--primary),0.25),transparent_35%,rgba(255,255,255,0.12),transparent_70%)]" />
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className="text-[18px] font-semibold">내 사주 보러가기</div>
              <p className="text-[14px] leading-relaxed text-text-secondary">
                <span className="block">1,000원으로 내 사주 등급을 확인해요.</span>
                <span className="block">근거 + 2주 행동팁까지 한 번에 받아요.</span>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full border border-white/10 bg-background-primary/70 px-3 py-1 text-[12px] text-text-secondary">
                  등급
                </span>
                <span className="rounded-full border border-white/10 bg-background-primary/70 px-3 py-1 text-[12px] text-text-secondary">
                  근거
                </span>
                <span className="rounded-full border border-white/10 bg-background-primary/70 px-3 py-1 text-[12px] text-text-secondary">
                  2주 행동팁
                </span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/battle")}
            className="group w-full overflow-hidden rounded-2xl border border-white/10 bg-background-secondary/60 text-left transition-all duration-200 hover:border-white/20 hover:bg-background-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="relative h-[160px] w-full overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(255,255,255,0.12)_0%,transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(var(--primary),0.3)_0%,rgba(var(--primary),0.1)_45%,transparent_70%)]" />
              <div className="absolute inset-0 opacity-50 blur-2xl bg-[conic-gradient(from_120deg_at_70%_50%,rgba(var(--primary),0.2),transparent_35%,rgba(255,255,255,0.1),transparent_75%)]" />
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className="text-[18px] font-semibold">1:1 사주배틀</div>
              <p className="text-[14px] leading-relaxed text-text-secondary">
                <span className="block">2,000원으로 누가 더 좋은 사주인지 대결해요.</span>
                <span className="block">결과는 등급으로 깔끔하게 정리해요.</span>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full border border-white/10 bg-background-primary/70 px-3 py-1 text-[12px] text-text-secondary">
                  비교
                </span>
                <span className="rounded-full border border-white/10 bg-background-primary/70 px-3 py-1 text-[12px] text-text-secondary">
                  대결
                </span>
                <span className="rounded-full border border-white/10 bg-background-primary/70 px-3 py-1 text-[12px] text-text-secondary">
                  결과표
                </span>
              </div>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
}
