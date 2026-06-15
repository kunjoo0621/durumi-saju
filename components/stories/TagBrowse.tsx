import Link from "next/link";
import { getAllTags, type TagWithCount } from "@/lib/stories/registry";
import type { TagGroup } from "@/lib/stories/tags";

const GROUP_ORDER: TagGroup[] = ["인물", "주제", "꿈", "일간"];
const GROUP_LABEL: Record<TagGroup, string> = {
  인물: "인물",
  주제: "주제",
  꿈: "꿈해몽",
  일간: "일간으로 찾기",
};

/**
 * 인덱스/시리즈 상단 태그 브라우징 클라우드. 그룹별로 칩을 묶어 노출.
 * 113편 평면 나열을 보완하는 핵심 탐색 동선.
 */
export default function TagBrowse() {
  const tags = getAllTags();
  const byGroup = new Map<TagGroup, TagWithCount[]>();
  for (const t of tags) {
    const arr = byGroup.get(t.group) ?? [];
    arr.push(t);
    byGroup.set(t.group, arr);
  }

  return (
    <div className="space-y-5">
      {GROUP_ORDER.map((g) => {
        const list = byGroup.get(g);
        if (!list || list.length === 0) return null;
        return (
          <div key={g}>
            <div className="text-[11px] tracking-[0.16em] text-text-tertiary mb-2.5 uppercase">
              {GROUP_LABEL[g]}
            </div>
            <div className="flex flex-wrap gap-2">
              {list.map((t) => (
                <Link
                  key={t.tag}
                  href={`/stories/tag/${encodeURIComponent(t.tag)}`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] px-3 py-1.5 rounded-full transition-colors"
                >
                  {t.label}
                  <span className="text-text-tertiary text-[11px]">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
