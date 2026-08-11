"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { fireNaverConversionWhenReady } from "@/components/NaverAnalytics";

/**
 * 네이버 검색광고 **회원가입(sign_up) 전환** 발동.
 *
 * 왜 결제 전환만으로 부족한가 — 2026-08-03 "광고 클릭 268건 → 가입 0" 사건에서
 * 클릭과 가입 사이가 통째로 깜깜했다. 결제 전환만 붙이면 그 구간이 또 안 보인다.
 * 가입 전환이 있어야 "도착은 했는데 가입에서 샌다"를 네이버 쪽 데이터로도 짚는다.
 *
 * ── 중복 발동을 막는 2중 가드 ────────────────────────────────────────────
 * ① 서버: `session.user.isNewSignup` 은 **가입 시각 기준 10분 창** 안에서만 true
 *    (lib/auth.ts `SIGNUP_CONVERSION_WINDOW_MS`). 재로그인·기존 유저는 애초에 false.
 *    ★"1회만 true" 방식은 쓸 수 없다 — next-auth 가 한 요청 안에서 jwt 반환 토큰을
 *      그대로 session 콜백에 넘겨서, 지운 그 요청에 바로 읽히면 전량 0이 된다.
 * ② 클라이언트: localStorage 키로 유저당 1회만. ①은 10분간 계속 true 라 새로고침·
 *    라우트 이동마다 쏘일 수 있는데 그걸 여기서 묶는다.
 *
 * 실패해도 조용히 넘어간다 — 계측이 가입 흐름을 막으면 안 된다.
 */
const FIRED_PREFIX = "naver_signup_fired:";

export function NaverSignupConversion() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const user = session?.user as
      | { isNewSignup?: boolean; supabaseId?: string; id?: string }
      | undefined;
    if (!user?.isNewSignup) return;

    // 유저 식별자가 없으면 중복 가드를 걸 수 없으므로 쏘지 않는다(과다 계상 방지).
    const uid = user.supabaseId || user.id;
    if (!uid) return;

    const key = `${FIRED_PREFIX}${uid}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // 시크릿 모드 등 localStorage 차단 환경. 서버 가드(①)만 믿고 진행한다.
    }

    // ★가드는 **발동에 성공한 뒤에** 세운다. 먼저 세우면 wcslog.js 로드가 6초 창을
    //   넘겼을 때 그 유저의 전환이 영영 유실된다(무음 손실).
    // sign_up 은 value 가 필수가 아니다(purchase 만 필수).
    fireNaverConversionWhenReady({ type: "sign_up", id: uid }, () => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        // 저장 실패해도 발동은 이미 끝났다. 서버 시간창이 반복을 제한한다.
      }
    });
  }, [status, session]);

  return null;
}
