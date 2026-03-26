"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/menu";

  return (
    <div className="min-h-[100dvh] bg-background-primary flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-[360px] space-y-8">
        <div className="text-center">
          <h1 className="text-title-2 font-aggro text-text-primary">사주보는 두루미</h1>
          <p className="text-[14px] text-text-secondary mt-2">로그인하면 결과가 저장돼</p>
        </div>

        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-background-primary flex items-center justify-center">
        <span className="text-text-secondary text-[14px]">불러오는 중...</span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
