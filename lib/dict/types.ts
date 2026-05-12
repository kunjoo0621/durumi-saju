import type {
  KoreanElement,
  KoreanYinYang,
} from "@/lib/utils/saju-enrichment";

export type DictCategory =
  | "saju"
  | "pillars"
  | "cheongan"
  | "jiji"
  | "gabja"
  | "ohaeng"
  | "sipsung"
  | "unseong12"
  | "gangyak"
  | "yongshin"
  | "gyeokguk"
  | "relation"
  | "sinsal"
  | "sipisinsal";

export const DICT_CATEGORY_LABEL: Record<DictCategory, string> = {
  saju: "사주 입문",
  pillars: "4기둥",
  cheongan: "천간",
  jiji: "지지",
  gabja: "60갑자",
  ohaeng: "오행",
  sipsung: "십성",
  unseong12: "12운성",
  gangyak: "강약",
  yongshin: "용신",
  gyeokguk: "격국",
  relation: "합충형",
  sinsal: "신살",
  sipisinsal: "12신살",
};

export interface DictMeta {
  title: string;
  description: string;
}

export interface DictRelated {
  category: DictCategory;
  slug: string;
  label: string;
  hint?: string;
}

export interface DictFAQ {
  q: string;
  a: string;
}

export interface DictBodySection {
  heading: string;
  paragraphs: string[];
}

export interface DictBody {
  intro: string;
  sections: DictBodySection[];
}

export interface DictHighlight {
  label: string;
  value: string;
}

export interface CharCard {
  char: string;
  hanja: string;
  element?: KoreanElement;
  yinYang?: KoreanYinYang;
  jijanggan?: { stem: string; korean: string; weight: number }[];
}

export type DictHero =
  | {
      variant: "combination";
      leftLabel: string;
      rightLabel: string;
      left: CharCard;
      right: CharCard;
      orderLabel?: string;
    }
  | {
      variant: "single-char";
      char: string;
      hanja: string;
      element?: KoreanElement;
      yinYang?: KoreanYinYang;
      orderLabel?: string;
    }
  | {
      variant: "concept";
      accentColor?: string;
      orderLabel?: string;
    };

export interface DictEntry {
  category: DictCategory;
  slug: string;
  name: string;
  hanja: string;
  tagline: string;
  meta: DictMeta;
  hero: DictHero;
  highlight: DictHighlight[];
  body: DictBody;
  faq: DictFAQ[];
  related: DictRelated[];
  updatedAt: string;
}
