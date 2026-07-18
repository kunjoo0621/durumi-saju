// ④ 사주 사전 — 리스트 행(썸네일 1:1 + 제목 + 분류, 숫자 없음). <Link> 서버 렌더(SEO).
import Link from "next/link";
import Reveal from "./Reveal";
import DictThumb from "./DictThumb";
import { HUB_DICT_ITEMS, HUB_PRESS } from "./services";
import { DICT_CATEGORY_LABEL } from "@/lib/dict/types";

export default function DictList() {
  return (
    <Reveal className="px-5 pt-10">
      <p className="text-[12px] font-medium text-text-tertiary">이 말, 무슨 뜻일까?</p>
      <h2 className="mb-2 font-aggro text-[22px]">알아두면 재밌는 사주 사전</h2>
      <div className="-mx-1">
        {HUB_DICT_ITEMS.slice(0, 5).map((it) => (
          <Link
            key={`${it.category}/${it.slug}`}
            href={`/dict/${it.category}/${it.slug}`}
            className={`${HUB_PRESS} flex items-center gap-3.5 rounded-2xl px-1 py-2.5`}
          >
            <DictThumb label={it.label} thumbSrc={`/images/hub/dict/${it.slug}.webp`} />
            <div className="min-w-0 flex-1">
              <h3 className="break-keep text-[16px] font-bold leading-[1.35]">{it.label}</h3>
              <p className="mt-0.5 text-[12.5px] text-text-tertiary">
                {DICT_CATEGORY_LABEL[it.category]}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/dict"
        className="mt-3 block w-full rounded-2xl bg-white/[0.04] py-3 text-center text-[14px] text-text-secondary"
      >
        사전 전체 보기 →
      </Link>
    </Reveal>
  );
}
