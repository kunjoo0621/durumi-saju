import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export default function CTABlock({
  name,
  category,
}: {
  name: string;
  category: string;
}) {
  return (
    <Link
      href="/start"
      className="group block w-full rounded-2xl px-6 py-7 sm:py-8 text-center bg-gradient-to-br from-[#FF6B6B] to-[#FF4757] hover:from-[#FF7A7A] hover:to-[#FF5566] active:scale-[0.99] transition-all duration-200 shadow-[0_8px_32px_-8px_rgba(255,107,107,0.4)]"
    >
      <div className="text-[15px] sm:text-[17px] font-semibold text-white mb-1.5">
        내 사주에 {name} {category}가 있나요?
      </div>
      <div className="inline-flex items-center gap-1.5 text-[13px] text-white/85 group-hover:text-white">
        <span>지금 사주 분석 시작하기</span>
        <ArrowRight size={14} weight="bold" className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
