// 통합 허브 정적 config — 순수 데이터(서버/클라 공용). "use client" 없음.
import type { DictCategory } from "@/lib/dict/types";

// 프레스 스프링(목업 .press) — globals.css 무수정, Tailwind 인라인.
export const HUB_PRESS =
  "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97]";

export type HubServiceId = "saju" | "battle" | "yearly" | "pet" | "today" | "marriage" | "wealth" | "career";

export interface HubHeroSlide {
  id: HubServiceId;
  src: string;
  alt: string;
}

// 히어로 캐러셀 — 제목 baked 시네마틱 포스터(2:3). 대표 3종(사주·배틀·올해)만.
export const HUB_HERO_SLIDES: HubHeroSlide[] = [
  { id: "saju", src: "/images/hub/saju-grade.webp", alt: "내 사주 등급 — 나는 과연 몇 등급일까?" },
  { id: "battle", src: "/images/hub/battle.webp", alt: "사주 배틀 — 누구의 사주가 더 강할까?" },
  { id: "yearly", src: "/images/hub/yearly.webp", alt: "2026년 운세 — 올 한 해, 나에게 무슨 일이?" },
];

// 서비스 카드 썸네일(4:5) — 포스터 재사용(§2-1: 임시 object-bottom 크롭, 후속 *-notitle 교체 예정)
export const HUB_SERVICE_THUMB: Record<HubServiceId, string> = {
  saju: "/images/hub/saju-grade.webp",
  battle: "/images/hub/battle.webp",
  yearly: "/images/hub/yearly.webp",
  pet: "/images/hub/pet.webp",
  today: "/images/hub/today.webp",
  marriage: "/images/marriage/marriage-poster.webp",
  wealth: "/images/wealth/wealth-poster.webp",
  career: "/images/career/career-poster.webp",
};

// 연예인 사주 — stories 슬러그(목업 순서). 이름·직업·초상은 서버에서 getStoryBySlug로 주입.
export const HUB_CELEBRITY_SLUGS = [
  "imyoungwoong",
  "sontaejin",
  "anseonghun",
  "jungdongwon",
  "leechanwon",
];

export interface HubDictItem {
  label: string; // 카드 노출 편집 제목
  category: DictCategory;
  slug: string;
}

// 사주 사전 — 실검색 상위 5개(검색 콘솔 TOP, 브랜드 제외). 전부 dict 엔트리 존재 검증.
// 라벨에 검색 키워드를 그대로 담아 SEO 관련성 유지.
export const HUB_DICT_ITEMS: HubDictItem[] = [
  { label: "정임합, 어떤 인연일까", category: "relation", slug: "jeongim-hap" },
  { label: "병신합, 어떤 인연일까", category: "relation", slug: "byeongsin-hap" },
  { label: "천살, 하늘이 내린 시련", category: "sipisinsal", slug: "cheonsal" },
  { label: "경진일주, 나는 어떤 사람", category: "gabja", slug: "gyeongjin" },
  { label: "중화신강이 뭘까", category: "gangyak", slug: "singang" },
];
