"use client";

import { CaretDown } from "@phosphor-icons/react";
import { SECTION_META, resolveKey } from "@/lib/constants/section-icons";

type SectionHeaderProps = {
  icon: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  id: string;
};

export default function SectionHeader({ icon, title, expanded, onToggle, id }: SectionHeaderProps) {
  const key = resolveKey(icon);
  const meta = SECTION_META[key];
  const IconComp = meta.Icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
      aria-expanded={expanded}
      aria-controls={id}
    >
      <div className="flex items-center gap-2">
        <IconComp weight="duotone" size={28} color={meta.color} aria-hidden="true" />
        <span className="text-title-3 text-text-primary">{title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0"
          style={{ color: meta.color, backgroundColor: meta.bg }}
        >
          {meta.label}
        </span>
        <CaretDown
          weight="bold"
          size={20}
          className={`text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
