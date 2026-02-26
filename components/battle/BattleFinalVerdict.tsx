"use client";

type Props = {
  finalVerdict: string;
};

export default function BattleFinalVerdict({ finalVerdict }: Props) {
  if (!finalVerdict) return null;

  return (
    <div className="rounded-2xl overflow-hidden flex" style={{ backgroundColor: "#141414" }}>
      <div className="w-1 shrink-0" style={{ backgroundColor: "#FF6B6B" }} />
      <div className="p-6 flex-1">
        <h3 className="text-lg font-bold text-text-primary mb-4">두루미의 최종 심판</h3>
        <p className="text-base text-gray-300 leading-7">{finalVerdict}</p>
      </div>
    </div>
  );
}
