"use client";

import dynamic from "next/dynamic";
import type { SajuData } from "@/lib/utils/saju";
import type { EnrichedSajuData } from "@/lib/utils/saju-enrichment";
import type { CelebritySajuInfo } from "@/lib/stories/types";
import { formatCelebrityBirthMeta } from "@/lib/stories/celebrity";

/**
 * SajuChart·ShinsalBadges는 무거운 클라이언트 컴포넌트라 매거진 전체 청크에 들어가면
 * 비-연예인 글의 First Load JS가 ~280kB 더 커진다.
 * 이 카드 안에서만 dynamic으로 로드해 청크 분리.
 */
const SajuChart = dynamic(() => import("@/components/saju/SajuChart"), {
  ssr: true,
  loading: () => (
    <div className="h-[280px] rounded-xl bg-white/[0.03] animate-pulse" />
  ),
});

const ShinsalBadges = dynamic(
  () => import("@/components/saju/ShinsalBadges"),
  { ssr: true },
);

interface Props {
  celebrity: CelebritySajuInfo;
  sajuData: SajuData;
  /** 십성·신살 풍부 데이터. 없으면 기본 차트만. */
  enriched: EnrichedSajuData | null;
  /**
   * birthTime이 없을 때 true. 차트의 시주 컬럼을 시각적으로 마스킹
   * (12:00 fallback 값이 사실로 보이지 않게).
   */
  hourUnknown: boolean;
}

/**
 * 연예인 글 본문 상단의 사주 원국 카드.
 * - 상단: 강조 면책 노트 (출처·생시 미상·단정 아님)
 * - 메타: 이름·직업·일주·생년월일
 * - SajuChart (dynamic): 결과 페이지와 동일 시각
 * - hourUnknown=true 시: 시주 컬럼 어둡게 + "시 미상" 오버레이
 */
export default function CelebritySajuCard({
  celebrity,
  sajuData,
  enriched,
  hourUnknown,
}: Props) {
  return (
    <section
      aria-label={`${celebrity.name} 사주 원국`}
      className="mb-10 rounded-2xl border border-white/[0.08] bg-background-secondary px-4 sm:px-5 py-5 sm:py-6"
    >
      {/* 상단 강조 면책 — 글 시작 전 사용자 인식에 박힘 */}
      <div className="mb-5 flex items-start gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-3">
        <span
          className="text-[11px] tracking-[0.18em] font-semibold text-[#E8A53D] uppercase shrink-0 mt-px"
          aria-hidden="true"
        >
          NOTE
        </span>
        <p
          className="text-[12px] leading-[1.55] text-text-secondary"
          style={{ wordBreak: "keep-all" }}
        >
          공개 프로필 기준 명리학적 풀이입니다. {hourUnknown ? "생시 미상이라 시주는 추정값이에요. " : ""}
          본인의 실제 성격·미래를 단정하는 글이 아닙니다.
        </p>
      </div>

      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mb-1">
            사주 원국
          </div>
          <h2
            className="text-[18px] sm:text-[20px] font-aggro text-text-primary leading-[1.3]"
            style={{ wordBreak: "keep-all" }}
          >
            {celebrity.name}
            {celebrity.occupation ? (
              <span className="ml-2 text-[13px] text-text-tertiary font-normal align-middle">
                {celebrity.occupation}
              </span>
            ) : null}
          </h2>
        </div>
        {celebrity.iljuLabel ? (
          <span className="text-[12px] text-text-secondary bg-white/[0.06] px-2.5 py-1 rounded-full whitespace-nowrap">
            {celebrity.iljuLabel}
          </span>
        ) : null}
      </div>

      <div className="text-[12px] text-text-tertiary mb-4">
        {formatCelebrityBirthMeta(celebrity)}
      </div>

      {/* 차트 + 시주 미상 마스킹.
          SajuChart는 4기둥(생시·일주·생월·생년)을 가로 grid로 렌더.
          시주 컬럼이 leftmost. hourUnknown=true 시 left 25% 영역 어둡게 + 라벨 오버레이.
          enriched 전달 시 십성·오행 강약·지장간 시각화 활성화 (결과 페이지와 동일). */}
      <div className="relative">
        <SajuChart sajuData={sajuData} enriched={enriched} hideStrengthPanel />
        {hourUnknown ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[25%] rounded-l-xl flex items-center justify-center"
            style={{
              background: "rgba(9,9,11,0.72)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
            aria-label="생시 미상"
          >
            <span className="text-[11px] tracking-[0.14em] uppercase text-text-tertiary font-semibold rotate-[-90deg] sm:rotate-0 whitespace-nowrap">
              시 미상
            </span>
          </div>
        ) : null}
      </div>

      {/* 신살 배지 — 도화·천을귀인·문창귀인 등 시각화.
          결과 페이지의 ShinsalBadges 그대로 사용. matches가 있을 때만 노출. */}
      {enriched?.shinsal && enriched.shinsal.matches.length > 0 ? (
        <div className="mt-6 pt-5 border-t border-white/[0.06]">
          <ShinsalBadges
            matches={enriched.shinsal.matches}
            note={enriched.shinsal.meta?.note}
          />
        </div>
      ) : null}

      {celebrity.source ? (
        <p className="mt-4 text-[11px] text-text-tertiary leading-[1.5]">
          출처: {celebrity.source}
        </p>
      ) : null}
    </section>
  );
}
