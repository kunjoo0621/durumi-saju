import { requireSession } from "@/lib/server/require-session";
import WealthResultClient from "./WealthResultClient";

// app/marriage/result/page.tsx 패턴 미러(서버는 세션 게이트만 담당) — 결과 id는 동적 세그먼트가
// 아니라 쿼리 파라미터(`?id=`)로 받는다. GET /api/wealth/results가 `?id=` 지정 시 해당 결과,
// 없으면 로그인 사용자의 최신 1건을 돌려주도록 설계돼 있어(app/api/wealth/results/route.ts
// 주석 참고) 서버에서 파라미터를 미리 파싱할 필요가 없다 — 클라이언트가 useSearchParams로
// 직접 읽는다.
export default async function WealthResultPage() {
  const gate = await requireSession("/wealth/result");
  if (gate) return gate;
  return <WealthResultClient />;
}
