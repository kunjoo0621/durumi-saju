"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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
