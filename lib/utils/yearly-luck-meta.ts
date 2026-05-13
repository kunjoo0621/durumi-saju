import type { EnrichedSajuData, KoreanElement } from "./saju-enrichment";
import { STEM_ELEMENT } from "./saju-enrichment";

// 명리학 표준 오행 → 행운 메타 매핑.
// 용신(用神, 보충하면 이로운 기운) 기반 → 활용하면 좋은 색·숫자·방위·아이템
// 기신(忌神, 피해야 할 기운) 기반 → 회피해야 할 색·방위

/* ────────── 1. 오행 → 색 ────────── */

export interface ColorMeta {
  korean: string;       // "초록·청록"
  primary: string;      // 대표 HEX
  palette: string[];    // 비주얼 그라데이션용 2~3개
}

export const ELEMENT_COLOR: Record<KoreanElement, ColorMeta> = {
  목: { korean: "초록·청록", primary: "#16A34A", palette: ["#16A34A", "#14B8A6"] },
  화: { korean: "빨강·핑크", primary: "#EF4444", palette: ["#EF4444", "#F97316", "#EC4899"] },
  토: { korean: "노랑·황금", primary: "#F59E0B", palette: ["#EAB308", "#F59E0B", "#A16207"] },
  금: { korean: "흰색·은색", primary: "#E2E8F0", palette: ["#F8FAFC", "#94A3B8"] },
  수: { korean: "검정·파랑", primary: "#3B82F6", palette: ["#1E293B", "#3B82F6", "#0EA5E9"] },
};

/* ────────── 2. 오행 → 방위 ────────── */

export interface DirectionMeta {
  korean: string;       // "동쪽"
  hanja: string;        // "東"
  hint: string;         // "출근길은 동쪽으로, 작업 책상은 동쪽 향"
}

export const ELEMENT_DIRECTION: Record<KoreanElement, DirectionMeta> = {
  목: { korean: "동쪽", hanja: "東", hint: "책상 방향·산책 동선을 동쪽 위주로" },
  화: { korean: "남쪽", hanja: "南", hint: "햇볕이 잘 드는 남향 공간이 유리" },
  토: { korean: "중앙", hanja: "中", hint: "한 자리에 고정된 거점을 정해두는 게 유리" },
  금: { korean: "서쪽", hanja: "西", hint: "서향 사무실·서쪽 카페가 집중에 도움" },
  수: { korean: "북쪽", hanja: "北", hint: "북향 공간·물 가까운 곳을 자주 찾으면 안정" },
};

/* ────────── 3. 오행 → 후천수 (행운의 숫자) ────────── */

// 명리학 표준 후천수 (河圖)
const ELEMENT_HOOCHEONSU: Record<KoreanElement, number[]> = {
  수: [1, 6],
  화: [2, 7],
  목: [3, 8],
  금: [4, 9],
  토: [5, 0],
};

// 천간 → 선천수 (天干 先天數)
const STEM_SUNCHEONSU: Record<string, number> = {
  "甲": 9, "己": 9,
  "乙": 8, "庚": 8,
  "丙": 7, "辛": 7,
  "丁": 6, "壬": 6,
  "戊": 5, "癸": 5,
};

/* ────────── 4. 오행 → 라이프스타일 아이템 ────────── */

export const ELEMENT_ITEMS: Record<KoreanElement, string[]> = {
  목: ["식물·녹색 채소", "나무 책상·종이 노트", "아침 산책", "등산·하이킹", "서적·신문"],
  화: ["밝은 조명·캔들", "매콤한 음식", "유산소 운동", "예술·공연 관람", "붉은 액세서리"],
  토: ["정리된 공간·고정 거처", "뿌리채소·곡류", "요가·필라테스", "도자기·세라믹", "황색 패브릭"],
  금: ["깔끔한 미니멀 공간", "견과류·흰살 생선", "호흡 운동·명상", "시계·금속 액세서리", "흰색 침구"],
  수: ["물 가까운 곳·수영", "해산물·차(茶)", "여행·이동", "블루·네이비 톤", "향수·아로마"],
};

/* ────────── 산출 결과 타입 ────────── */

export interface YearlyLuckMeta {
  // 용신(用神) 기반 — 보충하면 이로움
  yongshin: KoreanElement;
  color: ColorMeta & { tone: "보충" };
  direction: DirectionMeta;
  numbers: number[];           // 2~3개. 일간 선천수 1 + 용신 후천수 1~2
  items: string[];             // 4~5개

  // 기신(忌神) 기반 — 피하면 좋음
  gisin: KoreanElement | null;
  avoidColor: { korean: string; primary: string } | null;
  avoidDirection: { korean: string; hanja: string } | null;
}

/* ────────── 메인 함수 ────────── */

export function calculateYearlyLuckMeta(enriched: EnrichedSajuData): YearlyLuckMeta | null {
  const yongshin = enriched.yongshin?.eokbu;
  if (!yongshin) return null;

  const gisin = enriched.yongshin?.gisin ?? null;
  const dayStem = enriched.dayMaster.stem;

  const colorBase = ELEMENT_COLOR[yongshin];
  const direction = ELEMENT_DIRECTION[yongshin];
  const items = ELEMENT_ITEMS[yongshin];

  // 행운의 숫자 = 일간 선천수 + 용신 후천수 (중복 제거)
  const sun = STEM_SUNCHEONSU[dayStem];
  const hoo = ELEMENT_HOOCHEONSU[yongshin] ?? [];
  const numberSet: number[] = [];
  if (typeof sun === "number") numberSet.push(sun);
  for (const n of hoo) {
    if (!numberSet.includes(n)) numberSet.push(n);
  }

  // 기신 메타
  const avoidColor = gisin
    ? { korean: ELEMENT_COLOR[gisin].korean, primary: ELEMENT_COLOR[gisin].primary }
    : null;
  const avoidDirection = gisin
    ? { korean: ELEMENT_DIRECTION[gisin].korean, hanja: ELEMENT_DIRECTION[gisin].hanja }
    : null;

  return {
    yongshin,
    color: { ...colorBase, tone: "보충" },
    direction,
    numbers: numberSet,
    items,
    gisin,
    avoidColor,
    avoidDirection,
  };
}

/* ────────── 프롬프트용 텍스트 블록 ────────── */

export function buildYearlyLuckMetaBlock(meta: YearlyLuckMeta | null): string {
  if (!meta) return "";
  const lines = ["\n[행운 메타 — 용신 기반 (참고용, 본문에 매핑표처럼 반복 금지)]"];
  lines.push(`- 행운의 색: ${meta.color.korean} (용신 ${meta.yongshin} 보충)`);
  lines.push(`- 행운의 방위: ${meta.direction.korean}(${meta.direction.hanja})`);
  lines.push(`- 행운의 숫자: ${meta.numbers.join(", ")}`);
  if (meta.gisin && meta.avoidColor) {
    lines.push(`- 피할 색: ${meta.avoidColor.korean} (기신 ${meta.gisin})`);
  }
  return lines.join("\n");
}
