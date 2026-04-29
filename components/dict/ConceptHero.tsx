import type { DictEntry } from "@/lib/dict/types";

export default function ConceptHero({ entry }: { entry: DictEntry }) {
  if (entry.hero.variant !== "concept") return null;
  const { accentColor = "#FF6B6B", orderLabel } = entry.hero;

  return (
    <section className="pt-2 pb-2">
      {orderLabel && (
        <div
          className="text-[12px] tracking-[0.18em] font-semibold mb-3 uppercase"
          style={{ color: accentColor }}
        >
          {orderLabel}
        </div>
      )}

      <h1 className="text-display font-aggro text-text-primary leading-[1.15] mb-2">
        {entry.name}
        <span className="text-title-2 text-text-tertiary font-light ml-2.5 tracking-wider align-middle">
          {entry.hanja}
        </span>
      </h1>

      <p className="text-body-2 text-text-secondary leading-[1.7] mb-2">
        {entry.tagline}
      </p>

      <div
        className="mt-6 rounded-2xl px-6 py-7 sm:px-7 sm:py-8 relative overflow-hidden"
        style={{
          backgroundColor: `${accentColor}0F`,
          border: `1px solid ${accentColor}26`,
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-50"
          style={{
            background: `radial-gradient(circle, ${accentColor}26 0%, transparent 70%)`,
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <div
            className="text-[10px] tracking-[0.2em] uppercase mb-2 font-semibold"
            style={{ color: accentColor }}
          >
            한 줄 정의
          </div>
          <div className="text-body-1 text-text-primary leading-[1.5] font-medium">
            {entry.tagline}
          </div>
        </div>
      </div>
    </section>
  );
}
