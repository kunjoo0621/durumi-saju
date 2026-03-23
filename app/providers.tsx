"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import PostHogProvider from "./posthog-provider";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <Suspense fallback={null}>
        <PostHogProvider>{children}</PostHogProvider>
      </Suspense>
    </SessionProvider>
  );
}
