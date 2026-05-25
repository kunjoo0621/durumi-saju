import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import TodayEntryClient from "./TodayEntryClient";

export default async function TodayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    // 비로그인 — 회원 강제 모달 (callbackUrl도 /today로 — 로그인 후 entry 진입)
    return <AuthGate callbackUrl="/today" />;
  }
  // 로그인 — entry에서 대표사주 자동 사용. 대표사주 없으면 entry 내부에서 분기 카드 노출.
  return <TodayEntryClient />;
}
