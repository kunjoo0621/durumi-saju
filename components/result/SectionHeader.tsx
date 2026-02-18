"use client";

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
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">{icon}</span>
        <span className="text-title-3 text-text-primary">{title}</span>
      </div>
      <svg
        className={`w-5 h-5 text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
