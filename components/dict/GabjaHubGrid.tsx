import Link from "next/link";
import { GABJA_META, GABJA_GROUPS } from "@/lib/dict/gabja-meta";
import { ELEMENT_HEX } from "@/lib/dict/colors";
import type { DictEntry } from "@/lib/dict/types";

export default function GabjaHubGrid({ entries }: { entries: DictEntry[] }) {
  const entryMap = new Map(entries.map((e) => [e.slug, e]));

  return (
    <div className="space-y-9">
      {GABJA_GROUPS.map((group) => {
        const groupMeta = GABJA_META.filter((m) => m.group === group.id);
        return (
          <section key={group.id}>
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h2 className="text-[15px] font-aggro text-text-primary">
                {group.name}
              </h2>
              <span className="text-[11px] text-text-tertiary tracking-wider">
                공망 {group.gongmang}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {groupMeta.map((meta) => {
                const entry = entryMap.get(meta.slug);
                if (!entry || entry.hero.variant !== "combination") return null;
                const cheongan = entry.hero.left;
                const jiji = entry.hero.right;
                const cheonganHex = cheongan.element
                  ? ELEMENT_HEX[cheongan.element]
                  : "#A0A0A0";
                const jijiHex = jiji.element
                  ? ELEMENT_HEX[jiji.element]
                  : "#A0A0A0";
                return (
                  <Link
                    key={meta.slug}
                    href={`/dict/gabja/${meta.slug}`}
                    className="group rounded-xl bg-background-secondary border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors px-3 py-3.5 text-center relative"
                  >
                    <div className="absolute top-1.5 right-2 text-[9px] text-text-tertiary opacity-60">
                      {meta.order}
                    </div>
                    <div className="flex items-baseline justify-center gap-0.5 mb-1.5">
                      <span
                        className="text-[22px] sm:text-[24px] font-aggro leading-none"
                        style={{
                          color: cheonganHex,
                          textShadow: `0 0 12px ${cheonganHex}33`,
                        }}
                      >
                        {cheongan.char}
                      </span>
                      <span
                        className="text-[22px] sm:text-[24px] font-aggro leading-none"
                        style={{
                          color: jijiHex,
                          textShadow: `0 0 12px ${jijiHex}33`,
                        }}
                      >
                        {jiji.char}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-tertiary tracking-wider">
                      {entry.hanja}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
