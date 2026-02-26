"use client";

import { signIn } from "next-auth/react";

interface SavePromptBannerProps {
  returnTo: string;
}

export default function SavePromptBanner({ returnTo }: SavePromptBannerProps) {
  return (
    <div className="rounded-2xl bg-background-secondary p-4 text-text-secondary flex flex-col gap-3">
      <p className="text-[14px]">
        로그인하면 결과가 계속 저장돼. 안 하면 24시간 뒤에 사라져.
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
