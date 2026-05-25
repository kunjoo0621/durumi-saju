import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";

export default async function BattlePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return <AuthGate callbackUrl="/battle/input" />;
  }
  redirect("/battle/input");
}
