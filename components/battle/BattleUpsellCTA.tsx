"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";

type Props = {
  nameA: string;
  nameB: string;
};

export default function BattleUpsellCTA({ nameA, nameB }: Props) {
  const router = useRouter();

  return (
    <div className="rounded-2xl bg-background-secondary p-5">
      <p className="text-[14px] text-text-tertiary mb-4 text-center">
        더 자세한 내 사주가 궁금하다면?
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => router.push("/start")}
          className="w-full flex items-center justify-between rounded-xl bg-background-primary px-4 py-3.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
        >
          <span className="text-[14px] text-text-secondary">{nameA}의 사주 자세히 보기</span>
          <ArrowRight weight="bold" size={16} className="text-text-tertiary" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/start")}
          className="w-full flex items-center justify-between rounded-xl bg-background-primary px-4 py-3.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
        >
          <span className="text-[14px] text-text-secondary">{nameB}의 사주 자세히 보기</span>
          <ArrowRight weight="bold" size={16} className="text-text-tertiary" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
