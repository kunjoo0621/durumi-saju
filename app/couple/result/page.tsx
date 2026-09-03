import { requireSession } from "@/lib/server/require-session";
import CoupleResultClient from "./CoupleResultClient";

// app/marriage/result/page.tsx 패턴 미러 — 서버는 세션 게이트만 담당하고,
// 결과 id 는 동적 세그먼트가 아니라 쿼리 파라미터(`?id=`)로 받는다.
// GET /api/couple/results 가 `?id=` 없으면 최신 1건을 돌려주므로 서버가 미리 파싱할 필요가 없다.
export default async function CoupleResultPage() {
  const gate = await requireSession("/couple/result");
  if (gate) return gate;
  return <CoupleResultClient />;
}
