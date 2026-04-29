"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Egg } from "@phosphor-icons/react";
import { ButtonSpinner } from "@/components/loading";

interface LoginFormProps {
  callbackUrl?: string;
  onClose?: () => void;
}

export default function LoginForm({ callbackUrl = "/menu", onClose }: LoginFormProps) {
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleKakaoLogin = () => {
    setKakaoLoading(true);
    signIn("kakao", { callbackUrl });
  };

  return (
    <div className="space-y-5">
      {/* 이벤트 안내 */}
      <div className="rounded-xl border border-[rgb(var(--c-brand))]/25 bg-[rgb(var(--c-brand))]/[0.08] px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white">
          <Egg size={16} weight="fill" className="text-[rgb(var(--c-brand))]" aria-hidden />
          <span>지금 카카오 로그인하면</span>
          <span className="rounded-full bg-[rgb(var(--c-brand))] px-2 py-0.5 text-[12px] font-bold text-white">
            10알 무료
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[rgb(var(--c-text-sub))]">신규 가입 1회 한정</p>
      </div>

      <button
        type="button"
        onClick={handleKakaoLogin}
        disabled={kakaoLoading}
        className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {kakaoLoading ? (
          <ButtonSpinner message="로그인 중..." />
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
              <path
                d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                fill="currentColor"
              />
            </svg>
            카카오로 시작하기
          </>
        )}
      </button>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full h-[48px] rounded-xl text-[14px] text-text-tertiary transition-colors"
        >
          돌아가기
        </button>
      )}
    </div>
  );
}
