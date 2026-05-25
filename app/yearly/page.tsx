import { requireSession } from "@/lib/server/require-session";
import YearlyEntryClient from "./YearlyEntryClient";

export default async function YearlyPage() {
  const gate = await requireSession("/yearly");
  if (gate) return gate;
  return <YearlyEntryClient />;
}
