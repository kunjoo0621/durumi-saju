import { requireSession } from "@/lib/server/require-session";
import MarriageResultClient from "./MarriageResultClient";

// app/marriage/page.tsx 패턴 미러(서버는 세션 게이트만 담당) — 다만 app/today/result/[id]/page.tsx와
// 달리 결과 id는 동적 세그먼트가 아니라 쿼리 파라미터(`?id=`)로 받는다. GET /api/marriage/results가
// `?id=` 지정 시 해당 결과, 없으면 로그인 사용자의 최신 1건을 돌려주도록 설계돼 있어
// (app/api/marriage/results/route.ts 주석 참고) 서버에서 파라미터를 미리 파싱할 필요가 없다 —
// app/pet/result/PetResultClient.tsx처럼 클라이언트 컴포넌트가 useSearchParams로 직접 읽는다.
export default async function MarriageResultPage() {
  const gate = await requireSession("/marriage/result");
  if (gate) return gate;
  return <MarriageResultClient />;
}
