import { anton } from "./data/anton";
import { babyDream } from "./data/baby-dream";
import { bloodDream } from "./data/blood-dream";
import { careerSaju } from "./data/career-saju";
import { chasedDream } from "./data/chased-dream";
import { deathDream } from "./data/death-dream";
import { dogDream } from "./data/dog-dream";
import { fallingDream } from "./data/falling-dream";
import { hairDream } from "./data/hair-dream";
import { houseDream } from "./data/house-dream";
import { dombokSaju } from "./data/dombok-saju";
import { dragonDream } from "./data/dragon-dream";
import { exLoverDream } from "./data/ex-lover-dream";
import { catDream } from "./data/cat-dream";
import { fireDream } from "./data/fire-dream";
import { fishDream } from "./data/fish-dream";
import { hanSohee } from "./data/hansohee";
import { jennie } from "./data/jennie";
import { kimSoohyun } from "./data/kimsoohyun";
import { kimTaeri } from "./data/kimtaeri";
import { byeonWooseok } from "./data/byeonwooseok";
import { weddingDream } from "./data/wedding-dream";
import { iljiSpouse } from "./data/ilji-spouse";
import { iljuPersonality } from "./data/ilju-personality";
import { mutoIlganWoman } from "./data/muto-ilgan-woman";
import { gapmokIlganWoman } from "./data/gapmok-ilgan-woman";
import { eulmokIlganWoman } from "./data/eulmok-ilgan-woman";
import { byeonghwaIlganWoman } from "./data/byeonghwa-ilgan-woman";
import { jeonghwaIlganWoman } from "./data/jeonghwa-ilgan-woman";
import { gitoIlganWoman } from "./data/gito-ilgan-woman";
import { gyeonggeumIlganWoman } from "./data/gyeonggeum-ilgan-woman";
import { singeumIlganWoman } from "./data/singeum-ilgan-woman";
import { imsuIlganWoman } from "./data/imsu-ilgan-woman";
import { gyesuIlganWoman } from "./data/gyesu-ilgan-woman";
import { mutoIlganMan } from "./data/muto-ilgan-man";
import { gapmokIlganMan } from "./data/gapmok-ilgan-man";
import { eulmokIlganMan } from "./data/eulmok-ilgan-man";
import { byeonghwaIlganMan } from "./data/byeonghwa-ilgan-man";
import { jeonghwaIlganMan } from "./data/jeonghwa-ilgan-man";
import { gitoIlganMan } from "./data/gito-ilgan-man";
import { gyeonggeumIlganMan } from "./data/gyeonggeum-ilgan-man";
import { singeumIlganMan } from "./data/singeum-ilgan-man";
import { imsuIlganMan } from "./data/imsu-ilgan-man";
import { gyesuIlganMan } from "./data/gyesu-ilgan-man";
import { imYoungwoong } from "./data/imyoungwoong";
import { iu } from "./data/iu";
import { chaeunwoo } from "./data/chaeunwoo";
import { jungkook } from "./data/jungkook";
import { jungwon } from "./data/jungwon";
import { karina } from "./data/karina";
import { minji } from "./data/minji";
import { songgain } from "./data/songgain";
import { youngtak } from "./data/youngtak";
import { lastingCouple } from "./data/lasting-couple";
import { leeChanwon } from "./data/leechanwon";
import { marriageCaution } from "./data/marriage-caution";
import { moneyDream } from "./data/money-dream";
import { pigDream } from "./data/pig-dream";
import { poopDream } from "./data/poop-dream";
import { pregnancyDream } from "./data/pregnancy-dream";
import { ghostDream } from "./data/ghost-dream";
import { deadPersonDream } from "./data/dead-person-dream";
import { bugDream } from "./data/bug-dream";
import { fightDream } from "./data/fight-dream";
import { seaDream } from "./data/sea-dream";
import { flyingDream } from "./data/flying-dream";
import { examDream } from "./data/exam-dream";
import { spiderDream } from "./data/spider-dream";
import { ratDream } from "./data/rat-dream";
import { theftDream } from "./data/theft-dream";
import { rich2026Saju } from "./data/rich-2026-saju";
import { savingsSaju } from "./data/savings-saju";
import { seongHanbin } from "./data/seonghanbin";
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
  babyDream,
  bloodDream,
  careerSaju,
  fallingDream,
  hairDream,
  houseDream,
  hanSohee,
  jennie,
  kimSoohyun,
  kimTaeri,
  byeonWooseok,
  chasedDream,
  dogDream,
  catDream,
  deathDream,
  dombokSaju,
  dragonDream,
  exLoverDream,
  fishDream,
  weddingDream,
  fireDream,
  iljiSpouse,
  iljuPersonality,
  mutoIlganWoman,
  gapmokIlganWoman,
  eulmokIlganWoman,
  byeonghwaIlganWoman,
  jeonghwaIlganWoman,
  gitoIlganWoman,
  gyeonggeumIlganWoman,
  singeumIlganWoman,
  imsuIlganWoman,
  gyesuIlganWoman,
  mutoIlganMan,
  gapmokIlganMan,
  eulmokIlganMan,
  byeonghwaIlganMan,
  jeonghwaIlganMan,
  gitoIlganMan,
  gyeonggeumIlganMan,
  singeumIlganMan,
  imsuIlganMan,
  gyesuIlganMan,
  imYoungwoong,
  iu,
  jungwon,
  karina,
  chaeunwoo,
  jungkook,
  minji,
  songgain,
  youngtak,
  lastingCouple,
  leeChanwon,
  marriageCaution,
  moneyDream,
  pigDream,
  poopDream,
  pregnancyDream,
  ghostDream,
  deadPersonDream,
  bugDream,
  fightDream,
  seaDream,
  flyingDream,
  examDream,
  spiderDream,
  ratDream,
  theftDream,
  rich2026Saju,
  savingsSaju,
  seongHanbin,
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
      } else if (b.kind === "faq") {
        if (b.title) parts.push(b.title);
        for (const item of b.items) {
          parts.push(item.q, item.a);
        }
      }
    }
  }
  const chars = parts.join(" ").replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / 450));
}

export function getFaqItems(story: Story): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (const s of story.sections) {
    for (const b of s.blocks) {
      if (b.kind === "faq") out.push(...b.items);
    }
  }
  return out;
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
