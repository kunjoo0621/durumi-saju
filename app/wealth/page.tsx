import { requireSession } from "@/lib/server/require-session";
import WealthEntryClient from "./WealthEntryClient";

// app/marriage/page.tsx 미러(서버는 세션 게이트만 담당).
export default async function WealthPage() {
  const gate = await requireSession("/wealth");
  if (gate) return gate;
  return <WealthEntryClient />;
}
