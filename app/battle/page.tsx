import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server/require-session";

export default async function BattlePage() {
  const gate = await requireSession("/battle/input");
  if (gate) return gate;
  redirect("/battle/input");
}
