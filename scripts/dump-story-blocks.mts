/**
 * 매거진 Story → 형제 교차복제 검사용 블록 덤프.
 *
 * 왜 있는가: 블로그에는 `durumi-blog/harness/sibling_check.py`가 있는데 매거진에는
 * 없었다. 2026-08-10 신작 rain-dream이 기존 발행글 bird-dream과 4-gram 16.2%로
 * 복제됐는데 verify-story.mts가 그대로 통과시켰다(dup_check는 원본 .ts 1:1 대조라
 * 소스 없는 신작엔 아예 적용되지 않는다). 형제 클론은 블로그만의 사고가 아니다.
 *
 * 같은 엔진을 재사용하려고 Story를 블로그 글의 블록 튜플 포맷으로 변환한다.
 *   {"title": "...", "blocks": [["p","..."],["h","..."],["quote","..."],["card","..."]]}
 *
 * 사용:
 *   npx tsx scripts/dump-story-blocks.mts [--out <dir>]
 *   기본 출력 = .cache/story-blocks/
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

import * as registryMod from "../lib/stories/registry";
import type { Story, StoryBlock } from "../lib/stories/types";

function unwrap<T>(ns: unknown): T {
  const n = ns as Record<string, unknown>;
  return (n.default && typeof n.default === "object" ? n.default : n) as T;
}
const { getAllStories } = unwrap<typeof registryMod>(registryMod);

/** 매거진 마크다운 흔적 제거 — 블로그 글은 평문이라 정규화를 맞춘다. */
function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // [표시](/dict/…) → 표시
    .replace(/\*\*/g, "")
    .trim();
}

function toBlocks(story: Story): string[][] {
  const out: string[][] = [];
  // intro는 블로그의 오프너에 해당한다 — 오프닝 존 비교에 반드시 들어가야 한다.
  for (const para of (story.intro ?? "").split("\n\n")) {
    if (para.trim()) out.push(["p", plain(para)]);
  }
  for (const sec of story.sections ?? []) {
    if (sec.heading) out.push(["h", plain(sec.heading)]);
    for (const b of (sec.blocks ?? []) as StoryBlock[]) {
      const k = (b as { kind: string }).kind;
      if (k === "p") out.push(["p", plain((b as { text: string }).text)]);
      else if (k === "callout") out.push(["quote", plain((b as { text: string }).text)]);
      else if (k === "image") {
        const cap = (b as { caption?: string }).caption;
        if (cap) out.push(["p", plain(cap)]);   // 캡션도 복제 대상이다(실제로 겹쳤다)
      } else if (k === "checklist") {
        const c = b as { title?: string; items?: string[] };
        if (c.title) out.push(["p", plain(c.title)]);
        for (const it of c.items ?? []) out.push(["p", plain(it)]);
      } else if (k === "table") {
        const t = b as { headers?: string[]; rows?: string[][]; caption?: string };
        if (t.headers?.length) out.push(["p", plain(t.headers.join(" · "))]);
        for (const r of t.rows ?? []) out.push(["p", plain(r.join(" · "))]);
        if (t.caption) out.push(["p", plain(t.caption)]);
      } else if (k === "faq") {
        for (const item of (b as { items?: { q: string; a: string }[] }).items ?? []) {
          out.push(["p", plain(item.q)]);   // is_search_anchor가 '?'로 걸러 세트 비교로만 쓴다
          out.push(["p", plain(item.a)]);
        }
      }
    }
  }
  if (story.cta?.label) out.push(["card", plain(story.cta.label)]);
  return out;
}

const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const OUT = path.resolve(
  import.meta.dirname,
  "..",
  oi >= 0 && args[oi + 1] ? args[oi + 1] : ".cache/story-blocks",
);

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const stories = getAllStories();
for (const s of stories) {
  writeFileSync(
    path.join(OUT, `${s.slug}.json`),
    JSON.stringify({ title: s.title, blocks: toBlocks(s) }, null, 0),
    "utf-8",
  );
}
console.log(`덤프 ${stories.length}편 → ${OUT}`);
