"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Egg } from "@phosphor-icons/react";
import Header from "@/components/layout/Header";
import { useBattleStore } from "@/store/useBattleStore";
import { usePetCompatStore } from "@/store/usePetCompatStore";
import { SAJU_COST, BATTLE_COST, YEARLY_COST, TODAY_COST, PET_COMPAT_COST, MARRIAGE_COST, WEALTH_COST, CAREER_COST } from "@/lib/constants/coins";
import BusinessFooter from "@/components/BusinessFooter";
import { resolveSolarYear } from "@/lib/utils/ipchun";
import { HUB_PRESS } from "@/components/hub/services";

const YEARLY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1";

// 오늘 날짜 라벨 ("5월 24일")
const TODAY_DATE = new Date();
const TODAY_LABEL = `${TODAY_DATE.getMonth() + 1}월 ${TODAY_DATE.getDate()}일`;

// 메뉴 카드 "{N}년 운세" 표기는 yearly 분석과 일관 — 입춘 기준.
const CURRENT_YEAR = resolveSolarYear(new Date()).solarYear;

const THUMB = {
  saju: "/images/hub/saju-grade.webp",
  pet: "/images/hub/pet.webp",
  today: "/images/hub/today.webp",
  battle: "/images/hub/battle.webp",
  yearly: "/images/hub/yearly.webp",
  marriage: "/images/marriage/marriage-poster.webp",
  wealth: "/images/wealth/wealth-poster.webp",
  career: "/images/career/career-poster.webp",
} as const;

function RowThumb({ src }: { src: string }) {
  return (
    <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl bg-background-secondary">
      <Image src={src} alt="" fill sizes="80px" className="object-cover" />
    </div>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const resetBattle = useBattleStore((s) => s.reset);
  const resetPet = usePetCompatStore((s) => s.reset);

  // 로그인 상태면 무조건 통합 "내 결과"(/my/results)로. 결과 0건이어도 튕기지 않고
  // 내 결과 페이지의 빈 상태가 "사주 보러가기" CTA를 처리한다(CS: 결제 후 결과를 못 찾는 문제).
  const handleSajuClick = () => {
    if (!session?.user) {
      router.push("/start");
      return;
    }
    router.push("/my/results");
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-primary px-5">
        <div className="mx-auto w-full max-w-[440px] text-center text-[14px] text-text-tertiary">
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[440px] bg-background-primary text-text-primary">
      {/* glow는 별도 래퍼에서 클리핑 — 메인에 overflow-hidden 두면 sticky 깨짐 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-primary/[0.12] blur-[100px]" />
      </div>

      <Header showBack sticky onBack={() => router.push("/")} />

      <main className="px-5 pb-12 pt-6">
        <div className="mb-5">
          <p className="text-[12px] font-medium text-text-tertiary">알 하나면 충분해요</p>
          <h1 className="font-aggro text-[24px]">무엇을 볼까요?</h1>
        </div>

        <div className="divide-y divide-border">
          {/* 사주 */}
          <button
            type="button"
            onClick={handleSajuClick}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">평생 사주</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">
                내 사주 분석
              </h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                타고난 기질과 운의 흐름을 5가지 운으로 풀어봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {SAJU_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.saju} />
          </button>

          {/* 올해 (FEATURE_FLAG) */}
          {YEARLY_ENABLED && (
            <button
              type="button"
              onClick={() => router.push("/yearly")}
              className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
            >
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-text-secondary">{CURRENT_YEAR}년</span>
                <h3 className="mt-0.5 text-[18px] font-bold leading-tight">올해 운세</h3>
                <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                  올해 남은 흐름을 월별로 미리 봐요
                </p>
                <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                  <Egg size={15} weight="fill" className="shrink-0" />
                  {YEARLY_COST}알
                </p>
              </div>
              <RowThumb src={THUMB.yearly} />
            </button>
          )}

          {/* 배틀 */}
          <button
            type="button"
            onClick={() => {
              resetBattle();
              router.push("/battle/input");
            }}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">둘이서</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">사주 배틀</h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                두 사람 사주를 나란히 놓고 궁합을 겨뤄봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {BATTLE_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.battle} />
          </button>

          {/* 결혼운·애정운 (NEW · 심층) — 사주 옆 그룹핑, 최종 배치는 운영자 결정(§7-3) */}
          <button
            type="button"
            onClick={() => router.push("/marriage")}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">심층 풀이</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">결혼운·애정운</h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                배우자궁까지 깊이 들여다보고 인연이 강해지는 때를 짚어봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {MARRIAGE_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.marriage} />
          </button>

          {/* 재물운 (NEW · 심층) */}
          <button
            type="button"
            onClick={() => router.push("/wealth")}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">심층 풀이</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">재물운</h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                돈이 붙는 시기와 내 재물 그릇까지 깊이 봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {WEALTH_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.wealth} />
          </button>

          {/* 커리어운 (NEW · 심층) */}
          <button
            type="button"
            onClick={() => router.push("/career")}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">심층 풀이</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">커리어운</h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                조직형인지 독립형인지, 자리가 열리는 때까지 깊이 봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {CAREER_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.career} />
          </button>

          {/* 펫 (NEW) */}
          <button
            type="button"
            onClick={() => {
              resetPet();
              router.push("/pet/input");
            }}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">반려동물 궁합</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">우리 아이와 궁합</h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                우리 아이와 나, 얼마나 잘 맞는지 봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {PET_COMPAT_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.pet} />
          </button>

          {/* 오늘 */}
          <button
            type="button"
            onClick={() => router.push("/today")}
            className={`${HUB_PRESS} flex w-full items-center gap-4 py-4 text-left`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-text-secondary">{TODAY_LABEL}</span>
              <h3 className="mt-0.5 text-[18px] font-bold leading-tight">오늘의 운세</h3>
              <p className="mt-1 break-keep text-[13px] leading-snug text-text-secondary">
                오늘 일진과 내 사주가 만나는 지점을 짚어봐요
              </p>
              <p className="mt-2 flex items-center gap-1 text-[15px] font-bold">
                <Egg size={15} weight="fill" className="shrink-0" />
                {TODAY_COST}알
              </p>
            </div>
            <RowThumb src={THUMB.today} />
          </button>
        </div>
      </main>

      <BusinessFooter />
    </div>
  );
}
