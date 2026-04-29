import { ELEMENT_HEX, ELEMENT_TINT, ELEMENT_HANJA } from "@/lib/dict/colors";
import type { CharCard, DictEntry } from "@/lib/dict/types";

function PillarCard({
  position,
  card,
}: {
  position: string;
  card: CharCard;
}) {
  const hex = card.element ? ELEMENT_HEX[card.element] : "#A0A0A0";
  const tint = card.element ? ELEMENT_TINT[card.element] : "rgba(255,255,255,0.04)";
  const yinYangChar = card.yinYang === "양" ? "陽" : card.yinYang === "음" ? "陰" : "";

  return (
    <div
      className="flex-1 rounded-2xl pt-9 pb-6 sm:pt-11 sm:pb-7 text-center relative overflow-hidden"
      style={{
        backgroundColor: tint,
        border: `1px solid ${hex}33`,
      }}
    >
      <div className="absolute top-3 left-4 text-[10px] tracking-[0.15em] text-text-tertiary">
        {position}
      </div>
      {yinYangChar && (
        <div
          className="absolute top-3 right-4 text-[10px] tracking-[0.15em] font-medium"
          style={{ color: `${hex}AA` }}
        >
          {yinYangChar}
        </div>
      )}

      <div
        className="font-aggro leading-none text-[64px] sm:text-[80px] mb-1.5"
        style={{
          color: hex,
          textShadow: `0 0 32px ${hex}55`,
        }}
      >
        {card.char}
      </div>
      <div className="text-[18px] sm:text-[20px] text-text-secondary mb-3 font-light tracking-wider">
        {card.hanja}
      </div>

      {card.element && (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/30">
          <span
            className="text-[11px] tracking-wider font-medium"
            style={{ color: hex }}
          >
            {card.element}
          </span>
          <span className="text-[10px] text-text-tertiary">
            {ELEMENT_HANJA[card.element]}
          </span>
        </div>
      )}
    </div>
  );
}

export default function CombinationHero({ entry }: { entry: DictEntry }) {
  if (entry.hero.variant !== "combination") return null;
  const { left, right, leftLabel, rightLabel, orderLabel } = entry.hero;

  return (
    <section className="pt-2 pb-2">
      {orderLabel && (
        <div className="text-[12px] tracking-[0.18em] text-[#FF6B6B] font-semibold mb-3 uppercase">
          {orderLabel}
        </div>
      )}

      <h1 className="text-display font-aggro text-text-primary leading-[1.15] mb-2">
        {entry.name}
        <span className="text-title-2 text-text-tertiary font-light ml-2.5 tracking-wider align-middle">
          {entry.hanja}
        </span>
      </h1>

      <p className="text-body-2 text-text-secondary leading-[1.7] mb-6">
        {entry.tagline}
      </p>

      <div className="flex gap-3 sm:gap-4">
        <PillarCard position={leftLabel} card={left} />
        <PillarCard position={rightLabel} card={right} />
      </div>
    </section>
  );
}
