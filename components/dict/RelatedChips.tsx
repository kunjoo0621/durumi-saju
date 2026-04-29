import Link from "next/link";
import { hasDictEntry } from "@/lib/dict/registry";
import type { DictRelated } from "@/lib/dict/types";

export default function RelatedChips({ items }: { items: DictRelated[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const exists = hasDictEntry(item.category, item.slug);
        const baseCls =
          "inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-[13px] transition-colors";
        if (exists) {
          return (
            <Link
              key={`${item.category}/${item.slug}`}
              href={`/dict/${item.category}/${item.slug}`}
              className={`${baseCls} border-white/[0.1] bg-background-secondary text-text-primary hover:bg-white/[0.06] hover:border-white/[0.2] active:bg-white/[0.08]`}
            >
              {item.hint && (
                <span className="text-[10px] text-text-tertiary tracking-wider">
                  {item.hint}
                </span>
              )}
              <span>{item.label}</span>
            </Link>
          );
        }
        return (
          <span
            key={`${item.category}/${item.slug}`}
            className={`${baseCls} border-white/[0.04] bg-white/[0.02] text-text-tertiary cursor-default`}
          >
            {item.hint && (
              <span className="text-[10px] text-text-tertiary opacity-70 tracking-wider">
                {item.hint}
              </span>
            )}
            <span>{item.label}</span>
            <span className="text-[10px] text-text-tertiary opacity-70">곧 공개</span>
          </span>
        );
      })}
    </div>
  );
}
