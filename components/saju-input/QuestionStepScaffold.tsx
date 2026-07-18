"use client";

import type { ReactNode } from "react";
import Header from "@/components/layout/Header";

/* 질문 스텝 화면 크롬 (SajuInputFlow에서 순수 추출)
 * Header + 중앙 title + main slot(children) + footer(진행바 + CTA)를 담당.
 * 개인사주/오늘/올해/배틀과 결혼운·재물운·펫이 동일한 화면 골격을 공유하기 위한 자산.
 *
 * ⚠️ Fragment로 반환 — outer div(h-[100dvh] flex flex-col ...)와 LoginModal은
 *    호출부(SajuInputFlow)가 소유. 그래야 outer div의 자식 순서
 *    (Header → main → footer → Modal)가 기존과 100% 동일하게 유지됨.
 *  - title:    text-[24px] font-semibold text-white text-center font-aggro mb-6
 *  - progress: {stepIndex+1} / {stepTotal} + role="progressbar"
 *  - CTA:      btn-primary ... disabled={!canProceed}
 */
type QuestionStepScaffoldProps = {
  title: string;
  onBack?: () => void;
  stepIndex?: number;
  stepTotal?: number;
  canProceed: boolean;
  onProceed: () => void;
  ctaLabel?: string;
  children: ReactNode;
};

export default function QuestionStepScaffold({
  title,
  onBack,
  stepIndex,
  stepTotal,
  canProceed,
  onProceed,
  ctaLabel = "다음",
  children,
}: QuestionStepScaffoldProps) {
  const showProgress = stepIndex !== undefined && stepTotal !== undefined;

  return (
    <>
      <Header showBack onBack={onBack} />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto">
        <div className="max-w-[640px] w-full mx-auto pt-10">
          {/* 질문 */}
          <div>
            <h2 className="text-[24px] font-semibold text-white text-center font-aggro mb-6">
              {title}
            </h2>
          </div>

          {/* 입력 영역 */}
          <div>{children}</div>
        </div>
      </main>

      {/* 하단 영역 (프로그레스바 + 다음 버튼) */}
      <footer
        className="shrink-0 bg-[#0D0D0D] px-5 py-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
      >
        <div className="max-w-[640px] mx-auto space-y-4">
          {showProgress && (
            <div className="flex items-center">
              <span className="text-[14px] text-text-secondary">{stepIndex + 1} / {stepTotal}</span>
              <div
                className="ml-3 flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={stepIndex + 1}
                aria-valuemin={1}
                aria-valuemax={stepTotal}
              >
                <div
                  className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${((stepIndex + 1) / stepTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={onProceed}
            disabled={!canProceed}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200"
          >
            {ctaLabel}
          </button>
        </div>
      </footer>
    </>
  );
}
