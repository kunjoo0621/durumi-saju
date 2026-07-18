"use client";

// 하단 스티키 CTA — 배포본(랜딩)과 동일 형태:
//   참여자수(AnalysisCounter) + "사주 보러가기" 버튼 → 메뉴 페이지.
//   (카카오 로그인 CTA에서 되돌림 — 운영자 요청: 배포된 형태 유지)
// useSearchParams(returnTo) 사용 → page에서 <Suspense>로 감쌈.
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AnalysisCounter from "@/components/AnalysisCounter";
import { HUB_PRESS } from "./services";

const DEPTH = "shadow-[0_8px_30px_rgba(0,0,0,0.42)]";

export default function HubStickyCta() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 보호경로 미로그인 진입 시 /?returnTo=... 로 오는 흐름 보존 (open-redirect 방지 startsWith 검증)
  const target = useMemo(() => {
    const returnTo = searchParams?.get("returnTo");
    return returnTo && returnTo.startsWith("/") ? returnTo : "/menu";
  }, [searchParams]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[120] mx-auto max-w-[440px] px-5 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
      style={{
        // rgb(9 9 11) = --bg-primary 토큰 미러 (gradient는 토큰 클래스 불가)
        background:
          "linear-gradient(0deg, rgb(9 9 11) 0%, rgb(9 9 11) 62%, transparent 100%)",
      }}
    >
      <AnalysisCounter />
      <button
        type="button"
        onClick={() => router.push(target)}
        className={`btn-primary ${HUB_PRESS} ${DEPTH} w-full rounded-2xl py-3.5 text-[15px] font-bold`}
      >
        사주 보러가기
      </button>
    </div>
  );
}
