"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 네이버 계측 — 애널리틱스(PV) + 검색광고 전환추적(wcs.trans)을 **한 스크립트로** 얹는다.
 *
 * 왜 필요한가 — 우리 `users` 테이블은 **가입한 사람만** 기록한다. 그래서 2026-08-03
 * "네이버 광고 클릭 268건 → 가입 0" 사건에서 **"도착했는데 이탈"과 "아예 안 옴"을
 * 구분할 수 없었다**(같은 벽에 7/27에도 막혔다 — memory/project_durumi_analytics).
 * 네이버는 유입의 50%대를 차지하는 최대 채널인데 네이버 쪽 데이터가 하나도 없었다.
 *
 * ★Vercel Web Analytics 와 겹치지 않는 것: **유입 검색어**와 성별·연령대.
 *   검색어는 사전(/dict) SEO 가 유일한 유입 엔진인 우리한테 직접적인 값어치가 있다.
 *
 * ─── 두 서비스를 한 파일에 둔 이유 (2026-08-12) ────────────────────────────
 * 애널리틱스와 광고 전환추적은 **같은 `wcslog.js` 라이브러리**를 쓰고,
 * **같은 전역 `wcs_add["wa"]`** 로 계정을 식별한다. 값만 다르다.
 *   애널리틱스 발급ID : 2557da4fbf17080
 *   광고 네이버공통키 : s_3318034d348d
 * 그래서 스크립트를 두 번 로드하면 `window.wcs` 가 서로 덮어써 깨진다.
 * → **로드는 한 번**, 호출 **직전에** 해당 키를 꽂는다(JS 단일 스레드라 set→call 사이에
 *   다른 코드가 끼어들 수 없다). 이 규칙을 어기면 라우트 이동 한 번에 전환키가 날아간다.
 *
 * ★버전: 신 스크립트(`wcs.trans`). 구버전(`wcs.cnv`)을 먼저 쓰면 나중에 trans 로 옮길 때
 *   같은 유형의 cnv 전환이 **영구 필터링**되므로 처음부터 trans 로 간다.
 *   공통키는 버전 간 공용이다("기존에 사용하시던 값 그대로 복사하여 사용").
 *   https://naver.github.io/conversion-tracking/pages/01_script_guide_wcstrans/
 */

// 발급ID·공통키 모두 공개 값이다(클라이언트 HTML 에 그대로 노출된다).
// ★환경변수로 빼지 않는 이유: Vercel Web Analytics 가 "코드만 배포되고 대시보드
//   스위치는 꺼진 채" 11일간 데이터 0 이었던 사고를 겪었다. 사람이 따로 채워야
//   하는 단계를 하나라도 줄인다.
const NAVER_WA_ID = "2557da4fbf17080"; // 애널리틱스 발급ID
const NAVER_CONV_KEY = "s_3318034d348d"; // 검색광고 네이버공통키
/** 광고 유입 정보를 담을 쿠키 도메인. 루트 도메인을 쓴다(가이드 권장). */
const INFLOW_DOMAIN = "durumisaju.com";

type WcsTransPayload = {
  type: "purchase" | "sign_up";
  id?: string;
  value?: string;
};

declare global {
  interface Window {
    wcs?: {
      inflow?: (domain?: string) => void;
      trans?: (payload: WcsTransPayload) => void;
    };
    wcs_add?: Record<string, string>;
    wcs_do?: () => void;
  }
}

function wcsReady(): boolean {
  return typeof window !== "undefined" && !!window.wcs;
}

/**
 * 광고 전환 발동. **호출 직전에 공통키를 꽂는 게 핵심** — 애널리틱스 PV 가
 * 같은 전역을 애널리틱스 ID 로 계속 덮어쓰기 때문이다.
 *
 * 실패해도 결제·가입 흐름을 막지 않는다(계측은 부수효과다).
 */
export function fireNaverConversion(payload: WcsTransPayload): boolean {
  if (!wcsReady() || typeof window.wcs?.trans !== "function") return false;
  try {
    window.wcs_add = window.wcs_add ?? {};
    window.wcs_add["wa"] = NAVER_CONV_KEY;
    window.wcs.trans(payload);
    return true;
  } catch (err) {
    console.warn("[naver] trans 실패", err);
    return false;
  }
}

/**
 * wcslog.js 로드가 늦을 수 있어(afterInteractive) 잠깐 재시도한다.
 * 결제완료·가입완료는 페이지가 금방 넘어갈 수 있으므로 창을 짧게(6s) 잡는다.
 */
export function fireNaverConversionWhenReady(payload: WcsTransPayload) {
  if (fireNaverConversion(payload)) return;
  const timer = setInterval(() => {
    if (fireNaverConversion(payload)) clearInterval(timer);
  }, 200);
  setTimeout(() => clearInterval(timer), 6000);
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
    let inflowDone = false;

    const send = () => {
      if (!wcsReady() || typeof window.wcs_do !== "function") return false;
      window.wcs_add = window.wcs_add ?? {};

      // 광고 유입 쿠키는 전환추적 몫이라 공통키 문맥에서 한 번만 심는다.
      if (!inflowDone && typeof window.wcs?.inflow === "function") {
        try {
          window.wcs_add["wa"] = NAVER_CONV_KEY;
          window.wcs.inflow(INFLOW_DOMAIN);
        } catch (err) {
          console.warn("[naver] inflow 실패", err);
        }
        inflowDone = true;
      }

      // ★PV 는 반드시 애널리틱스 ID 로 되돌린 뒤 보낸다.
      window.wcs_add["wa"] = NAVER_WA_ID;
      window.wcs_do();
      return true;
    };

    if (send()) return;

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
  //
  // ★src 는 공식 호스트 `wcs.naver.net`. 전환추적 가이드가 이 호스트를 명시하고,
  //   애널리틱스도 같은 파일을 쓴다. (기존 `wcs.pstatic.net` 은 미러였다.)
  return (
    <Script
      id="naver-analytics"
      src="//wcs.naver.net/wcslog.js"
      strategy="afterInteractive"
    />
  );
}
