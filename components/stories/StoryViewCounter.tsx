"use client";

import { useEffect, useState } from "react";
import { Eye } from "@phosphor-icons/react";

interface Props {
  slug: string;
}

function formatViewCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 100000) return `${Math.round(n / 1000)}k`;
  return `${(n / 10000).toFixed(1)}만`;
}

/**
 * 본문 페이지 마운트 시 한 번 조회수 증분.
 * - sessionStorage로 같은 세션 중복 증분 방지 (F5 spam 차단)
 * - 실패해도 UI는 정상 표시 (silent fail)
 */
export default function StoryViewCounter({ slug }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sessionKey = `story-viewed:${slug}`;
    const alreadyCounted =
      typeof window !== "undefined" && sessionStorage.getItem(sessionKey) === "1";

    const run = async () => {
      try {
        const method = alreadyCounted ? "GET" : "POST";
        const res = await fetch(`/api/stories/${slug}/view`, { method });
        if (!res.ok) return;
        const data = (await res.json()) as { viewCount: number };
        if (cancelled) return;
        setCount(data.viewCount);
        if (!alreadyCounted) sessionStorage.setItem(sessionKey, "1");
      } catch (err) {
        console.warn("[StoryViewCounter] failed", err);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-text-tertiary">
      <Eye size={13} weight="regular" aria-hidden="true" />
      {count === null ? "조회 –" : `조회 ${formatViewCount(count)}`}
    </span>
  );
}
