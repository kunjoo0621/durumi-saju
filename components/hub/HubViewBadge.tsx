"use client";

// 매거진 조회수 배지 — StoryCardViewBadge 로직 복제 + HUB_STYLE(조회=Fire) 아이콘.
// 공용 StoryCardViewBadge(Eye)는 수정 금지 원칙에 따라 신규 작성.
import { useEffect, useState } from "react";
import { Fire } from "@phosphor-icons/react";

function formatViewCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 100000) return `${Math.round(n / 1000)}k`;
  return `${(n / 10000).toFixed(1)}만`;
}

export default function HubViewBadge({ slug }: { slug: string }) {
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
