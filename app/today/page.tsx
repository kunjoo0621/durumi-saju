import { requireSession } from "@/lib/server/require-session";
import TodayEntryClient from "./TodayEntryClient";

export default async function TodayPage() {
  const gate = await requireSession("/today");
  if (gate) return gate;
  return <TodayEntryClient />;
}
