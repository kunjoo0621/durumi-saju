import { requireSession } from "@/lib/server/require-session";
import CoupleTeaserClient from "./CoupleTeaserClient";

export default async function CoupleTeaserPage() {
  const gate = await requireSession("/couple/teaser");
  if (gate) return gate;
  return <CoupleTeaserClient />;
}
