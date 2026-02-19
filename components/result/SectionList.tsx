"use client";

import { memo, useCallback, useMemo, useState } from "react";
import SectionHeader from "./SectionHeader";
import SectionBody from "./SectionBody";

export type ResultSection = {
  icon: string;
  title: string;
  content?: string;
};

type SectionListProps = {
  sections: ResultSection[];
  locked?: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
  initialExpandedCount?: number;
};

const ACCENT_COLORS = [
  "#F43F5E", "#A855F7", "#3B82F6", "#22C55E",
  "#EAB308", "#F97316", "#EC4899", "#06B6D4",
];

// 개별 섹션 아이템 - 메모이즈
type SectionItemProps = {
  section: ResultSection;
  index: number;
  expanded: boolean;
  onToggle: (index: number) => void;
  locked: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
  accentColor: string;
};

const SectionItem = memo(function SectionItem({
  section,
  index,
  expanded,
  onToggle,
  locked,
  onUnlock,
  unlockLabel,
  accentColor,
}: SectionItemProps) {
  const contentId = `section-content-${index}`;
  const handleToggle = useCallback(() => onToggle(index), [onToggle, index]);

  return (
    <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex-1 min-w-0">
        <SectionHeader
          icon={section.icon}
          title={section.title}
          expanded={expanded}
          onToggle={handleToggle}
          id={contentId}
        />
        <div
          id={contentId}
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-6 pt-4">
              <SectionBody
                content={section.content}
                locked={locked}
                onUnlock={onUnlock}
                unlockLabel={unlockLabel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function SectionListInner({
  sections,
  locked = false,
  onUnlock,
  unlockLabel,
  initialExpandedCount = 0,
}: SectionListProps) {
  const initialSet = useMemo(() => {
    const count = Math.max(0, Math.min(initialExpandedCount, sections.length));
    return new Set(Array.from({ length: count }, (_, index) => index));
  }, [initialExpandedCount, sections.length]);

  const [expandedSections, setExpandedSections] = useState<Set<number>>(initialSet);

  // useCallback으로 토글 함수 안정화
  const toggleSection = useCallback((index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-5">
      {sections.map((section, index) => (
        <SectionItem
          key={`${section.title}-${index}`}
          section={section}
          index={index}
          expanded={expandedSections.has(index)}
          onToggle={toggleSection}
          locked={locked}
          onUnlock={onUnlock}
          unlockLabel={unlockLabel}
          accentColor={ACCENT_COLORS[index % ACCENT_COLORS.length]}
        />
      ))}
    </div>
  );
}

export default memo(SectionListInner);
