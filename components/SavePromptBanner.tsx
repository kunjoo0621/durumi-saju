"use client";

import { signIn } from "next-auth/react";

interface SavePromptBannerProps {
  returnTo: string;
}

export default function SavePromptBanner({ returnTo }: SavePromptBannerProps) {
  return (
    <div className="rounded-2xl bg-background-secondary p-4 text-text-secondary flex flex-col gap-3">
      <p className="text-[14px]">
        지금 로그인하면 결과가 영구 저장돼요. 로그인 없이는 일정 시간 후 사라져요.
      </p>
      <button
        onClick={() =>
          signIn("kakao", { callbackUrl: `${returnTo}${returnTo.includes("?") ? "&" : "?"}claim=true` })
        }
        className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-text-primary bg-primary disabled:opacity-50"
      >
        카카오로 저장하기
      </button>
    </div>
  );
}
