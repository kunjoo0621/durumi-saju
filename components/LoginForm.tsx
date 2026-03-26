"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ButtonSpinner } from "@/components/loading";

interface LoginFormProps {
  callbackUrl?: string;
  onClose?: () => void;
}

export default function LoginForm({ callbackUrl = "/menu", onClose }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [error, setError] = useState("");

  const handleKakaoLogin = () => {
    setKakaoLoading(true);
    signIn("kakao", { callbackUrl });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("이메일 또는 비밀번호가 맞지 않아");
      setLoading(false);
    } else {
      window.location.href = callbackUrl;
    }
  };

  return (
    <div className="space-y-5">
      {/* 카카오 로그인 */}
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

      {/* 구분선 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[13px] text-text-tertiary">또는</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* 이메일 로그인 폼 */}
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full h-[52px] text-[15px]"
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full h-[52px] text-[15px]"
          autoComplete="current-password"
        />

        {error && (
          <p role="alert" className="text-[13px] text-primary text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
        >
          {loading ? <ButtonSpinner message="로그인 중..." /> : "로그인"}
        </button>
      </form>

      {/* 닫기 버튼 (모달에서만) */}
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
