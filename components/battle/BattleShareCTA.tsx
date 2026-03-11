"use client";

import { useRouter } from "next/navigation";

export default function BattleShareCTA() {
  const router = useRouter();

  return (
    <>
      <div className="px-6 py-8 pb-28">
        <div className="max-w-[640px] mx-auto text-center">
          <p className="text-caption text-text-tertiary">
            이 분석은 AI를 활용한 참고 자료입니다.
            <br />
            실제 운명은 당신의 선택과 노력에 달려있습니다.
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[130] bg-[#141414] px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] max-w-[640px] mx-auto">
        <div className="max-w-[640px] mx-auto">
          <p className="text-sm text-gray-400 text-center mb-2">
            나도 사주 대결 해볼까?
          </p>
          <button
            type="button"
            onClick={() => router.push("/battle/input")}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-all duration-200"
          >
            사주 배틀하기
          </button>
        </div>
      </div>
    </>
  );
}
