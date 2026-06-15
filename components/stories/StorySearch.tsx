"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MagnifyingGlass, X, Hourglass } from "@phosphor-icons/react";
import { STORY_CATEGORY_HANDLE, type StoryCategory } from "@/lib/stories/types";
import StoryArt from "./StoryArt";

export type SearchItem = {
  slug: string;
  title: string;
  excerpt: string;
  category: StoryCategory;
  tagLabels: string[];
  keywords: string[];
  readingMin: number;
  hero: { src: string; alt: string } | null;
};

const CHO = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

/** 한글 음절 → 초성 문자열. "임영웅" → "ㅇㅇㅇ" */
function chosung(str: string): string {
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHO[Math.floor((code - 0xac00) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export default function StorySearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState("");
  const query = q.trim();

  const results = useMemo(() => {
    if (!query) return [];
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
    const isCho = /^[ㄱ-ㅎ]+$/.test(query.replace(/\s+/g, ""));
    const choQ = query.replace(/\s+/g, "");
    return items
      .filter((it) => {
        const hay = norm(
          `${it.title} ${it.excerpt} ${it.tagLabels.join(" ")} ${it.keywords.join(" ")}`,
        );
        if (tokens.every((t) => hay.includes(t))) return true;
        if (isCho && chosung(it.title).includes(choQ)) return true;
        return false;
      })
      .slice(0, 40);
  }, [query, items]);

  return (
    <div>
      <div className="relative">
        <MagnifyingGlass
          size={18}
          weight="bold"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목·연예인·일주·태그로 검색 (예: 임영웅, 정화, 궁합)"
          aria-label="매거진 검색"
          className="w-full rounded-2xl bg-white/[0.05] border border-white/10 focus:border-[#FF6B6B]/60 focus:bg-white/[0.07] outline-none !pl-11 !pr-10 !py-3.5 text-[15px] text-text-primary placeholder:text-text-tertiary transition-colors"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 active:bg-white/[0.15] transition-colors"
          >
            <X size={15} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>

      {query && (
        <div className="mt-4">
          <div className="text-[12px] text-text-tertiary mb-2">
            {results.length > 0
              ? `'${query}' 검색 결과 ${results.length}개`
              : `'${query}' 검색 결과가 없어요`}
          </div>

          {results.length > 0 ? (
            <div className="divide-y divide-white/[0.07]">
              {results.map((it) => (
                <Link
                  key={it.slug}
                  href={`/stories/${it.slug}`}
                  className="group flex gap-4 items-start py-4 transition-opacity hover:opacity-90 active:opacity-80"
                >
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-aggro text-text-primary text-[16px] leading-[1.3] tracking-tight line-clamp-2 mb-1.5"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {it.title}
                    </h3>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] text-text-tertiary">
                      <span>{STORY_CATEGORY_HANDLE[it.category]}</span>
                      <span className="text-white/20" aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Hourglass size={12} weight="regular" aria-hidden="true" />
                        {it.readingMin}분
                      </span>
                    </div>
                  </div>
                  {it.hero ? (
                    <div className="shrink-0 w-[72px] aspect-square relative overflow-hidden rounded-xl bg-white/[0.04]">
                      <Image
                        src={it.hero.src}
                        alt={it.hero.alt}
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <StoryArt
                      category={it.category}
                      size="card"
                      className="shrink-0 w-[72px] aspect-square"
                    />
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-text-tertiary leading-[1.7] py-3">
              다른 키워드로 찾아보거나, 아래 태그·시리즈에서 둘러보세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
