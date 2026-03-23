"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInputStore } from "@/store/useInputStore";
import { useCoinStore } from "@/store/useCoinStore";

// 내부 테스트 계정 (PostHog 추적 제외)
const INTERNAL_USER_IDS = new Set([
  "b1fa9eba-2953-45d1-975b-fdf8a5d9b44f", // 신건주
]);

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // 수동으로 캡처 (Next.js SPA 라우팅 대응)
    capture_pageleave: true,
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  // pathname 변경 시에만 pageview 캡처 (searchParams 변경은 무시)
  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname;
      const qs = searchParams?.toString();
      if (qs) url += "?" + qs;
      posthogClient.capture("$pageview", { $current_url: url });
    }
  }, [pathname, posthogClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function PostHogIdentify() {
  const { data: session, status } = useSession();
  const posthogClient = usePostHog();
  const balance = useCoinStore((s) => s.balance);
  const gender = useInputStore((s) => s.gender);
  const birthYear = useInputStore((s) => s.birthYear);
  const birthLocation = useInputStore((s) => s.birthLocation);
  const relationshipStatus = useInputStore((s) => s.relationshipStatus);
  const employmentStatus = useInputStore((s) => s.employmentStatus);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const identifiedRef = useRef<string | null>(null);

  // 세션 변경 시 즉시 identify/reset
  useEffect(() => {
    if (!posthogClient) return;

    const user = session?.user as { supabaseId?: string; name?: string; email?: string } | undefined;
    if (user?.supabaseId) {
      if (INTERNAL_USER_IDS.has(user.supabaseId)) {
        posthogClient.opt_out_capturing();
        identifiedRef.current = null;
        return;
      }
      // 같은 유저로 이미 identify됐으면 skip
      if (identifiedRef.current !== user.supabaseId) {
        posthogClient.opt_in_capturing();
        posthogClient.identify(user.supabaseId, {
          name: user.name || undefined,
          email: user.email || undefined,
        });
        identifiedRef.current = user.supabaseId;
      }
    } else if (status === "unauthenticated") {
      posthogClient.reset();
      identifiedRef.current = null;
    }
  }, [session, status, posthogClient]);

  // 프로필 속성은 디바운스해서 전송 (스토어 변경마다 호출 방지)
  useEffect(() => {
    if (!posthogClient || status !== "authenticated") return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const props: Record<string, unknown> = {};
      if (gender) props.gender = gender;
      if (birthYear) {
        const age = new Date().getFullYear() - Number(birthYear);
        props.age = age;
        props.age_group = age < 20 ? "10대" : age < 30 ? "20대" : age < 40 ? "30대" : age < 50 ? "40대" : "50대+";
      }
      if (birthLocation) props.region = birthLocation;
      if (relationshipStatus) props.relationship_status = relationshipStatus;
      if (employmentStatus) props.employment_status = employmentStatus;
      if (balance !== null) props.coin_balance = balance;

      if (Object.keys(props).length > 0) {
        posthogClient.setPersonProperties(props);
      }
    }, 500);

    return () => clearTimeout(timerRef.current);
  }, [posthogClient, status, balance, gender, birthYear, birthLocation, relationshipStatus, employmentStatus]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
