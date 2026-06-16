// 일진(日辰) 가중 — 오늘의 운세 등급을 날짜별로 변동시키는 모듈
//
// 설계 원칙:
//   - 원국(natal) scoring(saju-scoring.ts)은 절대 건드리지 않는다.
//   - 원국 composite를 기준점(anchor)으로 두고, 그날 일진이 원국과 맺는
//     관계(지지 합충형 / 천간 생극 / 용신·기신)를 ±점수로 환산해 얹는다.
//   - 보정 폭은 ±12로 제한 — 일진은 원국을 "흔들" 뿐 "뒤집지" 않는다.
//     (D 원국이 하루 만에 S가 되거나, S 원국이 D로 추락하지 않음)
//   - 모든 입력은 한글 오행("목/화/토/금/수")으로 통일 (enrichment와 동일).

import { BRANCH_INFO, type PairRelation, type KoreanElement } from "@/lib/utils/saju-enrichment";
import {
  gradeFromComposite,
  percentileRankFromComposite,
  topPercentFromPercentileRank,
  clampValue,
  type GradeLabel,
} from "@/lib/gradeSystem";

export const TODAY_DAILY_VERSION = 1;

const DELTA_CAP = 12;

// ── 지지 관계 가중 (일진 지지 ↔ 본인 일지) ──
// 합 계열 = 협력·기회·안정(+), 충/형/원진 = 변동·충돌·소모(-).
// 같은 글자(同)는 안정·반복으로 소폭 +.
const BRANCH_SCORE: Record<PairRelation, number> = {
  hap: 6, // 6합 — 끌림·결합
  samhap: 5, // 삼합 반합 — 같은 의지
  banghap: 4, // 방합 — 같은 계절
  same: 2, // 동일 지지 — 안정·반복
  none: 0,
  wonjin: -3, // 원진 — 보이지 않는 충돌
  hyung: -4, // 형 — 마찰·구설
  chung: -7, // 충 — 정면 충돌
};

// ── 천간 생극 가중 (일진 천간 ↔ 본인 일간) ──
// today-prompt의 getStemRelation이 만든 label 문자열을 분류.
function stemScore(label: string): number {
  if (label.includes("일진이 본인을 생함")) return 5; // 도움·자원 옴
  if (label.includes("일진이 본인을 극함")) return -5; // 압박·통제 받음
  if (label.includes("본인이 일진을 극함")) return 2; // 내가 주도
  if (label.includes("본인이 일진을 생함")) return -1; // 에너지 내줌(소모)
  if (label.includes("비화")) return 1; // 같은 오행 — 편함
  return 0;
}

// ── 일진 십성 → 활성 분야 매핑 ──
// 그날 일진(천간 십성)이 "어느 분야를 건드리는지". 해당 분야는 그날 기운(delta)을
// 더 크게, 나머지는 약하게 받아 — 막대가 균일 이동이 아니라 분야별로 차등 변동.
type DailyCategory = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

function focusCategory(tenStar: string): DailyCategory | null {
  if (tenStar.includes("정재") || tenStar.includes("편재")) return "재물운"; // 재성
  if (tenStar.includes("정관") || tenStar.includes("편관")) return "직장운"; // 관성
  if (tenStar.includes("정인") || tenStar.includes("편인")) return "건강운"; // 인성=자원·휴식
  if (tenStar.includes("비견") || tenStar.includes("겁재")) return "대인운"; // 비겁=동료·경쟁
  if (tenStar.includes("식신") || tenStar.includes("상관")) return "연애운"; // 식상=표현·매력
  return null;
}

export type TodayMood = "강세" | "보통" | "주의" | "위기";

// 날씨/mood는 "그 사람 기준 오늘이 얼마나 좋은 날인지"(delta)에 앵커 — 상대값.
// 절대 등급이 아니라 원국 대비 변동폭이라, 원국이 낮아도 좋은 일진 날엔 맑음을 본다.
// (등급 자체는 화면에 안 보이므로 "낮은 등급인데 맑음"이 사용자에겐 보이지 않음)
//   delta ≥ +4 강세=맑음 / -2~+3 보통=흐림 / -6~-3 주의=비 / ≤ -7 위기=폭풍
export function moodFromDaily(delta: number): TodayMood {
  if (delta >= 4) return "강세"; // 그 사람 기준 확연히 좋은 날 → 맑음
  if (delta >= -2) return "보통"; // 평범한 날(중립 부근) → 흐림
  if (delta >= -6) return "주의"; // 확연히 나쁜 날 → 비
  return "위기"; // 충 등 강한 흉 → 폭풍
}

export interface DailyModifierInput {
  masterComposite: number;
  masterScores: Record<string, number>;
  branchRelationType: PairRelation;
  stemRelationLabel: string;
  todayStemElement: KoreanElement; // 일진 천간 오행
  todayBranchElement: KoreanElement; // 일진 지지 오행
  todayTenStar: string; // 일진 천간 십성 (본인 일간 기준) — 분야별 차등용
  yongshin: KoreanElement | undefined; // 본인 억부용신
  gisin: KoreanElement | undefined; // 본인 기신
}

export interface DailyModifierResult {
  delta: number;
  dailyComposite: number;
  dailyGrade: GradeLabel;
  dailyPercentileRank: number;
  dailyTopPercent: number;
  dailyScores: Record<string, number>;
  focusCategory: DailyCategory | null; // 그날 일진이 활성화한 분야 (없으면 null)
  breakdown: { branch: number; stem: number; yongshin: number };
}

export function computeDailyModifier(input: DailyModifierInput): DailyModifierResult {
  const branch = BRANCH_SCORE[input.branchRelationType] ?? 0;
  const stem = stemScore(input.stemRelationLabel);

  // ── 용신/기신 가중 (그날 일진 오행이 본인에게 약/독인지) ──
  // 천간(표출)을 지지보다 무겁게. 억부용신 = 신강신약 보정의 정수라
  // 십성 길흉을 중복 계산하지 않고 이걸로 대표.
  let yongshin = 0;
  if (input.yongshin) {
    if (input.todayStemElement === input.yongshin) yongshin += 3;
    if (input.todayBranchElement === input.yongshin) yongshin += 2;
  }
  if (input.gisin) {
    if (input.todayStemElement === input.gisin) yongshin -= 3;
    if (input.todayBranchElement === input.gisin) yongshin -= 2;
  }

  const rawDelta = branch + stem + yongshin;
  const delta = Math.round(clampValue(rawDelta, -DELTA_CAP, DELTA_CAP));

  const dailyComposite = Math.round(clampValue(input.masterComposite + delta, 0, 100));
  const dailyGrade = gradeFromComposite(dailyComposite);
  const dailyPercentileRank = percentileRankFromComposite(dailyComposite);
  const dailyTopPercent = topPercentFromPercentileRank(dailyPercentileRank);

  // 5분야 점수 — 그날 일진 십성이 활성화한 분야는 크게(×1.6), 나머지는 약하게(×0.85).
  // 5분야 평균 ≈ delta로 유지돼 composite와의 정합성은 그대로 두면서,
  // "오늘 특히 뜨거운 분야"가 막대 숫자로도 드러남. (focus 없으면 균일 delta)
  const focus = focusCategory(input.todayTenStar);
  const dailyScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.masterScores)) {
    const catDelta = focus ? Math.round(delta * (k === focus ? 1.6 : 0.85)) : delta;
    dailyScores[k] = Math.round(clampValue(v + catDelta, 0, 100));
  }

  return {
    delta,
    dailyComposite,
    dailyGrade,
    dailyPercentileRank,
    dailyTopPercent,
    dailyScores,
    focusCategory: focus,
    breakdown: { branch, stem, yongshin },
  };
}
