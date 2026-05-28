import {
  BookOpenText,
  Moon,
  HeartStraight,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { STORY_CATEGORY_ART } from "@/lib/stories/types";
import type { StoryCategory } from "@/lib/stories/types";

const ICON_MAP: Record<string, Icon> = {
  BookOpenText,
  Moon,
  HeartStraight,
  Star,
};

interface Props {
  category: StoryCategory;
  size?: "card" | "feature" | "header";
  className?: string;
}

/**
 * 토스피드풍 카드 일러스트 슬롯.
 * 파스텔 단색 블록 + 검은(잉크) 아이콘 — 손그림 일러스트가 준비되면 이 자리 교체.
 *
 * size:
 *  - card    : 일반 카드 (가로 카드의 우측 블록)
 *  - feature : Featured 카드 (좀 더 큼)
 *  - header  : (보존용) 본문 상단 — 현재 본문은 헤더 썸네일 미사용
 */
export default function StoryArt({ category, size = "card", className }: Props) {
  const art = STORY_CATEGORY_ART[category];
  const Icon = ICON_MAP[art.icon] ?? BookOpenText;

  // 블록 자체의 padding/사이즈는 부모(aspect ratio) 결정.
  // 아이콘 사이즈는 size 모드에 따라 비율 조정.
  const iconSize =
    size === "header" ? 96 : size === "feature" ? 72 : 52;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl flex items-center justify-center ${className ?? ""}`}
      style={{ background: art.bg }}
      aria-hidden="true"
    >
      <Icon size={iconSize} weight="duotone" color={art.ink} />
    </div>
  );
}
