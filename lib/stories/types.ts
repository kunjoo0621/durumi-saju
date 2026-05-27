export type StoryCategory = "saju" | "dream" | "love";

export const STORY_CATEGORY_LABEL: Record<StoryCategory, string> = {
  saju: "사주 이야기",
  dream: "꿈해몽",
  love: "운세·궁합",
};

export const STORY_CATEGORY_TAGLINE: Record<StoryCategory, string> = {
  saju: "사주에 대해 몰랐던 이야기들",
  dream: "꿈에 나온 그 장면, 정말 그런 뜻일까?",
  love: "연애·궁합·재물·일운에 대한 이야기",
};

/**
 * 카테고리별 카드 일러스트 — 토스피드풍 파스텔 블록 + 아이콘.
 * 진짜 손그림 일러스트가 들어올 때까지의 임시 비주얼.
 * 아이콘 이름은 Phosphor("@phosphor-icons/react") 컴포넌트명과 1:1 매칭.
 */
export const STORY_CATEGORY_ART: Record<
  StoryCategory,
  { bg: string; icon: "BookOpenText" | "Moon" | "HeartStraight"; ink: string }
> = {
  saju: { bg: "#D8B4FE", icon: "BookOpenText", ink: "#1F1147" },
  dream: { bg: "#FDE68A", icon: "Moon", ink: "#3F2A05" },
  love: { bg: "#FDA4AF", icon: "HeartStraight", ink: "#481125" },
};

/** 카테고리 핸들 — 카드 메타 라인의 짧은 라벨 */
export const STORY_CATEGORY_HANDLE: Record<StoryCategory, string> = {
  saju: "사주 이야기",
  dream: "꿈해몽",
  love: "운세·궁합",
};

export type StoryCTA = {
  /** 본문 안에서 노출되는 짧은 한 줄 문구 (예: "내 재물운 등급도 확인해보기") */
  label: string;
  /** 이동 경로 (예: /start, /battle/input) */
  href: string;
  /** 강조 색상 — undefined면 브랜드 컬러 */
  tone?: "brand" | "earth" | "love";
};

/**
 * 본문 블록 — 단락/표/체크리스트/콜아웃.
 * 같은 섹션 안에서 순서대로 렌더된다.
 */
export type StoryBlock =
  | { kind: "p"; text: string }
  | {
      kind: "table";
      headers: string[];
      rows: string[][];
      caption?: string;
    }
  | {
      kind: "checklist";
      title?: string;
      items: string[];
      tone?: "good" | "warn";
    }
  | {
      kind: "callout";
      tone?: "tip" | "warn";
      text: string;
    };

export type StorySection = {
  heading: string;
  blocks: StoryBlock[];
};

export type StoryHeroImage = {
  /** /stories/heroes/{slug}.png 같은 public 절대 경로 */
  src: string;
  /** SEO·접근성용 alt */
  alt: string;
};

export type Story = {
  slug: string;
  category: StoryCategory;
  title: string;
  /** 카드/상세 상단에 노출되는 한 줄 요약 */
  excerpt: string;
  /** 본문 도입부 (한 단락) */
  intro: string;
  sections: StorySection[];
  /** 본문 중간 CTA — sections[ctaAfter]가 끝난 직후 삽입. -1이면 비활성 */
  ctaAfter?: number;
  /** 본문 하단 + 중간에서 공통으로 쓰는 전환 CTA */
  cta: StoryCTA;
  /** 관련 글 슬러그 (최대 3개) */
  related?: string[];
  /** SEO 키워드 (description fallback에 사용) */
  keywords?: string[];
  /**
   * Hero 이미지 — 글 상단에 16:9 big 비주얼로 박힘. 두루미 chibi 3D Pixar 결 통일.
   * 없으면 fallback 없이 hero 영역 미렌더 (제목·excerpt만).
   * OG·JSON-LD에도 이 이미지 사용.
   */
  heroImage?: StoryHeroImage;
  publishedAt: string;
  updatedAt: string;
};
