// 매거진 허브 조회수 배지 — 아이콘만 Fire(HUB_STYLE), 나머지는 StoryCardViewBadge와 동일.
import { Fire } from "@phosphor-icons/react/dist/ssr";

function formatViewCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 100000) return `${Math.round(n / 1000)}k`;
  return `${(n / 10000).toFixed(1)}만`;
}

/**
 * 조회수는 부모(허브 페이지)가 서버에서 배치로 읽어 prop으로 내려준다.
 * (이전에는 카드마다 `/api/stories/<slug>/view`를 개별 fetch했음.) 순수 표시 = server component.
 */
export default function HubViewBadge({ count }: { count?: number | null }) {
  if (count == null || count === 0) return null;

  return (
    <>
      <span className="text-white/20" aria-hidden="true">
        ·
      </span>
      <span className="inline-flex items-center gap-1">
        <Fire size={11} weight="fill" aria-hidden="true" />
        {formatViewCount(count)}
      </span>
    </>
  );
}
