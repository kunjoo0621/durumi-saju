"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 네이버 애널리틱스(analytics.naver.com) 계측.
 *
 * 왜 필요한가 — 우리 `users` 테이블은 **가입한 사람만** 기록한다. 그래서 2026-08-03
 * "네이버 광고 클릭 268건 → 가입 0" 사건에서 **"도착했는데 이탈"과 "아예 안 옴"을
 * 구분할 수 없었다**(같은 벽에 7/27에도 막혔다 — memory/project_durumi_analytics).
 * 네이버는 유입의 40%대를 차지하는 최대 채널인데 네이버 쪽 데이터가 하나도 없었다.
 * 이 계측이 붙으면 가입 안 하고 떠난 방문자·유입 검색어·사용자 특성이 보인다.
 *
 * ★Vercel Web Analytics 와 겹치지 않는 것: **유입 검색어**와 성별·연령대.
 *   검색어는 사전(/dict) SEO 가 유일한 유입 엔진인 우리한테 직접적인 값어치가 있다.
 *
 * ※ 광고 전환 스크립트(wcs.naver.net, 네이버공통키)와는 **별개 서비스**다.
 *   공식 가이드: "광고 전환 스크립트를 설치했더라도 애널리틱스는 추가 설치해야 한다."
 *   전환추적 서비스 신청분이 발급되면 이 파일에 나란히 추가한다(공존이 정상).
 */

// 발급ID. 공개 값이라 숨길 이유가 없고(클라이언트 HTML 에 그대로 노출된다),
// GOOGLE_ADS_ID 와 같은 방식으로 코드에 둔다.
// ★환경변수로 빼지 않는 이유: Vercel Web Analytics 가 "코드만 배포되고 대시보드
//   스위치는 꺼진 채" 11일간 데이터 0 이었던 사고를 방금 겪었다. 사람이 따로
//   채워야 하는 단계를 하나라도 줄인다.
const NAVER_WA_ID = "2557da4fbf17080";

declare global {
  interface Window {
    wcs?: unknown;
    wcs_add?: Record<string, string>;
    wcs_do?: () => void;
  }
}

/**
 * 라우트가 바뀔 때마다 PV 를 다시 보낸다.
 * ★이게 없으면 **첫 진입 페이지만** 집계된다 — 우리는 App Router SPA 라
 * 사전→결과→결제 이동이 전부 클라이언트 네비게이션이다.
 * 공식 가이드에 SPA 항목이 없어 이 부분은 직접 설계했다.
 */
function useNaverPageview(pathname: string) {
  useEffect(() => {
    let cancelled = false;

    const send = () => {
      if (typeof window === "undefined") return false;
      if (!window.wcs || typeof window.wcs_do !== "function") return false;
      window.wcs_add = window.wcs_add ?? {};
      window.wcs_add["wa"] = NAVER_WA_ID;
      window.wcs_do();
      return true;
    };

    if (send()) return;

    // wcslog.js 로드 전이면 잠깐 기다렸다 보낸다(afterInteractive 라 첫 진입에서 늦을 수 있다).
    const timer = setInterval(() => {
      if (cancelled) return;
      if (send()) clearInterval(timer);
    }, 200);
    const stop = setTimeout(() => clearInterval(timer), 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [pathname]);
}

export function NaverAnalytics() {
  const pathname = usePathname();
  useNaverPageview(pathname);

  // ※ 쿼리스트링 변화는 추적하지 않는다. useSearchParams 를 쓰면 Suspense 경계가
  //   필요해지고 574개 정적 페이지의 프리렌더가 깨진다. PV 집계 목적상 경로 단위면 충분하다.
  return (
    <Script
      id="naver-analytics"
      src="//wcs.pstatic.net/wcslog.js"
      strategy="afterInteractive"
    />
  );
}
