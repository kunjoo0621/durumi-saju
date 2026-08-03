// 명리 사실 대조 ② — 엔진 ↔ 사이트 사전(lib/dict/data) 대조 (2026-08-03 신설)
//
// 배경: docs/SAJU_FACT_INTEGRITY_PLAN.md §2 / §6-2.
//   사전과 엔진에 같은 명리 사실이 중복 정의된 항목이 35개인데 대조 검사는 0개였다.
//   그래서 12신살 년주 기준이 사전 조견표와 6개월간 어긋난 채 라이브로 나갔다.
//
// 정본(SSOT): `lib/utils/saju-enrichment.ts` (계획서 §5 안 A'). 사전이 정본을 따라야 한다.
//
// 두 갈래로 대조한다.
//   (1) 구조체 필드 — gabja 60편의 hero/highlight, jiji·cheongan의 hero 등은 그대로 비교.
//   (2) 정형 프로즈 — 본문 문장 속 조견표는 정규식으로 파싱해 비교.
//
// ★★파싱 실패를 "일치"로 처리하지 않는다. 정규식이 문장을 못 잡으면 그 자체를 실패로 만든다.
//   오늘 잡은 사고의 절반이 프로즈에서 났고, 파싱 실패를 조용히 넘기면 검사기가 있으나 마나다.
//
// 실행: NODE_OPTIONS='--conditions=import' npx tsx --test lib/saju-facts-dict.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  STEM_ELEMENT,
  BRANCH_INFO,
  GENERATES,
  CONTROLS,
  ELEMENT_TO_HANJA,
  YUKAP,
  YUKCHUNG,
  SAMHAP,
  BANGHAP,
  HYUNG,
  WONJIN,
  findShinsal,
  getPillar12Shinsal,
  type KoreanElement,
} from "./utils/saju-enrichment";
import { getAllDictEntries, getDictEntriesByCategory, getDictEntry } from "./dict/registry";
import type { DictEntry } from "./dict/types";

// ─────────────────────────────────────────────────────────────
// known-drift 허용 목록
// ─────────────────────────────────────────────────────────────
// 도입 시점에 이미 어긋나 있던 항목만 명시한다. 목록에 없는 새 드리프트는 실패한다.
// ★목록에 있는데 실제로는 일치하면 그것도 실패한다(= 해소됐으면 목록에서 지워라).
const KNOWN_DRIFT: Record<string, string> = {
  // A2 잔여 3건은 2026-08-03 해소됨 — sinsal/hongryeom · sipisinsal/dohwa ·
  //   unseong12/jangsaeng의 "년지·일지" 병기를 년지 기준으로 통일했다.
  //   목록이 비어 있는 게 정상 상태다. 새 드리프트는 여기 등재하지 말고 고쳐라 —
  //   등재는 "당장 못 고치는 이유"가 있을 때만이고, 사유와 해소 시점을 반드시 적는다.
  //
  // 寅 지장간 weight 합 13은 엔진 ↔ 사전이 같은 값을 공유하므로 이 테스트에선 일치로 잡힌다.
  //   교정값 확정은 lib/saju-facts-engine.test.ts의 KNOWN_DRIFT 소관.
};

function driftAware(key: string, ok: boolean, message: string) {
  const excused = Object.prototype.hasOwnProperty.call(KNOWN_DRIFT, key);
  if (ok) {
    assert.ok(
      !excused,
      `known-drift 항목 "${key}"가 해소됐다. KNOWN_DRIFT에서 삭제하라 (사유: ${KNOWN_DRIFT[key]})`,
    );
    return;
  }
  assert.ok(excused, message);
}

// ─────────────────────────────────────────────────────────────
// 공통 유틸 — 한글↔한자 다리는 전부 엔진 테이블에서만 만든다(제3사본 금지)
// ─────────────────────────────────────────────────────────────
const STEMS = Object.keys(STEM_ELEMENT);
const BRANCHES = Object.keys(BRANCH_INFO);
const STEM_BY_KOREAN = new Map(STEMS.map((s) => [STEM_ELEMENT[s].korean, s]));
const BRANCH_BY_KOREAN = new Map(BRANCHES.map((b) => [BRANCH_INFO[b].korean, b]));

/** "갑" | "甲" | "갑(甲)" | "甲(갑)" → 한자 천간. 못 읽으면 null. */
function toStem(token: string): string | null {
  const t = token.trim();
  for (const piece of t.split(/[()（）\s]/).filter(Boolean)) {
    if (STEM_ELEMENT[piece]) return piece;
    const byKo = STEM_BY_KOREAN.get(piece);
    if (byKo) return byKo;
  }
  return null;
}

/** "자" | "子" | "자(子)" | "子(자)" → 한자 지지. 못 읽으면 null. */
function toBranch(token: string): string | null {
  const t = token.trim();
  for (const piece of t.split(/[()（）\s]/).filter(Boolean)) {
    if (BRANCH_INFO[piece]) return piece;
    const byKo = BRANCH_BY_KOREAN.get(piece);
    if (byKo) return byKo;
  }
  return null;
}

function mustStem(token: string, where: string): string {
  const s = toStem(token);
  assert.ok(s, `${where}: "${token}"을(를) 천간으로 해석하지 못했다 — 파싱 실패는 통과가 아니다`);
  return s!;
}

function mustBranch(token: string, where: string): string {
  const b = toBranch(token);
  assert.ok(b, `${where}: "${token}"을(를) 지지로 해석하지 못했다 — 파싱 실패는 통과가 아니다`);
  return b!;
}

/** 사전 엔트리의 "주장" 텍스트 전부. FAQ 질문은 주장이 아니라 제외한다. */
function assertions(e: DictEntry): string[] {
  return [
    e.tagline,
    e.body.intro,
    ...e.body.sections.flatMap((s) => s.paragraphs),
    ...e.faq.map((f) => f.a),
    ...e.highlight.map((h) => h.value),
  ];
}

function highlightOf(e: DictEntry, label: string): string {
  const hit = e.highlight.find((h) => h.label === label);
  assert.ok(hit, `${e.category}/${e.slug}: highlight "${label}" 항목이 없다`);
  return hit!.value;
}

/** 지정 조건을 만족하는 문단을 정확히 1개 골라 온다(0개·2개 이상은 파싱 실패로 간주). */
function soleParagraph(e: DictEntry, predicate: (p: string) => boolean, what: string): string {
  const hits = [e.body.intro, ...e.body.sections.flatMap((s) => s.paragraphs), ...e.faq.map((f) => f.a)]
    .filter(predicate);
  assert.equal(
    hits.length,
    1,
    `${e.category}/${e.slug}: ${what} 문단을 ${hits.length}개 찾았다(정확히 1개여야 함) — 파싱 실패`,
  );
  return hits[0];
}

function entry(category: string, slug: string): DictEntry {
  const e = getDictEntry(category as DictEntry["category"], slug);
  assert.ok(e, `사전 항목 ${category}/${slug}이 없다`);
  return e!;
}

// ─────────────────────────────────────────────────────────────
// 엔진 프로브 — export되지 않은 엔진 테이블을 findShinsal의 실제 동작으로 역산한다.
// (테스트가 엔진 표를 다시 적어 두는 "제4의 사본"이 되지 않게 하는 게 핵심.)
// ─────────────────────────────────────────────────────────────
function shinsalKeys(dayStem: string, dayBranch: string, branches: string[], stems: string[]): Set<string> {
  const r = findShinsal(dayBranch, dayStem, branches[1], branches, false, stems);
  return new Set(r.matches.map((m) => m.key));
}

/** 일간 기반 신살(양인·문창·학당·홍염·천을): 일간 S에 대해 발동하는 지지 집합. */
function branchesForDayStemShinsal(key: string, stem: string): string[] {
  return BRANCHES.filter((b) => shinsalKeys(stem, b, [b, b, b, b], [stem, stem, stem, stem]).has(key));
}

/** 월덕귀인: 월지 M에 대해 발동하는 천간 집합. */
function stemsForWoldeok(monthBranch: string): string[] {
  const m = monthBranch;
  return STEMS.filter((s) => shinsalKeys(s, m, [m, m, m, m], [s, s, s, s]).has("woldeok"));
}

/** 공망: 일주(간·지)에 대한 공망 지지 2개. */
function gongmangOf(dayStem: string, dayBranch: string): string[] {
  return BRANCHES.filter((c) =>
    shinsalKeys(dayStem, dayBranch, [c, dayBranch, dayBranch, dayBranch], [
      dayStem,
      dayStem,
      dayStem,
      dayStem,
    ]).has("gongmang"),
  );
}

/** 일주 갑자가 해당 key(백호·괴강) 신살인지. */
function isDayPillarShinsal(key: string, stem: string, branch: string): boolean {
  return shinsalKeys(stem, branch, [branch, branch, branch, branch], [stem, stem, stem, stem]).has(key);
}

/** 60갑자 전수 (甲子 → 癸亥) */
const SIXTY_PILLARS: { stem: string; branch: string; index: number }[] = Array.from(
  { length: 60 },
  (_, i) => ({ stem: STEMS[i % 10], branch: BRANCHES[i % 12], index: i }),
);

// 삼합 그룹(한글 3자) → 그룹 대표 지지(첫 글자). 엔진 SAMHAP에서만 만든다.
const SAMHAP_GROUP_BY_KOREAN = new Map<string, { branches: string[]; element: KoreanElement }>(
  SAMHAP.map(([a, b, c, el]) => [
    `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}${BRANCH_INFO[c].korean}`,
    { branches: [a, b, c], element: el },
  ]),
);

/** 12신살 이름 정규화: 사전이 "망신"/"장성"처럼 살을 떼고 쓰기도 한다. */
function normalizeShinsalName(name: string): string {
  const n = name.trim();
  if (n === "도화" || n === "도화살") return "년살";
  return n.endsWith("살") ? n : `${n}살`;
}

// ═════════════════════════════════════════════════════════════
// 1. 구조체 — cheongan 10편 ↔ STEM_ELEMENT
// ═════════════════════════════════════════════════════════════
test("사전 cheongan 10편: hero·highlight의 오행/음양이 엔진 STEM_ELEMENT와 같다", () => {
  const entries = getDictEntriesByCategory("cheongan").filter((e) => STEM_ELEMENT[e.hanja]);
  assert.equal(entries.length, 10, "천간 개별 페이지가 10편이어야 한다");
  for (const e of entries) {
    const truth = STEM_ELEMENT[e.hanja];
    assert.equal(e.name, truth.korean, `${e.slug}: 한글명 불일치`);
    assert.equal(e.hero.variant, "single-char", `${e.slug}: hero variant`);
    if (e.hero.variant === "single-char") {
      assert.equal(e.hero.char, truth.korean, `${e.slug}: hero.char`);
      assert.equal(e.hero.element, truth.element, `${e.slug}: hero 오행`);
      assert.equal(e.hero.yinYang, truth.yin_yang, `${e.slug}: hero 음양`);
    }
    // highlight 프로즈: "목(木)" / "양(陽)"
    const el = highlightOf(e, "오행");
    assert.ok(
      el.startsWith(`${truth.element}(${ELEMENT_TO_HANJA[truth.element]})`),
      `${e.slug}: highlight 오행 "${el}" ≠ ${truth.element}`,
    );
    const yy = highlightOf(e, "음양");
    assert.ok(yy.startsWith(truth.yin_yang), `${e.slug}: highlight 음양 "${yy}" ≠ ${truth.yin_yang}`);
  }
});

// ═════════════════════════════════════════════════════════════
// 2. 구조체 — jiji 12편 ↔ BRANCH_INFO (지장간 highlight 포함)
// ═════════════════════════════════════════════════════════════
test("사전 jiji 12편: 오행·음양·지장간이 엔진 BRANCH_INFO와 같다", () => {
  const entries = getDictEntriesByCategory("jiji").filter((e) => BRANCH_INFO[e.hanja]);
  assert.equal(entries.length, 12, "지지 개별 페이지가 12편이어야 한다");
  for (const e of entries) {
    const truth = BRANCH_INFO[e.hanja];
    assert.equal(e.name, truth.korean, `${e.slug}: 한글명 불일치`);
    if (e.hero.variant === "single-char") {
      assert.equal(e.hero.element, truth.element, `${e.slug}: hero 오행`);
      assert.equal(e.hero.yinYang, truth.yin_yang, `${e.slug}: hero 음양`);
    } else {
      assert.fail(`${e.slug}: hero variant가 single-char가 아니다`);
    }
    const el = highlightOf(e, "오행");
    assert.ok(el.startsWith(`${truth.element}(`), `${e.slug}: highlight 오행 "${el}"`);
    const yy = highlightOf(e, "음양");
    assert.ok(yy.startsWith(truth.yin_yang), `${e.slug}: highlight 음양 "${yy}"`);

    // 지장간 highlight: "계(癸) 단일" / "기(己)·계(癸)·신(辛)"
    const raw = highlightOf(e, "지장간");
    const tokens = [...raw.matchAll(/([가-힣])\(([一-鿿])\)/g)];
    assert.ok(tokens.length > 0, `${e.slug}: 지장간 highlight "${raw}" 파싱 실패`);
    const parsed = tokens.map((m) => mustStem(m[2], `${e.slug} 지장간`));
    assert.deepEqual(
      parsed,
      truth.jijanggan.map((j) => j.stem),
      `${e.slug}: 지장간 구성·순서가 엔진과 다르다`,
    );
    // 한글 표기도 엔진 기준과 일치해야 한다
    for (const m of tokens) {
      assert.equal(STEM_ELEMENT[m[2]].korean, m[1], `${e.slug}: 지장간 ${m[2]} 한글 표기 불일치`);
    }
  }
});

// ═════════════════════════════════════════════════════════════
// 3. 구조체 — gabja 60편 ↔ 엔진 (일주 정보 전수)
// ═════════════════════════════════════════════════════════════
test("사전 gabja 60편: hero 천간·지지 정보와 지장간(weight 포함)이 엔진과 같다", () => {
  const entries = getDictEntriesByCategory("gabja").filter((e) => e.hero.variant === "combination");
  assert.equal(entries.length, 60, "60갑자 일주 페이지가 60편이어야 한다");
  for (const e of entries) {
    assert.equal(e.hanja.length, 2, `${e.slug}: hanja가 2글자가 아니다`);
    const [stem, branch] = [e.hanja[0], e.hanja[1]];
    const st = STEM_ELEMENT[stem];
    const br = BRANCH_INFO[branch];
    assert.ok(st && br, `${e.slug}: ${e.hanja}가 유효한 간지가 아니다`);
    assert.equal(e.name, `${st.korean}${br.korean}`, `${e.slug}: 한글명 불일치`);

    if (e.hero.variant !== "combination") continue;
    const { left, right } = e.hero;
    assert.equal(left.hanja, stem, `${e.slug}: hero.left 한자`);
    assert.equal(left.char, st.korean, `${e.slug}: hero.left 한글`);
    assert.equal(left.element, st.element, `${e.slug}: hero.left 오행`);
    assert.equal(left.yinYang, st.yin_yang, `${e.slug}: hero.left 음양`);
    assert.equal(right.hanja, branch, `${e.slug}: hero.right 한자`);
    assert.equal(right.char, br.korean, `${e.slug}: hero.right 한글`);
    assert.equal(right.element, br.element, `${e.slug}: hero.right 오행`);
    assert.equal(right.yinYang, br.yin_yang, `${e.slug}: hero.right 음양`);

    // 지장간 구조체: stem·korean·weight 전부 (순서 포함)
    assert.ok(right.jijanggan, `${e.slug}: hero.right.jijanggan 누락`);
    assert.deepEqual(
      right.jijanggan,
      br.jijanggan.map((j) => ({
        stem: j.stem,
        korean: STEM_ELEMENT[j.stem].korean,
        weight: j.weight,
      })),
      `${e.slug}: 지장간 구조체가 엔진 BRANCH_INFO와 다르다`,
    );
  }
});

test("사전 gabja 60편: 지장간·음양구성·공망 highlight가 엔진 산출과 같다", () => {
  const entries = getDictEntriesByCategory("gabja").filter((e) => e.hero.variant === "combination");
  const seenNumbers = new Set<number>();
  for (const e of entries) {
    const [stem, branch] = [e.hanja[0], e.hanja[1]];
    const st = STEM_ELEMENT[stem];
    const br = BRANCH_INFO[branch];

    // (a) 지장간 프로즈: "갑(甲) · 병(丙) · 무(戊)" / "계(癸) 단일"
    const jjRaw = highlightOf(e, "지장간");
    const jjTokens = [...jjRaw.matchAll(/([가-힣])\(([一-鿿])\)/g)];
    assert.ok(jjTokens.length > 0, `${e.slug}: 지장간 highlight "${jjRaw}" 파싱 실패`);
    assert.deepEqual(
      jjTokens.map((m) => m[2]),
      br.jijanggan.map((j) => j.stem),
      `${e.slug}: 지장간 highlight가 엔진과 다르다`,
    );

    // (b) 음양 구성: "양화 · 양목" (천간 · 지지)
    const yyRaw = highlightOf(e, "음양 구성");
    const yyTokens = [...yyRaw.matchAll(/([양음])([목화토금수])/g)];
    assert.equal(yyTokens.length, 2, `${e.slug}: 음양 구성 "${yyRaw}" 파싱 실패(2개여야 함)`);
    assert.equal(`${yyTokens[0][1]}${yyTokens[0][2]}`, `${st.yin_yang}${st.element}`, `${e.slug}: 천간 음양구성`);
    assert.equal(`${yyTokens[1][1]}${yyTokens[1][2]}`, `${br.yin_yang}${br.element}`, `${e.slug}: 지지 음양구성`);

    // (c) 공망: "술(戌) · 해(亥)" ↔ 엔진 findShinsal 공망 산출
    const gmRaw = highlightOf(e, "공망");
    const gmTokens = [...gmRaw.matchAll(/([가-힣])\(([一-鿿])\)/g)];
    assert.equal(gmTokens.length, 2, `${e.slug}: 공망 highlight "${gmRaw}" 파싱 실패(2개여야 함)`);
    const gmDict = gmTokens.map((m) => mustBranch(m[2], `${e.slug} 공망`)).sort();
    const gmEngine = gongmangOf(stem, branch).sort();
    assert.equal(gmEngine.length, 2, `${e.slug}: 엔진 공망 산출이 2개가 아니다`);
    assert.deepEqual(gmDict, gmEngine, `${e.slug}: 공망이 엔진 산출과 다르다`);

    // (d) 60갑자 순번: 1~60 유일
    const numRaw = highlightOf(e, "60갑자 순번");
    const num = Number(/(\d+)번/.exec(numRaw)?.[1]);
    assert.ok(Number.isInteger(num) && num >= 1 && num <= 60, `${e.slug}: 순번 "${numRaw}" 파싱 실패`);
    assert.ok(!seenNumbers.has(num), `순번 ${num}번이 중복됐다 (${e.slug})`);
    seenNumbers.add(num);
  }
  assert.equal(seenNumbers.size, 60, "60갑자 순번이 1~60을 빠짐없이 덮어야 한다");
});

// ═════════════════════════════════════════════════════════════
// 4. 정형 프로즈 — saju/jijanggan 조견표 12지지
// ═════════════════════════════════════════════════════════════
test("사전 saju/jijanggan 본문 조견표: 12지지 지장간이 엔진과 같다", () => {
  const e = entry("saju", "jijanggan");
  const paragraphs = e.body.sections.flatMap((s) => s.paragraphs).filter((p) => /지장간입니다/.test(p));
  assert.ok(paragraphs.length >= 1, "지장간 표 문단을 찾지 못했다 — 파싱 실패");
  const table = new Map<string, string[]>();
  for (const p of paragraphs) {
    // "축(丑) 기·계·신" 형태
    for (const m of p.matchAll(/([가-힣])\(([一-鿿])\)\s+([가-힣](?:·[가-힣])*)/g)) {
      const branch = mustBranch(m[2], "saju/jijanggan 표");
      const stems = m[3].split("·").map((t) => mustStem(t, `saju/jijanggan 표(${branch})`));
      table.set(branch, stems);
    }
  }
  assert.equal(table.size, 12, `지장간 표에서 12지지를 파싱하지 못했다 (파싱: ${table.size}개)`);
  for (const branch of BRANCHES) {
    assert.deepEqual(
      table.get(branch),
      BRANCH_INFO[branch].jijanggan.map((j) => j.stem),
      `saju/jijanggan 본문: ${branch} 지장간이 엔진과 다르다`,
    );
  }
});

// ═════════════════════════════════════════════════════════════
// 5. 정형 프로즈 — 12신살 조견표 (엔트리 12편 + intro 배치표)
// ═════════════════════════════════════════════════════════════
test("사전 sipisinsal 12편: 삼합 그룹별 조견표 48칸이 getPillar12Shinsal과 같다", () => {
  const entries = getDictEntriesByCategory("sipisinsal").filter((e) => e.slug !== "intro");
  assert.equal(entries.length, 12, "12신살 개별 페이지가 12편이어야 한다");
  let cells = 0;
  for (const e of entries) {
    const name = normalizeShinsalName(e.name);
    const p = soleParagraph(
      e,
      (t) => (t.match(/→/g) ?? []).length === 4 && /삼합|申子辰|신자진/.test(t),
      `${e.slug} 조견표`,
    );
    // "신자진(申子辰) → 巳(사)" / "신자진(申子辰) → 유(酉)" 두 표기 다 허용
    const rows = [
      ...p.matchAll(
        /([가-힣]{3})\(([一-鿿]{3})\)\s*→\s*([가-힣一-鿿])\(([가-힣一-鿿])\)/g,
      ),
    ];
    assert.equal(rows.length, 4, `${e.slug}: 조견표에서 4개 삼합 그룹을 파싱하지 못했다`);
    for (const m of rows) {
      const group = SAMHAP_GROUP_BY_KOREAN.get(m[1]);
      assert.ok(group, `${e.slug}: 삼합 그룹 "${m[1]}"을 엔진 SAMHAP에서 찾지 못했다`);
      assert.deepEqual(
        m[2].split(""),
        group!.branches,
        `${e.slug}: 삼합 ${m[1]} 한자 구성이 엔진과 다르다`,
      );
      const target = mustBranch(`${m[3]}(${m[4]})`, `${e.slug} 조견표 대상지지`);
      const yearBranch = group!.branches[0];
      const actual = getPillar12Shinsal([yearBranch, target, target, target], true).month.name;
      assert.equal(actual, name, `${e.slug}: ${m[1]} 그룹의 ${name} 자리가 엔진과 다르다`);
      cells++;
    }
  }
  assert.equal(cells, 48, "12신살 × 4그룹 = 48칸을 전부 대조해야 한다");
});

test("사전 sipisinsal 12편: 순번·길흉이 엔진 12신살 순서·타입과 같다", () => {
  const entries = getDictEntriesByCategory("sipisinsal").filter((e) => e.slug !== "intro");
  // 엔진의 12신살 순서/타입은 export되지 않는다 → 신자진 그룹의 겁살 시작점(巳)부터 12지지를
  // 시계방향으로 훑어 산출값으로 역산한다.
  const order: string[] = [];
  const typeOf = new Map<string, string>();
  const start = BRANCHES.indexOf("巳"); // 신자진 그룹 겁살 자리
  for (let i = 0; i < 12; i++) {
    const b = BRANCHES[(start + i) % 12];
    const got = getPillar12Shinsal(["申", b, b, b], true).month;
    order.push(got.name);
    typeOf.set(got.name, got.type);
  }
  assert.equal(order[0], "겁살", "역산 기준점(신자진 겁살=巳)이 어긋났다");
  assert.equal(new Set(order).size, 12, "12신살 이름이 12개로 역산돼야 한다");

  const TYPE_LABEL: Record<string, string> = { good: "길성", bad: "흉성", neutral: "중" };
  for (const e of entries) {
    const name = normalizeShinsalName(e.name);
    const numRaw = highlightOf(e, "12신살 순번");
    const num = Number(/(\d+)번/.exec(numRaw)?.[1]);
    assert.ok(Number.isInteger(num), `${e.slug}: 순번 "${numRaw}" 파싱 실패`);
    assert.equal(order[num - 1], name, `${e.slug}: 순번 ${num}번이 엔진 순서와 다르다`);

    const gh = highlightOf(e, "길흉");
    const m = /\((good|bad|neutral)\)/.exec(gh);
    assert.ok(m, `${e.slug}: 길흉 "${gh}"에서 타입을 파싱하지 못했다`);
    assert.equal(typeOf.get(name), m![1], `${e.slug}: 길흉이 엔진 타입과 다르다`);
    assert.ok(
      gh.startsWith(TYPE_LABEL[m![1]]),
      `${e.slug}: 길흉 한글 라벨 "${gh}"이 타입 ${m![1]}과 안 맞는다`,
    );
  }
});

test("사전 sipisinsal/intro 배치표: 4그룹 × 12신살 48칸이 엔진과 같다", () => {
  const e = entry("sipisinsal", "intro");
  const paragraphs = e.body.sections
    .flatMap((s) => s.paragraphs)
    .filter((p) => /겁살=/.test(p));
  assert.equal(paragraphs.length, 4, `intro 배치표 문단이 4개여야 한다(파싱: ${paragraphs.length})`);
  let cells = 0;
  for (const p of paragraphs) {
    const head = /^([가-힣]{3})\s/.exec(p);
    assert.ok(head, `intro 배치표 문단의 삼합 그룹명을 파싱하지 못했다: ${p.slice(0, 20)}`);
    const group = SAMHAP_GROUP_BY_KOREAN.get(head![1]);
    assert.ok(group, `intro 배치표: 삼합 그룹 "${head![1]}"을 엔진에서 찾지 못했다`);
    const pairs = [...p.matchAll(/([가-힣]{2,3})=([가-힣])/g)];
    assert.equal(pairs.length, 12, `intro 배치표 ${head![1]}: 12칸을 파싱하지 못했다`);
    for (const m of pairs) {
      const name = normalizeShinsalName(m[1]);
      const target = mustBranch(m[2], `intro 배치표(${head![1]})`);
      const fromEngine: string = getPillar12Shinsal(
        [group!.branches[0], target, target, target],
        true,
      ).month.name;
      assert.equal(
        fromEngine,
        name,
        `intro 배치표: ${head![1]} 그룹의 ${target}가 엔진에선 ${fromEngine}인데 사전은 ${name}`,
      );
      cells++;
    }
  }
  assert.equal(cells, 48, "intro 배치표 48칸 전수를 대조해야 한다");
});

// ═════════════════════════════════════════════════════════════
// 6. 정형 프로즈 — 일반 신살 조견표 ↔ 엔진 검출기
// ═════════════════════════════════════════════════════════════
test("사전 sinsal/yangin: 양인 조견표가 엔진 양인 검출과 같다", () => {
  const e = entry("sinsal", "yangin");
  const p = soleParagraph(e, (t) => /양간 일간만 양인이 적용됩니다/.test(t), "양인 조견표");
  const rows = [
    ...p.matchAll(/((?:[가-힣]\([一-鿿]\)·?)+)→([가-힣])\(([一-鿿])\)/g),
  ];
  assert.ok(rows.length > 0, "양인 조견표 파싱 실패");
  const parsed = new Map<string, string>();
  for (const m of rows) {
    const target = mustBranch(m[3], "양인 조견표");
    for (const tok of m[1].split("·").filter(Boolean)) {
      parsed.set(mustStem(tok, "양인 조견표"), target);
    }
  }
  for (const stem of STEMS) {
    const engine = branchesForDayStemShinsal("yangin", stem);
    const dict = parsed.get(stem);
    if (dict) {
      assert.deepEqual(engine, [dict], `양인: 일간 ${stem} 불일치`);
    } else {
      assert.deepEqual(engine, [], `양인: 사전에 없는 일간 ${stem}을 엔진이 검출한다`);
    }
  }
  // 사전이 "음간은 양인 없음"이라 서술하므로 엔진도 양간 5개만이어야 한다
  assert.equal(parsed.size, 5, "양인 조견표는 양간 5개(갑·병·무·경·임)여야 한다");
});

test("사전 sinsal/munchang-gwiin: 문창 조견표가 엔진 검출과 같다", () => {
  const e = entry("sinsal", "munchang-gwiin");
  const p = soleParagraph(e, (t) => /문창귀인이 됩니다/.test(t), "문창 조견표");
  const tail = p.slice(p.indexOf("됩니다") + 3);
  const rows = [...tail.matchAll(/([가-힣](?:·[가-힣])*)→([가-힣])/g)];
  assert.ok(rows.length > 0, "문창 조견표 파싱 실패");
  const parsed = new Map<string, string>();
  for (const m of rows) {
    const target = mustBranch(m[2], "문창 조견표");
    for (const tok of m[1].split("·")) parsed.set(mustStem(tok, "문창 조견표"), target);
  }
  assert.equal(parsed.size, 10, "문창 조견표는 10천간 전부여야 한다");
  for (const stem of STEMS) {
    assert.deepEqual(
      branchesForDayStemShinsal("munchang", stem),
      [parsed.get(stem)],
      `문창: 일간 ${stem} 불일치`,
    );
  }
});

test("사전 sinsal/hakdang-gwiin: 학당 조견표가 엔진 검출과 같다", () => {
  const e = entry("sinsal", "hakdang-gwiin");
  const p = soleParagraph(e, (t) => /가 학당입니다/.test(t), "학당 조견표");
  const rows = [...p.matchAll(/([가-힣](?:·[가-힣])*)\([^)]*\)→([가-힣])/g)];
  assert.ok(rows.length > 0, "학당 조견표 파싱 실패");
  const parsed = new Map<string, string>();
  for (const m of rows) {
    const target = mustBranch(m[2], "학당 조견표");
    for (const tok of m[1].split("·")) parsed.set(mustStem(tok, "학당 조견표"), target);
  }
  assert.equal(parsed.size, 10, "학당 조견표는 10천간 전부여야 한다");
  for (const stem of STEMS) {
    assert.deepEqual(
      branchesForDayStemShinsal("hakdang", stem),
      [parsed.get(stem)],
      `학당: 일간 ${stem} 불일치`,
    );
  }
});

test("사전 sinsal/hongryeom: 홍염 조견표가 엔진 검출과 같다", () => {
  const e = entry("sinsal", "hongryeom");
  const p = soleParagraph(e, (t) => (t.match(/→/g) ?? []).length >= 8, "홍염 조견표");
  const rows = [
    ...p.matchAll(/([가-힣])\(([一-鿿])\)\s*→\s*([가-힣])\(([一-鿿])\)/g),
  ];
  assert.equal(rows.length, 10, `홍염 조견표에서 10천간을 파싱하지 못했다(${rows.length})`);
  for (const m of rows) {
    const stem = mustStem(m[2], "홍염 조견표");
    const target = mustBranch(m[4], "홍염 조견표");
    assert.deepEqual(
      branchesForDayStemShinsal("hongryeom", stem),
      [target],
      `홍염: 일간 ${stem} 불일치`,
    );
  }
});

test("사전 sinsal/cheonyl-gwiin: 천을귀인 조견표가 엔진 검출과 같다", () => {
  const e = entry("sinsal", "cheonyl-gwiin");
  const p = soleParagraph(e, (t) => /일간 → /.test(t) || /일간 →/.test(t), "천을 조견표");
  const rows = [
    ...p.matchAll(/((?:[가-힣]\([一-鿿]\)·?)+)\s*일간\s*→\s*([가-힣])·([가-힣])/g),
  ];
  assert.ok(rows.length > 0, "천을 조견표 파싱 실패");
  const parsed = new Map<string, string[]>();
  for (const m of rows) {
    const targets = [
      mustBranch(m[2], "천을 조견표"),
      mustBranch(m[3], "천을 조견표"),
    ].sort();
    for (const tok of m[1].split("·").filter(Boolean)) {
      parsed.set(mustStem(tok, "천을 조견표"), targets);
    }
  }
  assert.equal(parsed.size, 10, "천을 조견표는 10천간 전부여야 한다");
  for (const stem of STEMS) {
    assert.deepEqual(
      branchesForDayStemShinsal("chuneul", stem).sort(),
      parsed.get(stem),
      `천을귀인: 일간 ${stem} 불일치`,
    );
  }
});

test("사전 sinsal/woldeok-gwiin: 월덕 조견표가 엔진 검출과 같다", () => {
  const e = entry("sinsal", "woldeok-gwiin");
  const p = soleParagraph(e, (t) => /월덕|월 →/.test(t) && /삼합 그룹 천간으로 산출/.test(t), "월덕 조견표");
  const rows = [
    ...p.matchAll(
      /([가-힣]{3})\(([一-鿿]{3})\)\s*월\s*→\s*([가-힣])\(([一-鿿])\)/g,
    ),
  ];
  assert.equal(rows.length, 4, `월덕 조견표에서 4개 삼합 그룹을 파싱하지 못했다(${rows.length})`);
  const covered = new Set<string>();
  for (const m of rows) {
    const group = SAMHAP_GROUP_BY_KOREAN.get(m[1]);
    assert.ok(group, `월덕: 삼합 그룹 "${m[1]}"을 엔진에서 찾지 못했다`);
    const target = mustStem(m[4], "월덕 조견표");
    for (const monthBranch of group!.branches) {
      assert.deepEqual(
        stemsForWoldeok(monthBranch),
        [target],
        `월덕: ${monthBranch}월 불일치`,
      );
      covered.add(monthBranch);
    }
  }
  assert.equal(covered.size, 12, "월덕 조견표가 12개월을 전부 덮어야 한다");
});

test("사전 sinsal/gongmang: 6순 공망표가 엔진 산출과 같다", () => {
  const e = entry("sinsal", "gongmang");
  const p = soleParagraph(e, (t) => /갑자순/.test(t) && /공망/.test(t), "공망 6순표");
  const rows = [
    ...p.matchAll(
      /([가-힣]{2})순\(([一-鿿]{2})~[一-鿿]{2}\)\s*→\s*([가-힣])·([가-힣])\s*공망/g,
    ),
  ];
  assert.equal(rows.length, 6, `공망 6순표를 파싱하지 못했다(${rows.length}개)`);
  for (const m of rows) {
    const head = m[2]; // 순의 첫 갑자 (甲子 등)
    const dict = [mustBranch(m[3], "공망표"), mustBranch(m[4], "공망표")].sort();
    const engine = gongmangOf(head[0], head[1]).sort();
    assert.deepEqual(engine, dict, `공망: ${head}순 불일치`);
    // 순 전체(10갑자)가 같은 공망을 갖는지도 확인 — 순 단위 규칙의 핵심
    const startIdx = SIXTY_PILLARS.findIndex((s) => s.stem === head[0] && s.branch === head[1]);
    assert.ok(startIdx >= 0, `공망: ${head}가 60갑자에 없다`);
    for (let k = 0; k < 10; k++) {
      const s = SIXTY_PILLARS[(startIdx + k) % 60];
      assert.deepEqual(
        gongmangOf(s.stem, s.branch).sort(),
        dict,
        `공망: ${s.stem}${s.branch}가 ${head}순 공망과 다르다`,
      );
    }
  }
});

test("사전 sinsal/baekho·gwaegang: 해당 일주 목록이 엔진 검출과 같다", () => {
  const baekho = entry("sinsal", "baekho");
  const bp = soleParagraph(baekho, (t) => /백호 일주는 7개입니다/.test(t), "백호 7갑자");
  const bDict = [...bp.matchAll(/\(([一-鿿]{2})\)/g)].map((m) => m[1]).sort();
  assert.equal(bDict.length, 7, `백호 7갑자를 파싱하지 못했다(${bDict.length})`);
  const bEngine = SIXTY_PILLARS.filter((s) => isDayPillarShinsal("baekho", s.stem, s.branch))
    .map((s) => s.stem + s.branch)
    .sort();
  assert.deepEqual(bDict, bEngine, "백호 일주 목록이 엔진과 다르다");

  const gwaegang = entry("sinsal", "gwaegang");
  const gRaw = highlightOf(gwaegang, "해당 일주");
  const gDict = [...gRaw.matchAll(/\(([一-鿿]{2})\)/g)].map((m) => m[1]).sort();
  assert.equal(gDict.length, 4, `괴강 4갑자를 파싱하지 못했다(${gDict.length})`);
  const gEngine = SIXTY_PILLARS.filter((s) => isDayPillarShinsal("goegang", s.stem, s.branch))
    .map((s) => s.stem + s.branch)
    .sort();
  assert.deepEqual(gDict, gEngine, "괴강 일주 목록이 엔진과 다르다");
});

test("사전 sinsal/wonjin: 원진 6쌍이 엔진 WONJIN과 같다", () => {
  const e = entry("sinsal", "wonjin");
  const raw = highlightOf(e, "조합");
  const pairs = raw
    .replace(/\(.*\)/, "")
    .split("·")
    .map((t) => t.trim())
    .filter(Boolean);
  assert.equal(pairs.length, 6, `원진 6쌍을 파싱하지 못했다(${pairs.length}) — "${raw}"`);
  const dict = pairs
    .map((t) => {
      assert.equal(t.length, 2, `원진 "${t}" 형식 오류`);
      return [mustBranch(t[0], "원진"), mustBranch(t[1], "원진")].join("");
    })
    .sort();
  const engine = WONJIN.map(([a, b]) => a + b).sort();
  assert.deepEqual(dict, engine, "원진 6쌍이 엔진과 다르다");
});

// ═════════════════════════════════════════════════════════════
// 7. 합·충·형 — relation 카테고리 ↔ 엔진 상수
// ═════════════════════════════════════════════════════════════
test("사전 relation: 지지 6합 6편이 엔진 YUKAP(변화오행 포함)과 같다", () => {
  const entries = getDictEntriesByCategory("relation").filter((e) => e.slug.endsWith("-hap") && BRANCH_INFO[e.hanja[0]]);
  assert.equal(entries.length, 6, `지지 6합 페이지가 6편이어야 한다(${entries.length})`);
  const engine = new Map(YUKAP.map(([a, b, el]) => [a + b, el]));
  for (const e of entries) {
    const pair = e.hanja.slice(0, 2);
    const el = engine.get(pair);
    assert.ok(el, `${e.slug}: ${pair} 쌍이 엔진 YUKAP에 없다`);
    const raw = highlightOf(e, "변화 오행");
    assert.ok(raw.startsWith(`${el}(`), `${e.slug}: 변화 오행 "${raw}" ≠ ${el}`);
  }
  assert.equal(new Set(entries.map((e) => e.hanja.slice(0, 2))).size, 6, "6합 쌍이 중복 없이 6개여야 한다");
});

test("사전 relation: 천간 5합 5편이 battle-interaction의 천간합 표와 같다", () => {
  // 엔진의 천간합은 battle-interaction.ts / yearly-interaction.ts에 사본으로만 존재하고
  // export되지 않는다(두 사본의 일치는 saju-facts-engine.test.ts가 별도로 강제한다).
  const src = readFileSync(fileURLToPath(new URL("./utils/battle-interaction.ts", import.meta.url)), "utf8");
  const block = /const\s+CHEONGAN_HAP\b[^=]*=\s*\[([\s\S]*?)\];/.exec(src);
  assert.ok(block, "battle-interaction.ts에서 CHEONGAN_HAP을 찾지 못했다 — 파싱 실패는 통과가 아니다");
  const engine = [...block![1].matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)]
    .map((m) => m[1] + m[2])
    .sort();
  assert.equal(engine.length, 5, "천간합은 5쌍이다");

  const entries = getDictEntriesByCategory("relation").filter(
    (e) => e.slug.endsWith("-hap") && STEM_ELEMENT[e.hanja[0]],
  );
  assert.equal(entries.length, 5, `천간 5합 페이지가 5편이어야 한다(${entries.length})`);
  const dict = entries.map((e) => e.hanja.slice(0, 2)).sort();
  assert.deepEqual(dict, engine, "천간 5합 쌍이 엔진과 다르다");
});

test("사전 relation: 삼합 4편·방합 4편이 엔진 SAMHAP·BANGHAP과 같다", () => {
  const check = (suffix: string, table: [string, string, string, KoreanElement][], label: string) => {
    const entries = getDictEntriesByCategory("relation").filter((e) => e.slug.endsWith(suffix));
    assert.equal(entries.length, 4, `${label} 페이지가 4편이어야 한다(${entries.length})`);
    const engine = new Map(table.map(([a, b, c, el]) => [a + b + c, el]));
    for (const e of entries) {
      const trio = e.hanja.replace(/\s/g, "").slice(0, 3);
      const el = engine.get(trio);
      assert.ok(el, `${e.slug}: ${trio}가 엔진 ${label} 표에 없다`);
      const raw = highlightOf(e, "변화 오행");
      assert.ok(raw.startsWith(`${el}(`), `${e.slug}: 변화 오행 "${raw}" ≠ ${el}`);
    }
    assert.equal(new Set(entries.map((e) => e.hanja.replace(/\s/g, "").slice(0, 3))).size, 4, `${label} 중복`);
  };
  check("-samhap", SAMHAP, "삼합");
  check("-banghap", BANGHAP, "방합");
});

test("사전 relation: 지지 6충 6편이 엔진 YUKCHUNG과 같다", () => {
  const entries = getDictEntriesByCategory("relation").filter((e) => e.slug.endsWith("-chung"));
  assert.equal(entries.length, 6, `6충 페이지가 6편이어야 한다(${entries.length})`);
  const dict = entries.map((e) => e.hanja.slice(0, 2)).sort();
  const engine = YUKCHUNG.map(([a, b]) => a + b).sort();
  assert.deepEqual(dict, engine, "6충 쌍이 엔진과 다르다");
});

test("사전 relation: 형(刑) 4편의 구성 지지가 엔진 HYUNG과 같다", () => {
  const engineGroups = HYUNG.map(([g]) => g);
  const samhyung = engineGroups.filter((g) => g.length === 3).map((g) => [...g].sort().join(""));
  const jahyung = engineGroups.filter((g) => g.length === 2 && g[0] === g[1]).map((g) => g[0]);
  const sanghyung = engineGroups.filter((g) => g.length === 2 && g[0] !== g[1]).map((g) => [...g].sort().join(""));

  const parseGroup = (slug: string, label: string) => {
    const e = entry("relation", slug);
    const raw = highlightOf(e, "구성 지지");
    const parsed = raw
      .split("·")
      .map((t) => mustBranch(t, `${slug} ${label}`))
      .sort()
      .join("");
    return parsed;
  };
  assert.ok(samhyung.includes(parseGroup("insin-hyung", "삼형")), "인사신 삼형이 엔진 HYUNG과 다르다");
  assert.ok(samhyung.includes(parseGroup("chuksulmi-hyung", "삼형")), "축술미 삼형이 엔진 HYUNG과 다르다");
  assert.equal(samhyung.length, 2, "엔진 삼형은 2조여야 한다");
  assert.ok(sanghyung.includes(parseGroup("jamyo-hyung", "상형")), "자묘 상형이 엔진 HYUNG과 다르다");
  assert.equal(sanghyung.length, 1, "엔진 상형은 1조여야 한다");

  const jah = entry("relation", "jahyung");
  const kinds = highlightOf(jah, "종류")
    .split("·")
    .map((t) => t.trim())
    .filter(Boolean);
  assert.equal(kinds.length, 4, `자형 4종을 파싱하지 못했다(${kinds.length})`);
  const dictJa = kinds
    .map((t) => {
      assert.equal(t.length, 2, `자형 "${t}" 형식 오류`);
      assert.equal(t[0], t[1], `자형 "${t}"는 같은 글자 둘이어야 한다`);
      return mustBranch(t[0], "자형");
    })
    .sort();
  assert.deepEqual(dictJa, [...jahyung].sort(), "자형 4종이 엔진 HYUNG과 다르다");
});

// ═════════════════════════════════════════════════════════════
// 8. 오행 상생·상극 순환 ↔ GENERATES / CONTROLS
// ═════════════════════════════════════════════════════════════
test("사전 ohaeng/sangsaeng·sanggeuk: 순환 highlight가 엔진 GENERATES·CONTROLS와 같다", () => {
  const check = (slug: string, table: Record<KoreanElement, KoreanElement>, label: string) => {
    const e = entry("ohaeng", slug);
    const raw = highlightOf(e, "순환");
    const chain = raw.split("→").map((t) => t.trim());
    assert.equal(chain.length, 6, `${slug}: 순환 "${raw}" 파싱 실패(6칸이어야 함)`);
    assert.equal(chain[0], chain[5], `${slug}: 순환이 닫히지 않았다`);
    for (let i = 0; i < 5; i++) {
      const from = chain[i] as KoreanElement;
      assert.ok(table[from], `${slug}: "${from}"이 오행이 아니다`);
      assert.equal(table[from], chain[i + 1], `${slug}(${label}): ${from} 다음이 엔진과 다르다`);
    }
  };
  check("sangsaeng", GENERATES, "상생");
  check("sanggeuk", CONTROLS, "상극");
});

// ═════════════════════════════════════════════════════════════
// 9. 프로즈 스팟 회귀 가드 (과거 사고 재발 방지)
// ═════════════════════════════════════════════════════════════
test("스팟 가드: 사전 전체에 '검재' 오기가 없다 (겁살 → 검재 오타 사고)", () => {
  const hits: string[] = [];
  for (const e of getAllDictEntries()) {
    for (const t of [...assertions(e), ...e.faq.map((f) => f.q)]) {
      if (t.includes("검재")) hits.push(`${e.category}/${e.slug}: ${t.slice(0, 60)}`);
    }
  }
  assert.deepEqual(hits, [], `"검재"(劫財 오기)가 남아 있다:\n${hits.join("\n")}`);
});

test("스팟 가드: 망신살 한자는 亡神殺 1종만 쓴다 (엔진 라벨 포함)", () => {
  for (const e of getAllDictEntries()) {
    for (const t of [...assertions(e), ...e.faq.map((f) => f.q)]) {
      assert.ok(!t.includes("亡身"), `${e.category}/${e.slug}: 비표준 표기 "亡身殺" 사용`);
    }
  }
  // 엔진 라벨도 같은 표기여야 한다 — 해묘미 그룹(년지 亥)의 망신은 寅
  const r = findShinsal("寅", "甲", "寅", ["亥", "寅", "寅", "寅"], false, ["甲", "甲", "甲", "甲"]);
  const mangsin = r.matches.find((m) => m.key === "mangsin");
  assert.ok(mangsin, "엔진에서 망신살을 검출하지 못했다 — 프로브 조건이 깨졌다");
  assert.ok(mangsin!.label.includes("亡神殺"), `엔진 망신살 라벨이 비표준: ${mangsin!.label}`);
});

test("스팟 가드: '목욕=도화' 서술은 반드시 양간 한정어를 단다 (7/31 사고)", () => {
  for (const e of getAllDictEntries()) {
    for (const t of assertions(e)) {
      if (!t.includes("목욕") || !t.includes("도화")) continue;
      assert.ok(
        /양\s*\(陽\)\s*일간|양간|양 일간/.test(t),
        `${e.category}/${e.slug}: 목욕=도화 서술에 양간 한정어가 없다 — "${t.slice(0, 80)}"`,
      );
    }
  }
});

test("스팟 가드: 신살 기준지는 년지로 통일 — '년지 또는 일지' 병기 금지", () => {
  // 엔진(findShinsal 삼합 신살 · getPillar12Shinsal)은 년지만 본다.
  // 사전이 일지 기준을 병기하면 엔진이 검출하지 않는 것을 사용자에게 약속하는 셈이다.
  const BANNED = /년지\s*[·(]?\s*(또는|혹은)?\s*일지|일지\s*[·(]?\s*(또는|혹은)?\s*년지/;
  for (const e of getAllDictEntries()) {
    const offending = assertions(e).filter((t) => BANNED.test(t) && /삼합|12신살|신살|도화|역마|화개/.test(t));
    driftAware(
      `gijunji:${e.category}/${e.slug}`,
      offending.length === 0,
      `${e.category}/${e.slug}: 기준지에 일지가 병기돼 있다(엔진은 년지만 본다)\n  ${offending
        .map((t) => t.slice(0, 90))
        .join("\n  ")}`,
    );
  }
});

test("스팟 가드: sipisinsal 12편의 '산출 기준'은 전부 년지 기준이다", () => {
  for (const e of getDictEntriesByCategory("sipisinsal")) {
    const value = highlightOf(e, "산출 기준");
    assert.ok(value.includes("년지"), `${e.slug}: 산출 기준 "${value}"에 년지가 없다`);
    assert.ok(!value.includes("일지"), `${e.slug}: 산출 기준 "${value}"에 일지가 병기돼 있다`);
  }
});
