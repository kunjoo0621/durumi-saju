"use client";

// ② "두루미가 봐드릴게요" — 서비스 가로 캐러셀. 포스터 이미지 썸네일(1:1, 캐릭터 크롭 = 제목 제외).
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { Egg } from "@phosphor-icons/react";
import HubSectionHeader from "./HubSectionHeader";
import Reveal from "./Reveal";
import { HUB_PRESS, HUB_SERVICE_THUMB, type HubServiceId } from "./services";
import { useServiceActions } from "./useServiceActions";
import {
  SAJU_COST,
  BATTLE_COST,
  YEARLY_COST,
  TODAY_COST,
  PET_COMPAT_COST,
} from "@/lib/constants/coins";
import { resolveSolarYear } from "@/lib/utils/ipchun";

const YEARLY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1";

interface CardDef {
  id: HubServiceId;
  chip: string;
  title: string;
  desc: string;
  price: ReactNode;
}

export default function ServiceRail() {
  const { run } = useServiceActions();
  const [todayChip, setTodayChip] = useState("오늘");
  const [yearChip, setYearChip] = useState("올해");

  useEffect(() => {
    const now = new Date();
    setTodayChip(`${now.getMonth() + 1}월 ${now.getDate()}일`);
    setYearChip(`${resolveSolarYear(now).solarYear}년`);
  }, []);

  const egg = <Egg size={14} weight="fill" className="shrink-0" />;

  // 순서: 오늘의 운세 맨 앞(데일리 훅) → 올해·펫(덜 보이던 것) → 사주·배틀. 사주는 히어로에 이미 노출
  const cards: CardDef[] = [
    {
      id: "today",
      chip: todayChip,
      title: "오늘의 운세",
      desc: "오늘 나에게 딱 맞는 하루",
      price: (
        <>
          {egg}
          {TODAY_COST}알
        </>
      ),
    },
    ...(YEARLY_ENABLED
      ? [
          {
            id: "yearly" as const,
            chip: yearChip,
            title: "올해 운세",
            desc: "올해 나에게 무슨 일이",
            price: (
              <>
                {egg}
                {YEARLY_COST}알
              </>
            ),
          },
        ]
      : []),
    {
      id: "pet",
      chip: "반려동물 궁합",
      title: "우리 아이와 궁합",
      desc: "우리 아인 날 어떻게 볼까",
      price: (
        <>
          {egg}
          {PET_COMPAT_COST}알
        </>
      ),
    },
    {
      id: "saju",
      chip: "평생 사주",
      title: "내 사주 분석",
      desc: "타고난 기질과 운의 흐름",
      price: (
        <>
          {egg}
          {SAJU_COST}알
        </>
      ),
    },
    {
      id: "battle",
      chip: "둘이서",
      title: "사주 배틀",
      desc: "누가 더 셀까, 사주 맞대결",
      price: (
        <>
          {egg}
          {BATTLE_COST}알
        </>
      ),
    },
  ];

  return (
    <section className="pt-10">
      <Reveal>
        <HubSectionHeader eyebrow="알 하나면 충분해요" title="두루미가 봐드릴게요" />
      </Reveal>
      <div
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
        style={{ scrollPaddingLeft: 20 }}
      >
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => run(c.id)}
            aria-label={c.title}
            className={`${HUB_PRESS} snap-start w-[150px] shrink-0 text-left`}
          >
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.04] bg-background-secondary">
              <Image
                src={HUB_SERVICE_THUMB[c.id]}
                alt=""
                fill
                sizes="150px"
                className="object-cover object-bottom"
              />
            </div>
            <span className="text-[11px] font-semibold text-text-secondary">{c.chip}</span>
            <h3 className="text-[16px] font-bold leading-tight">{c.title}</h3>
            <p className="mt-1 line-clamp-1 break-keep text-[12px] leading-snug text-text-tertiary">
              {c.desc}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[14px] font-bold">{c.price}</p>
          </button>
        ))}
        <div className="w-1 shrink-0" />
      </div>
    </section>
  );
}
