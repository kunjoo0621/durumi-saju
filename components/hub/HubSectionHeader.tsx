// 캐러셀 섹션 헤더(hero·service·celebrity 공용) — eyebrow + aggro 제목 + 선택적 "전체 보기".
// 리스트 섹션(사전·매거진)은 px-5 섹션 안에 헤더를 직접 두므로 이 컴포넌트를 쓰지 않는다.
import Link from "next/link";

export default function HubSectionHeader({
  eyebrow,
  title,
  moreHref,
  moreLabel = "전체 보기 →",
}: {
  eyebrow: string;
  title: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between px-5">
      <div>
        <p className="text-[12px] font-medium text-text-tertiary">{eyebrow}</p>
        <h2 className="font-aggro text-[22px]">{title}</h2>
      </div>
      {moreHref ? (
        <Link href={moreHref} className="shrink-0 pb-1 text-[13px] text-text-secondary">
          {moreLabel}
        </Link>
      ) : null}
    </div>
  );
}
