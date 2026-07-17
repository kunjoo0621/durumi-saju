// 사전 리스트 썸네일(4:3). visu 이미지 도착 전 임시 = 대표 글자 타일(DS 토큰만).
import Image from "next/image";

export default function DictThumb({
  label,
  thumbSrc,
}: {
  label: string;
  thumbSrc?: string;
}) {
  if (thumbSrc) {
    return (
      <div className="relative aspect-[4/3] w-[112px] shrink-0 overflow-hidden rounded-2xl bg-background-secondary">
        <Image src={thumbSrc} alt="" fill sizes="112px" className="object-cover" />
      </div>
    );
  }
  const ch = label.trim().charAt(0) || "?";
  return (
    <div className="grid aspect-[4/3] w-[112px] shrink-0 place-items-center rounded-2xl bg-white/[0.04]">
      <span className="font-aggro text-[28px] text-text-secondary">{ch}</span>
    </div>
  );
}
