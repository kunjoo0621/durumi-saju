import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { DictFAQ } from "@/lib/dict/types";

export default function FAQList({ items }: { items: DictFAQ[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-xl bg-background-secondary border border-white/[0.06] overflow-hidden transition-colors hover:border-white/[0.1]"
        >
          <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors">
            <span className="text-[15px] font-semibold text-text-primary leading-[1.5]">
              {item.q}
            </span>
            <CaretDown
              size={18}
              weight="bold"
              className="text-text-tertiary mt-0.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-5 pt-1">
            <p className="text-[14px] text-text-secondary leading-[1.85]">{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
