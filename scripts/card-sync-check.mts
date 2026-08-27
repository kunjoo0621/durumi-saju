/**
 * 카드 동기화 검사기 — 본문에서 지운 표현이 figure PNG 소스에 살아 있는지 본다.
 *
 * 왜: 2026-08-27 배치에서 **같은 사고가 세 번 났다.**
 *   ① yuyoungwoo-2 가 본문 수정 후에도 "네 항목 중"을 들고 있었다
 *   ② jangseong-sal-2 푸터가 걷어낸 논지를 그대로 굽고 있었다
 *   ③ v-bts-2 부제가 본문에서 폐기한 "재능의 별"을 유지했다
 *   STORIES_CHECKLIST §7-4 가 "렌더 자산은 텍스트 수정을 따라오지 않는다"고
 *   적어 둔 그대로다. 사람 눈으로 세 번 놓쳤으니 기계로 막는다.
 *
 * 방법: 카드 HTML 소스에서 한글 문구를 뽑아, 대응 글 데이터 파일에
 *   그 문구의 핵심 어절이 남아 있는지 본다. 없으면 "본문에 없는 카드 문구"로 띄운다.
 *   ★자동 판정이 아니라 **사람이 확인할 목록**을 만드는 도구다 —
 *   카드가 본문을 요약하는 건 정상이고, 폐기된 표현만 골라내는 게 목적이다.
 *
 * 실행: npx tsx scripts/card-sync-check.mts [--html <path>] [--min 6]
 */
import { readFileSync } from "fs";
import path from "path";

const args = process.argv.slice(2);
const HTML =
  args[args.indexOf("--html") + 1] && args.includes("--html")
    ? args[args.indexOf("--html") + 1]
    : "/Users/kunjoo/projects/durumi-blog/visu-html/saju/mag-2608b-figures.html";
const MIN = Number(args[args.indexOf("--min") + 1]) || 6;

const html = readFileSync(HTML, "utf-8");
const DATA = path.join(process.cwd(), "lib/stories/data");

/** 카드 블록을 id 별로 자른다 */
const cards = new Map<string, string>();
for (const m of html.matchAll(/<div class="card"[^>]*id="([^"]+)"[\s\S]*?(?=<div class="card"|<\/body>)/g)) {
  cards.set(m[1], m[0]);
}

/** 태그 제거 후 한글 문구만 */
function phrases(block: string): string[] {
  const text = block
    .replace(/<[^>]+>/g, "\n")
    .replace(/&[a-z]+;/g, " ");
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN && /[가-힣]/.test(s));
}

const norm = (s: string) => s.replace(/[\s.,·—…()"'*]/g, "");

let flagged = 0;
for (const [id, block] of cards) {
  const slug = id.replace(/-\d+$/, "");
  let body: string;
  try {
    body = norm(readFileSync(path.join(DATA, `${slug}.ts`), "utf-8"));
  } catch {
    console.log(`✗ ${id}: 대응 글 파일 없음 (${slug}.ts)`);
    continue;
  }
  const missing: string[] = [];
  for (const p of phrases(block)) {
    const n = norm(p);
    if (n.length < MIN) continue;
    // 카드 문구를 6자 창으로 잘라 하나라도 본문에 있으면 '연결됨'으로 본다
    let anchored = false;
    for (let i = 0; i + 6 <= n.length; i++) {
      if (body.includes(n.slice(i, i + 6))) { anchored = true; break; }
    }
    if (!anchored) missing.push(p);
  }
  if (missing.length) {
    flagged += missing.length;
    console.log(`\n### ${id} — 본문에서 못 찾은 카드 문구 ${missing.length}건`);
    for (const m of missing) console.log(`   · ${m.slice(0, 90)}`);
  }
}
console.log(
  flagged
    ? `\n합계 ${flagged}건 — 사람이 확인할 것. 폐기된 표현이면 카드를 고치고 재렌더.`
    : "\n카드 문구가 전부 본문에 닻을 내리고 있음 (0건)",
);
