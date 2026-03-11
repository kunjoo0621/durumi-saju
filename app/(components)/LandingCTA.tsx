"use client";

type LandingCTAProps = {
  onStart: () => void;
};

export default function LandingCTA({ onStart }: LandingCTAProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[130] border-t border-white/10 bg-black/45 px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-xl">
      <div className="max-w-[640px] mx-auto">
        <p className="text-[12px] text-white/78 text-center mb-2">
          결과를 저장하고 다시 보려면 로그인이 필요해요
        </p>

        <button
          type="button"
          onClick={onStart}
          className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
            <path
              d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
              fill="currentColor"
            />
          </svg>
          카카오로 시작하기
        </button>
      </div>
    </div>
  );
}
