"use client";

import { useRouter } from "next/navigation";

type Props = {
  nameA: string;
  nameB: string;
};

export default function BattleUpsellCTA({ nameA, nameB }: Props) {
  const router = useRouter();

  return (
    <div className="rounded-2xl bg-background-secondary p-5">
      <p className="text-[14px] text-text-secondary mb-4 text-center">
        내 사주 더 자세히 보고 싶다면?
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => router.push("/start")}
          className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-text-primary border border-white/10 bg-background-primary hover:bg-white/[0.04] transition-colors"
        >
          {nameA}의 사주 보기
        </button>
        <button
          type="button"
          onClick={() => router.push("/start")}
          className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-text-primary border border-white/10 bg-background-primary hover:bg-white/[0.04] transition-colors"
        >
          {nameB}의 사주 보기
        </button>
      </div>
    </div>
  );
}
