import { ELEMENT_HEX, ELEMENT_TINT, ELEMENT_HANJA } from "@/lib/dict/colors";
import type { DictEntry } from "@/lib/dict/types";

export default function SingleCharHero({ entry }: { entry: DictEntry }) {
  if (entry.hero.variant !== "single-char") return null;
  const { char, hanja, element, yinYang, orderLabel } = entry.hero;

  const hex = element ? ELEMENT_HEX[element] : "#A0A0A0";
  const tint = element ? ELEMENT_TINT[element] : "rgba(255,255,255,0.04)";
  const yinYangChar = yinYang === "양" ? "陽" : yinYang === "음" ? "陰" : "";

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

      <div
        className="rounded-2xl pt-12 pb-9 sm:pt-14 sm:pb-11 text-center relative overflow-hidden"
        style={{
          backgroundColor: tint,
          border: `1px solid ${hex}33`,
        }}
      >
        {yinYangChar && (
          <div
            className="absolute top-4 right-5 text-[11px] tracking-[0.18em] font-medium"
            style={{ color: `${hex}AA` }}
          >
            {yinYangChar}
          </div>
        )}

        <div
          className="font-aggro leading-none text-[112px] sm:text-[140px] mb-3"
          style={{
            color: hex,
            textShadow: `0 0 56px ${hex}55`,
          }}
        >
          {char}
        </div>
        <div className="text-[24px] sm:text-[28px] text-text-secondary mb-5 font-light tracking-wider">
          {hanja}
        </div>

        {element && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30">
            <span
              className="text-[12px] tracking-wider font-medium"
              style={{ color: hex }}
            >
              {element}
            </span>
            <span className="text-[11px] text-text-tertiary">
              {ELEMENT_HANJA[element]}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
