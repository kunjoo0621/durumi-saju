import Link from "next/link";
import type { Story } from "@/lib/stories/types";
import { getStoryTags } from "@/lib/stories/registry";

/**
 * 글 하단 태그 칩 (클릭 시 태그 클러스터 페이지로). 연예인 글의 천간 칩이
 * 일간 가이드로 이어지는 다리. <Link> 카드 안에 중첩되지 않는 위치에서만 쓴다.
 */
export default function StoryTags({ story }: { story: Story }) {
  const tags = getStoryTags(story);
  if (tags.length === 0) return null;
  return (
    <nav className="mt-10 flex flex-wrap gap-2" aria-label="태그">
      {tags.map((t) => (
        <Link
          key={t.tag}
          href={`/stories/tag/${encodeURIComponent(t.tag)}`}
          className="text-[12.5px] text-text-secondary bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.14] px-2.5 py-1 rounded-full transition-colors"
        >
          #{t.label}
        </Link>
      ))}
    </nav>
  );
}
