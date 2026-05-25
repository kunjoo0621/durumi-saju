// 비로그인 회원 강제 — getServerSession 검사 + AuthGate 분기 공통화.
// 사용처: app/yearly/page.tsx, app/today/page.tsx, app/battle/page.tsx (server components).
// 패턴: `const gate = await requireSession("/yearly"); if (gate) return gate;`
// session 있으면 null 반환 → 호출처가 다음 단계 진행 (entry 렌더 또는 redirect).

import type { ReactElement } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";

export async function requireSession(callbackUrl: string): Promise<ReactElement | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return <AuthGate callbackUrl={callbackUrl} />;
  }
  return null;
}
