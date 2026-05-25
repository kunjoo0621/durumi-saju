import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import YearlyEntryClient from "./YearlyEntryClient";
import AuthGate from "@/components/AuthGate";

export default async function YearlyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return <AuthGate callbackUrl="/yearly" />;
  }
  return <YearlyEntryClient />;
}
