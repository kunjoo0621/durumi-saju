/**
 * 매거진 Story 검증기 — CONTENT_HARNESS_PLAN.md §7 구현 (Phase 4).
 *
 * registry를 실제로 import해서 검증한다(문자열 grep 아님).
 * 핵심은 M-DIC-01 — 본문의 [표시](/dict/…) 내부링크 실재 검증.
 * `next build`는 이 링크를 문자열로만 취급하므로 빌드가 통과해도 런타임 404가 난다.
 * 2026-07-27 대운 글 작업에서 실제로 손으로 전수 확인해야 했던 항목.
 *
 * 사용:
 *   npx tsx scripts/verify-story.mts <slug> [<slug>...]
 *   npx tsx scripts/verify-story.mts --all
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as registryMod from "../lib/stories/registry";
import * as tagsMod from "../lib/stories/tags";
import * as dictMod from "../lib/dict/registry";
import type { Story, StoryBlock } from "../lib/stories/types";

// 이 저장소는 node24 네이티브 TS 스트리핑 + tsx 조합에서 lib 모듈이 CJS로 해석돼
// named import가 깨지고 실제 export는 네임스페이스의 default 아래로 들어간다.
// (dump-celebrity-charts.mts가 네임스페이스 임포트를 쓰는 이유)
function unwrap<T>(ns: unknown): T {
  const n = ns as Record<string, unknown>;
  return (n.default && typeof n.default === "object" ? n.default : n) as T;
}
const { getAllStories, getStoryBySlug } = unwrap<typeof registryMod>(registryMod);
const { STORY_TAGS, TAG_META } = unwrap<typeof tagsMod>(tagsMod);
const { hasDictEntry } = unwrap<typeof dictMod>(dictMod);

const ROOT = path.resolve(import.meta.dirname, "..");
const BLOG_HARNESS = "/Users/kunjoo/projects/durumi-blog/harness";

type Row = { level: "FAIL" | "WARN" | "INFO"; rule: string; msg: string; ev?: string };

const CHEONGAN = ["갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수"];
const JOB_TAGS = ["트로트", "아이돌", "배우", "가수", "연예인"];
const NEGATIVE = ["어렵습니다", "안 좋아요", "나쁩니다", "단명", "안 됩니다", "불가능합니다", "실패합니다"];

function blockText(b: StoryBlock): string {
  switch (b.kind) {
    case "p":
      return b.text;
    case "callout":
      return b.text;
    case "checklist":
      return [b.title ?? "", ...b.items].join("\n");
    case "table":
      return [...b.headers, ...b.rows.flat(), b.caption ?? ""].join("\n");
    case "faq":
      return b.items.map((i) => `${i.q}\n${i.a}`).join("\n");
    case "image":
      return `${b.alt}\n${b.caption ?? ""}`;
    default:
      return "";
  }
}

function storyText(s: Story): string {
  return [s.title, s.excerpt, s.intro, ...s.sections.flatMap((sec) => [sec.heading, ...sec.blocks.map(blockText)])].join("\n");
}

function verify(slug: string): Row[] {
  const rows: Row[] = [];
  const fail = (rule: string, msg: string, ev?: string) => rows.push({ level: "FAIL", rule, msg, ev });
  const warn = (rule: string, msg: string, ev?: string) => rows.push({ level: "WARN", rule, msg, ev });
  const info = (rule: string, msg: string, ev?: string) => rows.push({ level: "INFO", rule, msg, ev });

  const story = getStoryBySlug(slug);
  if (!story) {
    fail("M-REG-01", `slug '${slug}' 가 registry(STORIES)에 없음 — 라우트가 생성되지 않는다`);
    return rows;
  }

  // ── 등록 ──
  const tags = STORY_TAGS[slug];
  if (!tags || tags.length === 0) {
    fail("M-REG-02", "STORY_TAGS에 태그가 등록되지 않음");
  } else {
    const unknown = tags.filter((t) => !TAG_META[t]);
    if (unknown.length) fail("M-REG-02", `TAG_META에 없는 태그: ${unknown.join(", ")}`);
    else info("M-REG-02", `태그 ${tags.length}개 등록`);
    if (story.category === "celebrity") {
      if (!tags.some((t) => JOB_TAGS.includes(t))) fail("M-REG-03", "연예인 글인데 직업 태그 없음", tags.join(","));
      if (!tags.some((t) => CHEONGAN.includes(t))) fail("M-REG-03", "연예인 글인데 천간일간 태그 없음", tags.join(","));
    }
  }

  const text = storyText(story);

  // ── 내부링크 실재 (빌드가 절대 안 잡는 것) ──
  // 슬러그 문자셋을 좁히면 오타·비ASCII 링크가 추출조차 안 돼 통과해버린다. 넓게 잡는다.
  const dictLinks = [...text.matchAll(/\]\(\/dict\/([^/)]+)\/([^)]+)\)/g)];
  let dictBad = 0;
  for (const m of dictLinks) {
    const [, cat, s] = m;
    if (!hasDictEntry(cat as never, s)) {
      fail("M-DIC-01", `실재하지 않는 사전 링크 /dict/${cat}/${s} — 런타임 404`);
      dictBad++;
    }
  }
  if (dictLinks.length && !dictBad) info("M-DIC-01", `사전 내부링크 ${dictLinks.length}개 전부 실재`);

  const storyLinks = [...text.matchAll(/\]\(\/stories\/([a-z0-9-]+)\)/g)];
  for (const m of storyLinks) {
    if (!getStoryBySlug(m[1])) fail("M-DIC-02", `실재하지 않는 매거진 링크 /stories/${m[1]}`);
  }

  // ── related ──
  const rel = story.related ?? [];
  for (const r of rel) if (!getStoryBySlug(r)) fail("M-REL-01", `related 슬러그 미실재: ${r}`);
  if (rel.length < 2 || rel.length > 3) warn("M-REL-01", `related ${rel.length}개 (2~3개 권장)`);

  // ── 스키마 ──
  if (story.title.length > 30) warn("M-SCH-01", `title ${story.title.length}자 — 30자 초과`);
  if (!story.excerpt?.trim()) fail("M-SCH-01", "excerpt 없음");
  if ((story.keywords ?? []).length < 5) fail("M-SCH-01", `keywords ${(story.keywords ?? []).length}개 — 5개 미만`);
  if (!/^[a-z0-9-]+$/.test(story.slug)) fail("M-SCH-01", `slug 케밥케이스 위반: ${story.slug}`);
  for (const [k, v] of [["publishedAt", story.publishedAt], ["updatedAt", story.updatedAt]] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) fail("M-SCH-01", `${k} 형식 오류: ${v}`);
  }
  if (story.updatedAt < story.publishedAt) fail("M-SCH-01", "updatedAt < publishedAt");
  if (story.cta?.href !== "/menu") fail("M-SCH-02", `cta.href가 /menu 아님: ${story.cta?.href}`);
  if (story.ctaAfter !== undefined && story.ctaAfter !== -1) {
    if (story.ctaAfter < 0 || story.ctaAfter >= story.sections.length)
      fail("M-SCH-02", `ctaAfter ${story.ctaAfter} 가 섹션 범위(0~${story.sections.length - 1}) 밖`);
  }

  // ── 블록 구성 ──
  const kinds = story.sections.flatMap((s) => s.blocks.map((b) => b.kind));
  if (!kinds.includes("checklist")) fail("M-BLK-01", "checklist 블록 없음");
  if (!kinds.includes("table") && !kinds.includes("callout")) fail("M-BLK-01", "table·callout 둘 다 없음");
  const faqs = story.sections.flatMap((s) => s.blocks).filter((b) => b.kind === "faq");
  const faqCount = faqs.reduce((n, b) => n + (b.kind === "faq" ? b.items.length : 0), 0);
  if (faqCount < 3 || faqCount > 5) fail("M-BLK-01", `FAQ ${faqCount}문항 — 3~5개여야 함 (JSON-LD 발화)`);
  else info("M-BLK-01", `FAQ ${faqCount}문항`);

  // ── 이미지 ──
  const imgs = story.sections.flatMap((s) => s.blocks).filter((b) => b.kind === "image");
  for (const b of imgs) {
    if (b.kind !== "image") continue;
    const abs = path.join(ROOT, "public", b.src);
    if (!existsSync(abs)) fail("M-BLK-02", `figure 파일 없음: ${b.src}`);
    if (!b.alt?.trim()) fail("M-BLK-02", `alt 비어 있음: ${b.src}`);
  }
  if (imgs.length < 2) warn("M-BLK-02", `본문 figure ${imgs.length}장 — 2장 미만`);
  else info("M-BLK-02", `본문 figure ${imgs.length}장`);
  if (story.heroImage && !existsSync(path.join(ROOT, "public", story.heroImage.src)))
    fail("M-BLK-02", `hero 파일 없음: ${story.heroImage.src}`);

  // ── 분량 ──
  const len = text.replace(/\s/g, "").length;
  if (len < 2500 || len > 5500) warn("M-LEN-01", `본문 ${len}자 — 권장 2,500~4,000자 밖`);
  else info("M-LEN-01", `본문 ${len}자`);

  // ── 연예인 전용 ──
  if (story.category === "celebrity") {
    const c = story.celebrity;
    if (!c) fail("M-CEL-01", "celebrity 메타 없음");
    else {
      for (const k of ["name", "birthDate", "calendar", "gender"] as const)
        if (!c[k]) fail("M-CEL-01", `celebrity.${k} 누락`);
      if (!c.source) fail("M-CEL-01", "celebrity.source 누락 — 면책 렌더 조건");
    }
    const others = getAllStories()
      .filter((s) => s.category === "celebrity" && s.slug !== slug && s.celebrity?.name)
      .map((s) => s.celebrity!.name);

    // ★2026-07-29: 예전 판은 text.includes(nm)라 짧은 예명이 흔한 낱말에 걸렸다.
    //   '산'(ATEEZ)이 "부산"에, '정원'이 "정원의 흙"에 오탐 → 멀쩡한 문장을 고쳐 썼다.
    //   ① 앞 글자가 한글이면 더 긴 낱말의 일부다 → 건너뛴다("부산"의 '산').
    //   ② 2글자 이하 예명은 낱말 충돌이 잦아 FAIL 대신 WARN + 문맥을 보여 사람이 가린다.
    //      3글자 이상 실명(남주혁·이채민 등)은 오탐이 사실상 없으므로 그대로 FAIL.
    const isHangul = (ch: string) => /[가-힣]/.test(ch);
    for (const nm of others) {
      for (let i = text.indexOf(nm); i !== -1; i = text.indexOf(nm, i + 1)) {
        if (i > 0 && isHangul(text[i - 1])) continue;          // 더 긴 낱말의 꼬리
        const ctx = text.slice(Math.max(0, i - 12), i + nm.length + 12).replace(/\s+/g, " ");
        if (nm.length >= 3) {
          fail("M-CEL-02", `다른 연예인 이름 '${nm}' 언급 — 각 글 독립 원칙 위반  …${ctx}…`);
        } else {
          warn("M-CEL-02", `짧은 예명 '${nm}'과 겹침 — 사람이 확인  …${ctx}…`);
        }
        break;
      }
    }
  }

  for (const w of NEGATIVE) if (text.includes(w)) fail("M-CEL-03", `부정 단정 어미 '${w}'`);

  // ── 상투구·한자·무료 (블로그 하네스 사전을 정본으로 공유) ──
  const banned = path.join(BLOG_HARNESS, "lexicon", "banned-phrases.txt");
  if (!existsSync(banned)) {
    fail("M-SLP-01", `상투구 사전 없음: ${banned} — 조용한 스킵 금지`);
  } else {
    const lines = readFileSync(banned, "utf-8").split("\n");
    for (const ln of lines) {
      if (!ln.trim() || ln.trimStart().startsWith("#")) continue;
      const [phrase, policy] = ln.split("\t");
      if (!phrase) continue;
      const n = text.split(phrase.trim()).length - 1;
      const limit = (policy ?? "ban").trim() === "ban" ? 0 : 1;
      if (n > limit) fail("M-SLP-01", `금지 상투구 '${phrase.trim()}' ${n}회`);
    }
  }
  if (text.includes("무료")) fail("M-SLP-01", "'무료' 표현 검출 — 사주 분석은 유료");

  // ── 제목 정책 ──
  const kws = story.keywords ?? [];
  if (kws.length && !kws.some((k) => story.title.includes(k)))
    warn("M-TIT-01", "title에 keywords 앵커가 없음");
  const isIlgan = /일간|일주/.test(story.title) || (STORY_TAGS[slug] ?? []).some((t) => CHEONGAN.includes(t));
  if (isIlgan) {
    const stigmaFile = path.join(BLOG_HARNESS, "lexicon", "stigma-patterns.txt");
    if (existsSync(stigmaFile)) {
      const pats = readFileSync(stigmaFile, "utf-8")
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l && !l.startsWith("#"));
      for (const p of pats)
        if (story.title.includes(p)) fail("M-TIT-02", `일간·일주 글 제목에 낙인 표현 '${p}'`);
    }
  }

  // ── M-SIB-01 형제 교차복제 (블로그 sibling_check.py 엔진 공유) ──
  // 2026-08-10 사고: 신작 rain-dream이 기존 발행글 bird-dream과 4-gram 16.2%로
  // 복제됐는데 여기 검사가 없어 그대로 통과했다. dup_check는 원본 .ts 1:1 대조라
  // 소스 없는 신작에는 적용조차 안 된다. 형제 클론은 블로그만의 사고가 아니었다.
  const sib = siblingCheck(slug);
  if (sib === "SKIP") warn("M-SIB-01", "형제 교차복제 검사 스킵 — 덤프·파이썬 확인 필요");
  else if (sib.fails.length) for (const f of sib.fails) fail("M-SIB-01", f);
  else if (sib.warns.length) for (const w of sib.warns) warn("M-SIB-01", w);
  else info("M-SIB-01", `형제 교차복제 히트 ${(sib.ratio * 100).toFixed(1)}%`);

  return rows;
}

/** 블로그 하네스의 sibling_check.py를 매거진 덤프로 돌린다. */
function siblingCheck(slug: string): { fails: string[]; warns: string[]; ratio: number } | "SKIP" {
  const py = "/Users/kunjoo/projects/durumi-blog/.venv/bin/python";
  const script = path.join(BLOG_HARNESS, "sibling_check.py");
  const dump = path.join(ROOT, ".cache", "story-blocks");
  if (!existsSync(py) || !existsSync(script)) return "SKIP";
  try {
    // 덤프가 없거나 낡았으면 먼저 만든다 — 스킵하면 검사가 조용히 사라진다.
    if (!existsSync(path.join(dump, `${slug}.json`))) {
      const tsx = path.join(ROOT, "node_modules", ".bin", "tsx");
      if (!existsSync(tsx)) return "SKIP";
      execFileSync(tsx, [path.join(ROOT, "scripts", "dump-story-blocks.mts")], {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, NODE_OPTIONS: "--conditions=import" },
      });
    }
    const out = execFileSync(py, [script, "--target", slug, "--corpus-json", dump, "--json"], {
      cwd: "/Users/kunjoo/projects/durumi-blog",
      encoding: "utf-8",
      stdio: "pipe",
    });
    const i = out.lastIndexOf("{");
    if (i < 0) return "SKIP";
    const j = JSON.parse(out.slice(i)) as { fails: string[]; warns: string[]; clone_ratio: number };
    return { fails: j.fails ?? [], warns: j.warns ?? [], ratio: j.clone_ratio ?? 0 };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    // sibling_check는 실패 시 exit 1 — 그때도 JSON은 stdout에 있다.
    const out = err.stdout ?? "";
    const i = out.lastIndexOf("{");
    if (i >= 0) {
      try {
        const j = JSON.parse(out.slice(i)) as { fails: string[]; warns: string[]; clone_ratio: number };
        return { fails: j.fails ?? [], warns: j.warns ?? [], ratio: j.clone_ratio ?? 0 };
      } catch { /* fallthrough */ }
    }
    return "SKIP";
  }
}

// ── 미커밋 정본 문서 감지 (사고 #2 재발 방지) ──
function gitDirtyWarning(): string | null {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "docs/", "scripts/"], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    const dirty = out.split("\n").filter((l) => l.trim() && / M |^\?\?/.test(l));
    if (dirty.length) return dirty.map((l) => l.trim()).join(" · ");
  } catch {
    /* git 없으면 무시 */
  }
  return null;
}

const args = process.argv.slice(2);
const slugs = args.includes("--all") ? getAllStories().map((s) => s.slug) : args;
if (!slugs.length) {
  console.error("사용: npx tsx scripts/verify-story.mts <slug> [...] | --all");
  process.exit(2);
}

const dirty = gitDirtyWarning();
if (dirty) {
  console.log(`⚠ M-GIT-01 정본 문서·스크립트에 미커밋 변경 — 워크트리 세션이 못 본다`);
  console.log(`    ${dirty.slice(0, 200)}\n`);
}

const MARK = { FAIL: "✗", WARN: "⚠", INFO: "✓" } as const;
let totalFail = 0;
for (const slug of slugs) {
  const rows = verify(slug);
  const f = rows.filter((r) => r.level === "FAIL").length;
  const w = rows.filter((r) => r.level === "WARN").length;
  totalFail += f;
  if (slugs.length > 1 && f === 0 && w === 0) continue;
  console.log(`=== 매거진 검증: ${slug} ===`);
  for (const r of rows) {
    if (slugs.length > 1 && r.level === "INFO") continue;
    console.log(`  ${MARK[r.level]} ${r.rule} ${r.msg}${r.ev ? ` — ${r.ev}` : ""}`);
  }
  console.log(`  결과: 실패 ${f} · 경고 ${w}\n`);
}
console.log(totalFail ? `총 실패 ${totalFail}건` : `전부 통과 (${slugs.length}편)`);
process.exit(totalFail ? 1 : 0);
