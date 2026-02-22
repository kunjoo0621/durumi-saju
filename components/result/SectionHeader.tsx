"use client";

const SECTION_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  '🧭': { label: '성격', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.15)' },
  '💎': { label: '강점', color: '#4ADE80', bg: 'rgba(74, 222, 128, 0.15)' },
  '🧩': { label: '관계', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)' },
  '💰': { label: '재물', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)' },
  '💞': { label: '연애', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)' },
  '💼': { label: '직장', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)' },
  '🩺': { label: '건강', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)' },
  '🚧': { label: '주의', color: '#F87171', bg: 'rgba(248, 113, 113, 0.15)' },
  '🎯': { label: '분석', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' },
  '✅': { label: '종합', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)' },
};

function SectionBadge({ emoji }: { emoji: string }) {
  const badge = SECTION_BADGES[emoji];
  if (!badge) return null;
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0"
      style={{ color: badge.color, backgroundColor: badge.bg }}
    >
      {badge.label}
    </span>
  );
}

type SectionHeaderProps = {
  icon: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  id: string;
};

export default function SectionHeader({ icon, title, expanded, onToggle, id }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
      aria-expanded={expanded}
      aria-controls={id}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden="true">{icon}</span>
        <span className="text-title-3 text-text-primary">{title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SectionBadge emoji={icon} />
        <svg
          className={`w-5 h-5 text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>
  );
}
