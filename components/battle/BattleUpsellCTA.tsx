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
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => router.push("/start")}
        className="w-full flex items-center justify-between rounded-xl bg-background-secondary px-4 py-3.5 transition-colors hover:bg-white/[0.06] active:bg-white/[0.03]"
      >
        <span className="text-[14px] text-text-primary">{nameA}의 사주 자세히 보기</span>
        <ArrowRight weight="bold" size={16} className="text-text-secondary" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => router.push("/start")}
        className="w-full flex items-center justify-between rounded-xl bg-background-secondary px-4 py-3.5 transition-colors hover:bg-white/[0.06] active:bg-white/[0.03]"
      >
        <span className="text-[14px] text-text-primary">{nameB}의 사주 자세히 보기</span>
        <ArrowRight weight="bold" size={16} className="text-text-secondary" aria-hidden="true" />
      </button>
    </div>
  );
}
