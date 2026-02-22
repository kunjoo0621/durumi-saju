"use client";

import { useKakaoLogin } from "@/hooks/useKakaoLogin";

export default function AuthErrorPage() {
  const { login, signing } = useKakaoLogin();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
         style={{ backgroundColor: "rgb(var(--bg-primary))" }}>
      <div className="max-w-[640px] w-full text-center">
        <div className="mb-6 text-6xl" aria-hidden="true">🔒</div>
        <h2 className="text-xl font-bold text-white mb-3">
          로그인에 실패했습니다
        </h2>
        <p className="text-sm text-gray-400 mb-8">
          일시적인 오류가 발생했어요. 다시 시도해주세요.
        </p>
        <button
          onClick={() => login("/menu")}
          disabled={signing}
          className="w-full max-w-xs mx-auto h-12 rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {signing ? "로그인 중..." : "다시 로그인"}
        </button>
      </div>
    </div>
  );
}
