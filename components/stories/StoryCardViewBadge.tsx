import { Eye } from "@phosphor-icons/react/dist/ssr";

interface Props {
  /** 서버에서 배치로 읽은 조회수. 없거나 0이면 배지를 숨긴다. */
  count?: number | null;
  /** 앞에 `·` 분리자 표시 — 카드 메타 라인에서 사용 */
  withSeparator?: boolean;
}

function formatViewCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 100000) return `${Math.round(n / 1000)}k`;
  return `${(n / 10000).toFixed(1)}만`;
}

/**
 * 리스트/허브 카드의 조회수 배지 (읽기 전용 표시).
 *
 * 조회수는 부모 페이지가 서버에서 `getStoryViews`로 한 번에 읽어 prop으로 내려준다.
 * (이전에는 카드마다 `/api/stories/<slug>/view`를 개별 fetch → 글이 늘며 요청 폭증했음.)
 * 순수 표시 컴포넌트라 server component로 렌더된다.
 */
export default function StoryCardViewBadge({ count, withSeparator }: Props) {
  if (count == null || count === 0) return null;

  return (
    <>
      {withSeparator && (
        <span className="text-white/20" aria-hidden="true">
          ·
        </span>
      )}
      <span className="inline-flex items-center gap-1 text-[12px] text-text-tertiary">
        <Eye size={12} weight="regular" aria-hidden="true" />
        {formatViewCount(count)}
      </span>
    </>
  );
}
