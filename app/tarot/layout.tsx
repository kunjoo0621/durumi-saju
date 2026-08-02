import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TAROT_ENABLED } from "@/lib/tarot/worlds";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "타로보는 두루미";
const TITLE = "타로보는 두루미 | 지금 이 선택, 할까 말까";
const DESCRIPTION =
  "이직해도 될까? 고백해도 될까? 78장에서 직접 고른 세 장을 내 사주 원국으로 풀어 읽는다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/tarot`,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
  },
};

// 환경변수 NEXT_PUBLIC_FEATURE_TAROT=1 일 때만 라우트 노출 (yearly와 같은 방식).
// 미설정/0 이면 빌드는 되지만 접근 시 404 — 만드는 중인 화면이 실서비스에 새는 걸 막는다.
export default function TarotLayout({ children }: { children: React.ReactNode }) {
  if (!TAROT_ENABLED) notFound();

  // data-world가 --primary를 자수정으로 덮어쓴다(globals.css). display:contents라
  // 박스를 만들지 않으므로 sticky·레이아웃에 전혀 개입하지 않는다 —
  // 커스텀 프로퍼티 상속은 박스 트리가 아니라 DOM 트리를 따르므로 값은 그대로 내려간다.
  return (
    <div data-world="tarot" className="contents">
      {children}
    </div>
  );
}
