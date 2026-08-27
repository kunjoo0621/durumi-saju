/**
 * 슬롯 클론 검사기 — 매거진 전체 코퍼스와의 **최장 연속 일치** 를 본다.
 *
 * 왜 만들었나: `verify-story.mts` 의 M-SIB-01(형제 교차복제)은 4-gram 비율이라
 *   **고유명사만 갈아 끼운 슬롯 치환형 클론을 못 잡는다.** 2026-08-27 배치에서
 *   critic이 실측한 것들이 전부 그 형태였다 —
 *     · yangsejong ↔ parkeunbin  38자 연속 (intro 인적사항 문단)
 *     · yangsejong ↔ v-bts       20자 연속 (산출기준 대비 문장)
 *     · yuyoungwoo ↔ v-bts       24자 연속 (시 미상 안내문)
 *     · yukhae-sal ↔ jangseong-sal 13자 연속 (카드 caption)
 *   전부 M-SIB-01 은 8% 미만으로 통과시켰다.
 *
 * ★그리고 이 배치의 진짜 실패 모드는 "클론을 고치다가 다른 형제 문장을 집어 오는 것"
 *   이었다(3라운드 연속). 그래서 **고친 직후 이 검사기를 돌려야** 한다.
 *
 * 실행:
 *   npx tsx scripts/slot-clone-check.mts <slug> [--min 14] [--top 25]
 *   npx tsx scripts/slot-clone-check.mts --all --min 16
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "lib/stories/data");
const args = process.argv.slice(2);
const MIN = Number(args[args.indexOf("--min") + 1]) || 14;
const TOP = Number(args[args.indexOf("--top") + 1]) || 25;
const ALL = args.includes("--all");
const targets = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

/** 데이터 파일에서 사람이 읽는 문자열만 뽑는다.
 *  ★제외: 키·링크 URL·필드 관례(source / iljuLabel / heroImage.alt).
 *    이 셋은 사이트 전체가 공유하는 서식이라 클론으로 셀 값이 아니다. */
function extract(src: string): string {
  src = src
    .replace(/source:\s*"(?:[^"\\]|\\.)*"/g, "")
    .replace(/iljuLabel:\s*"(?:[^"\\]|\\.)*"/g, "")
    .replace(/heroImage:\s*\{[^}]*\}/g, "");
  const out: string[] = [];
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const v = m[1];
    if (!v || v.length < 8) continue;
    if (/^[a-z0-9\-_/.#]+$/i.test(v)) continue; // slug·경로·키
    if (!/[가-힣]/.test(v)) continue;
    out.push(v.replace(/\\n/g, " "));
  }
  // 마크다운 링크는 라벨만 남긴다 — URL 일치는 클론이 아니다
  return out.join(" ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, "");
}

const corpus = new Map<string, string>();
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".ts")) continue;
  corpus.set(f.replace(/\.ts$/, ""), extract(readFileSync(path.join(DIR, f), "utf-8")));
}

/** MIN-그램 역색인 — 193편 전수를 O(글자수)로 훑기 위한 것.
 *  단순 이중 루프는 실측 6분+ 로 못 쓴다. */
const GRAM = MIN;
const index = new Map<string, Set<string>>();
for (const [slug, txt] of corpus) {
  for (let i = 0; i + GRAM <= txt.length; i++) {
    const g = txt.slice(i, i + GRAM);
    let set = index.get(g);
    if (!set) index.set(g, (set = new Set()));
    set.add(slug);
  }
}

/** 대상 글에서 다른 글과 겹치는 런을 겹치지 않게 수집(그리디 확장) */
function sharedRuns(slug: string, me: string): { other: string; run: string }[] {
  const out: { other: string; run: string }[] = [];
  let i = 0;
  while (i + GRAM <= me.length) {
    const cands = index.get(me.slice(i, i + GRAM));
    const others = cands ? [...cands].filter((c) => c !== slug) : [];
    if (!others.length) { i++; continue; }
    // 가장 길게 확장되는 상대를 고른다
    let best = { other: others[0], len: GRAM };
    for (const o of others) {
      const txt = corpus.get(o)!;
      let len = GRAM;
      while (i + len < me.length && txt.includes(me.slice(i, i + len + 1))) len++;
      if (len > best.len) best = { other: o, len };
    }
    out.push({ other: best.other, run: me.slice(i, i + best.len) });
    i += best.len; // 겹치지 않게 건너뛴다
  }
  return out;
}

function run(slug: string) {
  const me = corpus.get(slug);
  if (!me) { console.log(`✗ ${slug}: 코퍼스에 없음`); return 0; }
  const hits = sharedRuns(slug, me);
  hits.sort((x, y) => y.run.length - x.run.length);
  console.log(`\n### ${slug} — ${MIN}자 이상 공유 런 ${hits.length}건`);
  for (const h of hits.slice(0, TOP)) {
    console.log(`  ${String(h.run.length).padStart(3)}자  vs ${h.other.padEnd(20)} ${h.run.slice(0, 70)}`);
  }
  if (hits.length > TOP) console.log(`  … 그 밖 ${hits.length - TOP}건`);
  return hits.length;
}

const list = ALL ? [...corpus.keys()] : targets;
let total = 0;
for (const s of list) total += run(s);
console.log(`\n합계 ${total}건 (기준 ${MIN}자)`);
