"use client";

import { useEffect, useState } from "react";
import { Eye } from "@phosphor-icons/react";

interface Props {
  slug: string;
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
 * 허브 카드에 노출되는 조회수 배지.
 * 부모(허브 페이지의 client wrapper)가 useEffect로 fetch한 결과를
 * window 전역 store가 아니라 props로 받아도 되지만, 카드를 server component로 두려면
 * 카드 안에서 자체 fetch하는 게 단순함.
 *
 * 이 단순한 MVP는 각 카드가 자체 fetch (3개라 부담 없음).
 * 글이 늘면 허브에서 배치 fetch + Context 패턴으로 교체.
 */
export default function StoryCardViewBadge({ slug, withSeparator }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stories/${slug}/view`, { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { viewCount: number } | null) => {
        if (!cancelled && d) setCount(d.viewCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (count === null || count === 0) return null;

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
