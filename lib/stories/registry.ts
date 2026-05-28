import { anton } from "./data/anton";
import { careerSaju } from "./data/career-saju";
import { dombokSaju } from "./data/dombok-saju";
import { dragonDream } from "./data/dragon-dream";
import { fireDream } from "./data/fire-dream";
import { iljiSpouse } from "./data/ilji-spouse";
import { iljuPersonality } from "./data/ilju-personality";
import { imYoungwoong } from "./data/imyoungwoong";
import { iu } from "./data/iu";
import { jungwon } from "./data/jungwon";
import { lastingCouple } from "./data/lasting-couple";
import { leeChanwon } from "./data/leechanwon";
import { marriageCaution } from "./data/marriage-caution";
import { moneyDream } from "./data/money-dream";
import { pigDream } from "./data/pig-dream";
import { poopDream } from "./data/poop-dream";
import { pregnancyDream } from "./data/pregnancy-dream";
import { rich2026Saju } from "./data/rich-2026-saju";
import { savingsSaju } from "./data/savings-saju";
import { snakeDream } from "./data/snake-dream";
import { sungchan } from "./data/sungchan";
import { tigerDream } from "./data/tiger-dream";
import { toothDream } from "./data/tooth-dream";
import { waterDream } from "./data/water-dream";
import { wonyoung } from "./data/wonyoung";
import { yeonaePattern } from "./data/yeonae-pattern";
import { zhangHao } from "./data/zhanghao";
import { zodiacVsMyeongni } from "./data/zodiac-vs-myeongni";
import type { Story, StoryCategory } from "./types";

const STORIES: Story[] = [
  anton,
  careerSaju,
  dombokSaju,
  dragonDream,
  fireDream,
  iljiSpouse,
  iljuPersonality,
  imYoungwoong,
  iu,
  jungwon,
  lastingCouple,
  leeChanwon,
  marriageCaution,
  moneyDream,
  pigDream,
  poopDream,
  pregnancyDream,
  rich2026Saju,
  savingsSaju,
  snakeDream,
  sungchan,
  tigerDream,
  toothDream,
  waterDream,
  wonyoung,
  yeonaePattern,
  zhangHao,
  zodiacVsMyeongni,
];

const SLUG_MAP: Record<string, Story> = STORIES.reduce<Record<string, Story>>(
  (acc, story) => {
    acc[story.slug] = story;
    return acc;
  },
  {},
);

const SORTED_STORIES: readonly Story[] = [...STORIES].sort((a, b) =>
  a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0,
);

export function getAllStories(): Story[] {
  return [...SORTED_STORIES];
}

export function getStoriesByCategory(category: StoryCategory): Story[] {
  return getAllStories().filter((s) => s.category === category);
}

export function getStoryBySlug(slug: string): Story | undefined {
  return SLUG_MAP[slug];
}

export function getReadingMinutes(story: Story): number {
  const parts: string[] = [story.intro];
  for (const s of story.sections) {
    parts.push(s.heading);
    for (const b of s.blocks) {
      if (b.kind === "p" || b.kind === "callout") parts.push(b.text);
      else if (b.kind === "checklist") {
        if (b.title) parts.push(b.title);
        parts.push(...b.items);
      } else if (b.kind === "table") {
        parts.push(...b.headers);
        for (const row of b.rows) parts.push(...row);
        if (b.caption) parts.push(b.caption);
      }
    }
  }
  const chars = parts.join(" ").replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / 450));
}

export function getRelatedStories(story: Story, limit = 3): Story[] {
  if (!story.related?.length) {
    return getAllStories()
      .filter((s) => s.slug !== story.slug && s.category === story.category)
      .slice(0, limit);
  }
  const picked = story.related
    .map((slug) => SLUG_MAP[slug])
    .filter((s): s is Story => Boolean(s) && s.slug !== story.slug);
  if (picked.length >= limit) return picked.slice(0, limit);
  const fallback = getAllStories().filter(
    (s) => s.slug !== story.slug && !picked.includes(s),
  );
  return [...picked, ...fallback].slice(0, limit);
}
