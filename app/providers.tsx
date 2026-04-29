"use client";

import { SessionProvider } from "next-auth/react";
import PostHogProvider from "./posthog-provider";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  // Suspense를 여기서 감싸지 않음. children(페이지) 가 streaming payload로 빠져 JSON-LD가 정적 HTML에 안 나오는 문제 방지.
  // useSearchParams가 필요한 PostHogPageView는 PostHogProvider 안에서 자체 Suspense로 감싼다.
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <PostHogProvider>{children}</PostHogProvider>
    </SessionProvider>
  );
}
