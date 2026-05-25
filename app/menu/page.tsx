"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Egg } from "@phosphor-icons/react";
import Header from "@/components/layout/Header";
import { useBattleStore } from "@/store/useBattleStore";
import { SAJU_COST, BATTLE_COST, YEARLY_COST, TODAY_COST } from "@/lib/constants/coins";
import BusinessFooter from "@/components/BusinessFooter";
import { resolveSolarYear } from "@/lib/utils/ipchun";

const YEARLY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1";

// 오늘 날짜 라벨 ("5월 24일")
const TODAY_DATE = new Date();
const TODAY_LABEL = `${TODAY_DATE.getMonth() + 1}월 ${TODAY_DATE.getDate()}일`;

// 메뉴 카드 "{N}년 내 운세" 표기는 yearly 분석과 일관되어야 함 — 입춘 기준.
// 그레고리력 1/1~입춘 전 사이에는 전년도 세운이 적용되므로 메뉴도 동일 표기.
const CURRENT_YEAR = resolveSolarYear(new Date()).solarYear;

export default function MenuPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isBattleDisabled = false;
  const resetBattle = useBattleStore((s) => s.reset);
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
      <Header showBack sticky onBack={() => router.push("/")} />

      <main className="flex-1 px-5 pb-12">
        <section className="max-w-[640px] mx-auto pt-10 space-y-4">
          {/* 사주 카드 */}
          <button
            type="button"
            className="group relative bg-[#141414] hover:bg-[#1A1A1A] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-pointer active:scale-[0.97] active:bg-[#111111] transition-[transform,background-color,color] duration-200 animate-[slideUp_0.5s_ease-out_both] w-full text-left"
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={handleSajuClick}
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
              <p className="text-lg font-bold mt-3.5 flex items-center gap-1" style={{ color: '#FF6B6B' }}>
                <Egg size={18} weight="fill" />{SAJU_COST}알
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
                  className="btn-primary flex-1 h-11 rounded-xl text-[14px] font-semibold"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/start")}
                  className="btn-secondary flex-1 h-11 rounded-xl text-[14px] font-semibold"
                >
                  새로 사주 보기
                </button>
              </div>
            </div>
          )}

          {/* 올해의 운세 카드 (FEATURE_FLAG 봉인) */}
          {YEARLY_ENABLED && (
            <button
              type="button"
              className="group relative bg-[#141414] hover:bg-[#1A1A1A] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-pointer active:scale-[0.97] active:bg-[#111111] transition-[transform,background-color,color] duration-200 animate-[slideUp_0.5s_ease-out_0.08s_both] w-full text-left"
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              onClick={() => router.push("/yearly")}
            >
              <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full blur-[60px] z-[1] pointer-events-none"
                style={{ background: 'rgba(245,158,11,0.08)' }} />

              <div className="relative z-[2] flex-1 min-w-0">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold mb-3"
                  style={{ background: 'rgba(245,158,11,0.10)', color: '#F59E0B' }}>
                  세운 풀이
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {CURRENT_YEAR}년 내 운세
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed mt-2">
                  내 사주 위에 올해 세운<br/>한 해 흐름 짚어줄게
                </p>
                <p className="text-lg font-bold mt-3.5 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                  <Egg size={18} weight="fill" />{YEARLY_COST}알
                </p>
              </div>

              <div className="relative z-[2] w-[120px] h-[120px] shrink-0 ml-2 flex items-center justify-center">
                <svg className="w-[112px] h-[112px] transition-transform duration-300 group-active:scale-110 group-active:-rotate-2" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} viewBox="0 0 96 96" fill="none">
                  <ellipse cx="48" cy="84" rx="22" ry="4" fill="#F59E0B" fillOpacity="0.1"/>
                  <circle cx="48" cy="42" r="30" fill="#F59E0B" fillOpacity="0.12" stroke="#F59E0B" strokeOpacity="0.4" strokeWidth="2.5"/>
                  <circle cx="48" cy="42" r="20" fill="#F59E0B" fillOpacity="0.15"/>
                  <path d="M48 22v20l14 8" stroke="#F59E0B" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="48" cy="42" r="2.5" fill="#F59E0B"/>
                  <path d="M48 12l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#F59E0B" fillOpacity="0.6"/>
                  <circle cx="82" cy="20" r="3" fill="#F59E0B" fillOpacity="0.5"/>
                  <circle cx="14" cy="52" r="2.5" fill="#F59E0B" fillOpacity="0.3"/>
                  <path d="M74 56l1.2 3.5 3.5 1.2-3.5 1.2-1.2 3.5-1.2-3.5-3.5-1.2 3.5-1.2z" fill="#F59E0B" fillOpacity="0.35"/>
                </svg>
              </div>
            </button>
          )}

          {/* 오늘의 운세 카드 */}
          <button
              type="button"
              className="group relative bg-[#141414] hover:bg-[#1A1A1A] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-pointer active:scale-[0.97] active:bg-[#111111] transition-[transform,background-color,color] duration-200 animate-[slideUp_0.5s_ease-out_0.09s_both] w-full text-left"
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              onClick={() => router.push("/today")}
            >
              <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full blur-[60px] z-[1] pointer-events-none"
                style={{ background: 'rgba(14,165,233,0.10)' }} />

              <div className="relative z-[2] flex-1 min-w-0">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold mb-3"
                  style={{ background: 'rgba(14,165,233,0.10)', color: '#0EA5E9' }}>
                  일진 풀이
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {TODAY_LABEL} 내 운세
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed mt-2">
                  오늘 일진과 너의 사주가<br/>어디서 만나는지 짚어줄게
                </p>
                <p className="text-lg font-bold mt-3.5 flex items-center gap-1" style={{ color: '#0EA5E9' }}>
                  <Egg size={18} weight="fill" />{TODAY_COST}알
                </p>
              </div>

              <div className="relative z-[2] w-[120px] h-[120px] shrink-0 ml-2 flex items-center justify-center">
                {/* 해 + 햇살 + 구름 + 별·점 — sky blue (사주·yearly 카드 디테일 매칭) */}
                <svg className="w-[112px] h-[112px] transition-transform duration-300 group-active:scale-110 group-active:rotate-2" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} viewBox="0 0 96 96" fill="none">
                  {/* 바닥 그림자 */}
                  <ellipse cx="48" cy="84" rx="22" ry="4" fill="#0EA5E9" fillOpacity="0.1"/>

                  {/* 햇살 8방향 */}
                  <g stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.55">
                    <line x1="48" y1="8" x2="48" y2="16"/>
                    <line x1="48" y1="60" x2="48" y2="68"/>
                    <line x1="20" y1="38" x2="28" y2="38"/>
                    <line x1="68" y1="38" x2="76" y2="38"/>
                    <line x1="28" y1="18" x2="33" y2="23"/>
                    <line x1="63" y1="53" x2="68" y2="58"/>
                    <line x1="28" y1="58" x2="33" y2="53"/>
                    <line x1="63" y1="23" x2="68" y2="18"/>
                  </g>

                  {/* 해 — 큰 원 fill + stroke + 내부 코어 */}
                  <circle cx="48" cy="38" r="14" fill="#0EA5E9" fillOpacity="0.18"/>
                  <circle cx="48" cy="38" r="14" stroke="#0EA5E9" strokeOpacity="0.5" strokeWidth="2.5"/>
                  <circle cx="48" cy="38" r="8" fill="#0EA5E9" fillOpacity="0.4"/>

                  {/* 해 하이라이트 */}
                  <ellipse cx="44" cy="33" rx="4" ry="2.5" fill="white" fillOpacity="0.18" transform="rotate(-25, 44, 33)"/>

                  {/* 구름 — 해 아래 살짝 가림 */}
                  <path d="M30 70c-4 0-7 2.5-7 5.5s3 5.5 7 5.5h32c4 0 7-2.5 7-5.5s-3-5.5-7-5.5c-1.5-4.5-6-7-11-7s-9.5 2.5-10.5 7z" fill="#0EA5E9" fillOpacity="0.25"/>
                  <path d="M30 70c-4 0-7 2.5-7 5.5s3 5.5 7 5.5h32c4 0 7-2.5 7-5.5s-3-5.5-7-5.5c-1.5-4.5-6-7-11-7s-9.5 2.5-10.5 7z" stroke="#0EA5E9" strokeOpacity="0.5" strokeWidth="1.8" fill="none"/>

                  {/* 별·점 장식 외곽 */}
                  <path d="M80 18l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#0EA5E9" fillOpacity="0.55"/>
                  <circle cx="18" cy="22" r="2.5" fill="#0EA5E9" fillOpacity="0.45"/>
                  <circle cx="84" cy="56" r="2" fill="#0EA5E9" fillOpacity="0.35"/>
                  <path d="M14 56l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#0EA5E9" fillOpacity="0.3"/>
                </svg>
              </div>
          </button>

          {/* 배틀 카드 */}
          <button
            type="button"
            disabled={isBattleDisabled}
            className={[
              "group relative bg-[#141414] hover:bg-[#1A1A1A] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-pointer active:scale-[0.97] active:bg-[#111111] transition-[transform,background-color,color] duration-200 animate-[slideUp_0.5s_ease-out_0.1s_both] w-full text-left",
              isBattleDisabled ? "cursor-not-allowed opacity-55" : "",
            ].join(" ")}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={() => { resetBattle(); router.push("/battle/input"); }}
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
              <p className="text-lg font-bold mt-3.5 flex items-center gap-1" style={{ color: '#A855F7' }}>
                <Egg size={18} weight="fill" />{BATTLE_COST}알
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
          </button>

          {/* 반려동물 궁합 카드 (준비중) */}
          <button
            type="button"
            disabled
            className="group relative bg-[#141414] rounded-2xl py-7 pl-8 pr-4 flex items-center overflow-hidden cursor-not-allowed opacity-55 transition-opacity duration-200 animate-[slideUp_0.5s_ease-out_0.2s_both] w-full text-left"
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full blur-[60px] z-[1] pointer-events-none"
              style={{ background: 'rgba(52,211,153,0.08)' }} />

            <div className="relative z-[2] flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ background: 'rgba(52,211,153,0.08)', color: '#34D399' }}>
                  반려동물 궁합
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ background: 'rgba(161,161,170,0.08)', color: '#A1A1AA' }}>
                  준비중
                </span>
              </div>
              <h3 className="text-xl font-bold text-zinc-400 tracking-tight">반려동물 궁합 보기</h3>
              <p className="text-sm text-gray-400 leading-relaxed mt-2">
                우리 아이와 나의 사주<br/>궁합을 분석해줄게
              </p>
              <p className="text-lg font-bold mt-3.5 text-zinc-600">
                준비중..
              </p>
            </div>

            <div className="relative z-[2] w-[120px] h-[120px] shrink-0 ml-2 flex items-center justify-center">
              <svg className="w-[104px] h-[104px] transition-transform duration-300" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} viewBox="0 0 96 96" fill="none">
                <ellipse cx="48" cy="90" rx="24" ry="4" fill="#34D399" fillOpacity="0.1"/>
                {/* 메인 하트 */}
                <path d="M48 84C44 78 8 56 8 32c0-14 10-24 22-24 8 0 14 4 18 10 4-6 10-10 18-10 12 0 22 10 22 24 0 24-36 46-40 52z" fill="#34D399" fillOpacity="0.15"/>
                <path d="M48 84C44 78 8 56 8 32c0-14 10-24 22-24 8 0 14 4 18 10 4-6 10-10 18-10 12 0 22 10 22 24 0 24-36 46-40 52z" stroke="#34D399" strokeOpacity="0.45" strokeWidth="2.5" strokeLinejoin="round"/>
                <ellipse cx="30" cy="28" rx="11" ry="6.5" fill="white" fillOpacity="0.12" transform="rotate(-25, 30, 28)"/>
                {/* 하트 안 발바닥 */}
                <ellipse cx="48" cy="46" rx="10" ry="9" fill="#34D399" fillOpacity="0.3"/>
                <circle cx="40" cy="33" r="4.5" fill="#34D399" fillOpacity="0.35"/>
                <circle cx="56" cy="33" r="4.5" fill="#34D399" fillOpacity="0.35"/>
                <circle cx="34" cy="42" r="3.5" fill="#34D399" fillOpacity="0.3"/>
                <circle cx="62" cy="42" r="3.5" fill="#34D399" fillOpacity="0.3"/>
                {/* 별/반짝이 장식 */}
                <path d="M48 16l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#34D399" fillOpacity="0.6"/>
                <circle cx="82" cy="16" r="3" fill="#34D399" fillOpacity="0.5"/>
                <circle cx="14" cy="54" r="2.5" fill="#34D399" fillOpacity="0.3"/>
                <path d="M78 56l1.2 3.5 3.5 1.2-3.5 1.2-1.2 3.5-1.2-3.5-3.5-1.2 3.5-1.2z" fill="#34D399" fillOpacity="0.35"/>
                <path d="M18 18l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#34D399" fillOpacity="0.25"/>
              </svg>
            </div>
          </button>
        </section>
      </main>

      <BusinessFooter />
    </div>
  );
}
