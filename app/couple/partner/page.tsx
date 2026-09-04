import { requireSession } from "@/lib/server/require-session";
import PartnerInputClient from "./PartnerInputClient";

// 상대 입력 — 여기서부터는 로그인이 필요하다(제출이 곧 서버 계산이라
// marriage/self 가 제출 시점에 로그인을 요구하는 것과 같은 자리다).
export default async function CouplePartnerPage() {
  const gate = await requireSession("/couple/partner");
  if (gate) return gate;
  return <PartnerInputClient />;
}
