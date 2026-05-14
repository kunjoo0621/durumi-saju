import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import YearlyEntryClient from "./YearlyEntryClient";

export default async function YearlyPage() {
  const session = await getServerSession(authOptions);
  // 비로그인 사용자는 바로 입력 페이지로 (배틀과 동일 패턴)
  // 로그인 사용자는 entry에서 대표사주 자동 사용
  if (!session?.user) {
    redirect("/yearly/input");
  }
  return <YearlyEntryClient />;
}
