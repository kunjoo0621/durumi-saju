"use client";

import { Egg, Star, Fire, Diamond } from "@phosphor-icons/react";
import type { CoinPackage, CoinPackageIcon } from "@/lib/constants/coins";

const PACKAGE_ICONS: Record<CoinPackageIcon, React.ElementType> = {
  star: Star,
  fire: Fire,
  diamond: Diamond,
};

interface CoinPackageCardProps {
  pkg: CoinPackage;
  onClick: () => void;
  disabled?: boolean;
}

export default function CoinPackageCard({ pkg, onClick, disabled }: CoinPackageCardProps) {
  const Icon = PACKAGE_ICONS[pkg.icon];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group w-full rounded-2xl p-4 text-left transition-[transform,background-color,color] duration-200 active:scale-[0.97] disabled:opacity-50 bg-background-secondary hover:bg-[rgb(30,30,33)] ${
        pkg.highlight ? "ring-1 ring-primary/40" : ""
      }`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-active:scale-110 ${
            pkg.highlight ? "bg-primary/10" : "bg-white/[0.06]"
          }`}>
            <Icon size={20} weight="fill" className={
              pkg.highlight ? "text-primary" : "text-text-secondary"
            } />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-text-primary">
                {pkg.label}
              </span>
              {pkg.highlight && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  BEST
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[14px] text-text-secondary flex items-center gap-1">
                <Egg size={14} weight="fill" /> {pkg.coinAmount}알
              </span>
              {pkg.bonusAmount > 0 && (
                <span className="text-[14px] font-semibold text-primary">
                  +{pkg.bonusAmount}알
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="text-[16px] font-bold text-text-primary shrink-0 group-hover:text-primary transition-colors duration-200">
          {pkg.price.toLocaleString()}원
        </span>
      </div>
    </button>
  );
}
