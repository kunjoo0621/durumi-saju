import { requireSession } from "@/lib/server/require-session";
import MarriageEntryClient from "./MarriageEntryClient";

export default async function MarriagePage() {
  const gate = await requireSession("/marriage");
  if (gate) return gate;
  return <MarriageEntryClient />;
}
