"use client";

// 하단 스티키 CTA — auth 분기. 비로그인=카카오 시작, 로그인=내 결과 보기.
// useSearchParams(returnTo) 사용 → page에서 <Suspense>로 감쌈.
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { HUB_PRESS } from "./services";

const DEPTH = "shadow-[0_8px_30px_rgba(0,0,0,0.42)]";

export default function HubStickyCta() {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // 보호경로 미로그인 진입 시 /?returnTo=... 로 오는 흐름 보존 (open-redirect 방지 startsWith 검증)
  const callbackUrl = useMemo(() => {
    const returnTo = searchParams?.get("returnTo");
    return returnTo && returnTo.startsWith("/") ? returnTo : "/menu";
  }, [searchParams]);

  const loggedIn = !!session?.user;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[120] mx-auto max-w-[440px] px-5 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
      style={{
        // rgb(9 9 11) = --bg-primary 토큰 미러 (gradient는 토큰 클래스 불가)
        background:
          "linear-gradient(0deg, rgb(9 9 11) 0%, rgb(9 9 11) 62%, transparent 100%)",
      }}
    >
      {loggedIn ? (
        <button
          type="button"
          onClick={() => router.push("/my/results")}
          className={`btn-primary ${HUB_PRESS} ${DEPTH} w-full rounded-2xl py-4 text-[16px] font-bold`}
        >
          내 결과 보기
        </button>
      ) : (
        <button
          type="button"
          onClick={() => signIn("kakao", { callbackUrl })}
          className={`${HUB_PRESS} ${DEPTH} flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-kakao py-4 text-[16px] font-bold text-black/85`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.8 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.7-2.5.6.1 1.3.1 1.9.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
          </svg>
          카카오로 3초만에 시작하기
        </button>
      )}
    </div>
  );
}
