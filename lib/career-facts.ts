import {
  STEM_ELEMENT,
  BRANCH_INFO,
  CONTROLS,
  GENERATES,
  getTenStar,
  type EnrichedSajuData,
  type KoreanElement,
} from "./utils/saju-enrichment";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

// 커리어운 = "어떤 그릇으로 어느 길을 가야 하는가"(官=조직·직위, 食傷=재능·독립, 印=인정·자격).
// 재물운(wealth-facts)이 재성 축을 다루듯, 이 엔진은 관성·식상·인성 축을 결정론으로 뽑는다.
// 뼈대는 wealth-facts.ts를 미러(가중 모델·위치 극·타이밍 동일 패턴), 십성 축만 교체.

// 사용자가 첫 화면에서 고르는 상황(situation) 4분법. UI 라벨(질문형)과 분리한 명사형 값 —
// DB·API 화이트리스트·career-facts 타입 3곳이 정확히 일치해야 한다(wealth ALLOWED_INTEREST 정책).
//   ①어떤 일이 맞을까=진로 탐색  ②지금 여기서 잘 될까=현직 성장
//   ③옮겨야 하나=이직 고민       ④내 사업 해도 될까=독립·사업
export type CareerSituation = "진로 탐색" | "현직 성장" | "이직 고민" | "독립·사업";

export interface CareerStarHit {
  pillar: "year" | "month" | "day" | "hour";
  source: "천간" | "지장간";
  star: "정관" | "편관";
}

export interface CareerTimingWindow {
  year: number;
  age: number;
  triggers: Array<"관성투출" | "인성투출" | "식상투출">;
  isPast: boolean;
}

// 그릇(官을 감당하는 능력) = (신강/신약) × (weighted 관성 강/약) 2차원 4상한.
// 신약인데 官 과다면 압박·번아웃 신호(관다신약). wealth의 jaeGrip 4상한과 동일 구조.
export type CareerGrip = "신왕관왕" | "신왕관쇠" | "관다신약" | "신약관소";

export interface CareerFacts {
  situation: CareerSituation;
  dayStem: string;
  gwanseong: CareerStarHit[]; // 관성(정관/편관) 위치 목록 — 궁위 번역용
  gwanseongType: "정관우세" | "편관우세" | "관살혼잡" | "무관";
  gwanseongAbsent: boolean; // 무관 = 자유형(조직 얽매임 약함) 서술 폴백
  gwanseongStrength: number; // 관성 weighted 강도
  siksinStrength: number; // 식신 weighted — 전문가 심화형
  sanggwanStrength: number; // 상관 weighted — 독립·창의형
  siksangType: "식신우세" | "상관우세" | "식상혼재" | "무식상";
  inseongStrength: number; // 정인+편인 weighted
  inseongAbsent: boolean; // 인성 부재 = 독학·실전형
  strengthLevel: string; // enriched.strength.result 재사용(재계산 금지)
  careerGrip: CareerGrip; // (신강/신약) × (weighted 관성 강/약) 4상한
  gwandaSinyak: boolean; // careerGrip === "관다신약"에서 파생만(단일 진실원)
  gwaninSangsaeng: boolean; // 관인상생: 관성·인성 둘 다 의미 있는 강도
  sanggwanGyeongwan: boolean; // 상관견관: 상관 천간이 관성 지지를 위치 극(아래)
  yongshinFavorsCareer: boolean; // 억부용신이 관성 오행 또는 인성 오행
  timingWindows: CareerTimingWindow[];
  daeunCareerYears: Array<{ startAge: number; endAge: number; star: string }>; // 관성 대운
}

// "정관(正官)" → "정관"
function bareStar(label: string): string {
  return label.replace(/\(.*\)/, "");
}

// 일간 기준 target 천간이 어떤 십성인지 (bare)
function tenStarOf(dayStem: string, targetStem: string): string | null {
  const dm = STEM_ELEMENT[dayStem];
  const t = STEM_ELEMENT[targetStem];
  if (!dm || !t) return null;
  return bareStar(getTenStar(dm.element, dm.yin_yang, t.element, t.yin_yang));
}

const PILLARS = ["year", "month", "day", "hour"] as const;

const STRONG_LEVELS = new Set(["극왕", "태강", "신강", "중화신강"]);

// ── v2 강약 가중 모델 (wealth-facts.ts와 동일 — 공유 함수로 뽑지 않음: 광범위 리팩토링 금지) ──
//   천간 투출=3 / 지지 정기=2 / 중기=1.5 / 여기=0.5, + 월지 지장간 ×1.5(월령 지배).
const STEM_WEIGHT = 3;
const JIJANGGAN_POSITION_WEIGHT = [2, 1.5, 0.5] as const; // 0=본기 1=중기 2=여기
const JIJANGGAN_FALLBACK_WEIGHT = 0.5;
const MONTH_BRANCH_MULTIPLIER = 1.5;

interface WeightedHit {
  pillar: (typeof PILLARS)[number];
  source: "천간" | "지장간";
  star: string;
  weight: number;
}

// 4주 전체를 훑어 십성별 weighted hit 목록. day 천간(일간 자기 자신)은 제외
// (자기 비교 시 항상 비견이 잡혀 카운트가 허위 팽창 — calculateTenStars와 동일 정책).
function collectWeightedHits(sajuData: SajuData, dayStem: string): WeightedHit[] {
  const hits: WeightedHit[] = [];
  for (const pos of PILLARS) {
    const pillar = sajuData[pos];
    if (!pillar) continue;

    if (pillar.heavenlyStem && pos !== "day") {
      const st = tenStarOf(dayStem, pillar.heavenlyStem);
      if (st) hits.push({ pillar: pos, source: "천간", star: st, weight: STEM_WEIGHT });
    }

    const branch = pillar.earthlyBranch;
    const branchInfo = branch ? BRANCH_INFO[branch] : undefined;
    for (const hiddenStem of pillar.hiddenStems ?? []) {
      const hs = tenStarOf(dayStem, hiddenStem);
      if (!hs) continue;
      const posIdx = branchInfo?.jijanggan.findIndex((j) => j.stem === hiddenStem) ?? -1;
      const baseWeight =
        posIdx >= 0 && posIdx < JIJANGGAN_POSITION_WEIGHT.length
          ? JIJANGGAN_POSITION_WEIGHT[posIdx]
          : JIJANGGAN_FALLBACK_WEIGHT;
      const weight = pos === "month" ? baseWeight * MONTH_BRANCH_MULTIPLIER : baseWeight;
      hits.push({ pillar: pos, source: "지장간", star: hs, weight });
    }
  }
  return hits;
}

function sumWeight(hits: WeightedHit[], starSet: Set<string>): number {
  let total = 0;
  for (const h of hits) {
    if (starSet.has(h.star)) total += h.weight;
  }
  return Math.round(total * 100) / 100;
}

const GWANSEONG_SET = new Set(["정관", "편관"]);
const SIKSIN_SET = new Set(["식신"]);
const SANGGWAN_SET = new Set(["상관"]);
const SIKSSANG_SET = new Set(["식신", "상관"]);
const INSEONG_SET = new Set(["정인", "편인"]);

// ── v1 판정 임계값 (초기값은 wealth 교훈 복사, scripts/career-mc.mts로 재튜닝 필수) ──
// 관성 "강" 컷은 신강/신약 모집단 분리(단일 임계는 죽은 밴드를 만든다는 wealth 교훈).
// 주의: 신약 모집단은 관성이 강한 경향(관성이 일간을 극해 신약의 원인) — MC 실측 후 재조정.
const GWAN_STRONG_THRESHOLD_WHEN_STRONG = 4.5;
const GWAN_STRONG_THRESHOLD_WHEN_WEAK = 8;
// 관인상생 "의미 있는 강도" 최소치. 초기 3은 균등랜덤 MC에서 관인상생 55.9% 과발화
// (목표 ≤50%) — 천간 투출 1개(weight 3)만으로 발화해 변별력이 낮았다. 4로 올려 "단일
// 투출+α" 또는 "정기+중기"급 이상만 관인상생으로 인정(MC 재실측으로 범위 진입 확인).
const MEANINGFUL_THRESHOLD = 4;

// ── 상관견관 위치 극 (marriage detectSpouseStarKeuk 이식, 공격자=상관 단독) ──
// wealth bigeopTaljae(3c2f614)·marriage spouseStarDamaged(15b41fc)가 출시 후 "존재·강도만
// 보고 위치 극을 안 봐 메인 리포트와 모순"을 사후 수정한 버그 — 커리어는 처음부터 위치로 판정.
// ★공격자 = 상관 단독. 식신은 편관을 제압하는 길신(식신제살)이라 관성 공격자로 묶으면
// 명리적으로 틀리고, 개인사주 채점(직장운 -=5 if 상관∧관성)도 상관만 본다(3-layer 정합).
// ★충거(沖去)는 v1 제외 — 결혼운 충거 이중계상(5e4de62)이 과발화 인플레만 낳은 교훈.
const ADJACENT_PILLARS: Record<
  (typeof PILLARS)[number],
  (typeof PILLARS)[number][]
> = {
  year: ["month"],
  month: ["year", "day"],
  day: ["month", "hour"],
  hour: ["day"],
};

// 지지가 관성(정관/편관)을 정기(index0)·중기(index1)로 담았는지 — 여기(0.5)만 스쳐가는
// 경우는 제외(과발화 방지, wealth branchHasStrongJae와 동일 철학).
function branchHasStrongGwan(dayStem: string, branch: string | undefined): boolean {
  if (!branch) return false;
  const info = BRANCH_INFO[branch];
  if (!info) return false;
  return info.jijanggan.slice(0, 2).some((j) => {
    const st = tenStarOf(dayStem, j.stem);
    return st === "정관" || st === "편관";
  });
}

// 상관 천간 존재 여부 — day 천간(일간 자기 자신)은 제외.
function isSanggwanStem(
  dayStem: string,
  pos: (typeof PILLARS)[number],
  sajuData: SajuData,
): boolean {
  if (pos === "day") return false;
  const stem = sajuData[pos]?.heavenlyStem;
  if (!stem) return false;
  return tenStarOf(dayStem, stem) === "상관";
}

// 극(剋) 감지 — 상관 천간이 관성 지지 바로 위(개두) 또는 인접 기둥에 앉아 있는지.
function detectSanggwanGyeongwan(dayStem: string, sajuData: SajuData): boolean {
  for (const pos of PILLARS) {
    if (!isSanggwanStem(dayStem, pos, sajuData)) continue;
    if (branchHasStrongGwan(dayStem, sajuData[pos]?.earthlyBranch)) return true;
    for (const adj of ADJACENT_PILLARS[pos]) {
      if (branchHasStrongGwan(dayStem, sajuData[adj]?.earthlyBranch)) return true;
    }
  }
  return false;
}

// dayMaster 오행을 극하는 오행(=관성 오행) / 생하는 오행(=인성 오행) — 맵에서 역참조로 파생(하드코딩 금지).
function elementThatControls(target: KoreanElement): KoreanElement | undefined {
  return (Object.keys(CONTROLS) as KoreanElement[]).find((e) => CONTROLS[e] === target);
}
function elementThatGenerates(target: KoreanElement): KoreanElement | undefined {
  return (Object.keys(GENERATES) as KoreanElement[]).find((e) => GENERATES[e] === target);
}

export function deriveCareerFacts(
  enriched: EnrichedSajuData,
  fortune: FortuneResult | null,
  sajuData: SajuData,
  situation: CareerSituation,
  currentYear: number,
): CareerFacts {
  const dayStem = sajuData.day.heavenlyStem;
  const dayMasterElement = enriched.dayMaster.element;

  // 1) weighted hit 전체 수집
  const allHits = collectWeightedHits(sajuData, dayStem);

  // 2) 관성(정관/편관) — 위치 목록은 프롬프트/UI가 궁위로 소비
  const gwanseong: CareerStarHit[] = allHits
    .filter((h) => h.star === "정관" || h.star === "편관")
    .map((h) => ({ pillar: h.pillar, source: h.source, star: h.star as "정관" | "편관" }));
  const gwanseongAbsent = gwanseong.length === 0;

  const jeonggwanWeight = sumWeight(allHits, new Set(["정관"]));
  const pyeongwanWeight = sumWeight(allHits, new Set(["편관"]));
  const gwanseongStrength = Math.round((jeonggwanWeight + pyeongwanWeight) * 100) / 100;
  const hasJeonggwan = jeonggwanWeight > 0;
  const hasPyeongwan = pyeongwanWeight > 0;
  const gwanseongType: CareerFacts["gwanseongType"] =
    hasJeonggwan && hasPyeongwan
      ? "관살혼잡"
      : hasJeonggwan
        ? "정관우세"
        : hasPyeongwan
          ? "편관우세"
          : "무관";

  // 3) 식상 — 식신/상관 분리(전문가 심화형 vs 독립·창의형)
  const siksinStrength = sumWeight(allHits, SIKSIN_SET);
  const sanggwanStrength = sumWeight(allHits, SANGGWAN_SET);
  const hasSiksin = siksinStrength > 0;
  const hasSanggwan = sanggwanStrength > 0;
  const siksangType: CareerFacts["siksangType"] =
    hasSiksin && hasSanggwan
      ? "식상혼재"
      : hasSiksin
        ? "식신우세"
        : hasSanggwan
          ? "상관우세"
          : "무식상";

  // 4) 인성
  const inseongStrength = sumWeight(allHits, INSEONG_SET);
  const inseongAbsent = inseongStrength === 0;

  // 5) 신강/신약 (enrichSajuData 단계 계산값 재사용 — 재계산 금지)
  const strengthLevel = enriched.strength.result;
  const isStrong = STRONG_LEVELS.has(strengthLevel);

  // 6) 그릇(careerGrip): (신강/신약) × (weighted 관성 강/약) 4상한. gwandaSinyak은 여기서 파생만.
  const gwanStrongThreshold = isStrong
    ? GWAN_STRONG_THRESHOLD_WHEN_STRONG
    : GWAN_STRONG_THRESHOLD_WHEN_WEAK;
  const gwanseongStrong = gwanseongStrength >= gwanStrongThreshold;
  const careerGrip: CareerGrip = isStrong
    ? gwanseongStrong
      ? "신왕관왕"
      : "신왕관쇠"
    : gwanseongStrong
      ? "관다신약"
      : "신약관소";
  const gwandaSinyak = careerGrip === "관다신약";

  // 7) 관인상생: 관성·인성 둘 다 의미 있는 강도(자격·인정이 커리어를 밀어주는 순환)
  const gwaninSangsaeng =
    gwanseongStrength >= MEANINGFUL_THRESHOLD && inseongStrength >= MEANINGFUL_THRESHOLD;

  // 8) 상관견관: 위치 기반 극(존재·강도만 아니라 개두/인접까지 봄 — 버그 선반영)
  const sanggwanGyeongwan = detectSanggwanGyeongwan(dayStem, sajuData);

  // 9) 용신이 관성/인성 오행을 반기는지 — 억부용신(eokbu) 오행 일치
  const gwanElement = elementThatControls(dayMasterElement);
  const inElement = elementThatGenerates(dayMasterElement);
  const yongshinFavorsCareer =
    enriched.yongshin.eokbu === gwanElement || enriched.yongshin.eokbu === inElement;

  // 10) 타이밍 — 관성투출/인성투출/식상투출 + 대운 관성 구간
  const { timingWindows, daeunCareerYears } = deriveTiming(fortune, currentYear);

  // ── 불변식 런타임 가드(회귀 즉시 검출) ──
  if (gwandaSinyak !== (careerGrip === "관다신약")) {
    throw new Error(
      `[career-facts] 불변식 위반: gwandaSinyak(${gwandaSinyak}) ≠ (careerGrip==="관다신약")(${careerGrip})`,
    );
  }
  if (sanggwanGyeongwan && gwanseongAbsent) {
    throw new Error("[career-facts] 불변식 위반: 무관(관성 없음)인데 상관견관 발화");
  }

  return {
    situation,
    dayStem,
    gwanseong,
    gwanseongType,
    gwanseongAbsent,
    gwanseongStrength,
    siksinStrength,
    sanggwanStrength,
    siksangType,
    inseongStrength,
    inseongAbsent,
    strengthLevel,
    careerGrip,
    gwandaSinyak,
    gwaninSangsaeng,
    sanggwanGyeongwan,
    yongshinFavorsCareer,
    timingWindows,
    daeunCareerYears,
  };
}

// 세운 3트리거(관성투출·인성투출·식상투출) + 대운 관성 구간.
// 비겁 트리거는 v1 제외 — 커리어에서 비겁은 "동료·경쟁" 서사인데 트리거 4종이 되면
// 거의 매년이 트리거가 돼(십성 6/10 커버) 타이밍의 희소가치가 죽는다. 3종(6/10)도
// wealth(재성2+식상2+비겁2)와 동일 커버리지.
// FortuneResult.seun[].tenStar / daeun.pillars[].tenStar 는 이미 bare(한자 미포함)지만
// 형식이 바뀌어도 깨지지 않도록 bareStar()를 그대로 적용(wealth 엔진 동일 안전장치).
function deriveTiming(
  fortune: FortuneResult | null,
  currentYear: number,
): {
  timingWindows: CareerTimingWindow[];
  daeunCareerYears: CareerFacts["daeunCareerYears"];
} {
  const timingWindows: CareerTimingWindow[] = [];
  const daeunCareerYears: CareerFacts["daeunCareerYears"] = [];
  if (!fortune) return { timingWindows, daeunCareerYears };

  for (const s of fortune.seun ?? []) {
    const triggers: CareerTimingWindow["triggers"] = [];
    const st = bareStar(s.tenStar);
    if (GWANSEONG_SET.has(st)) triggers.push("관성투출");
    if (INSEONG_SET.has(st)) triggers.push("인성투출");
    if (SIKSSANG_SET.has(st)) triggers.push("식상투출");
    if (triggers.length > 0) {
      timingWindows.push({ year: s.year, age: s.age, triggers, isPast: s.year < currentYear });
    }
  }

  for (const d of fortune.daeun?.pillars ?? []) {
    const st = bareStar(d.tenStar);
    if (GWANSEONG_SET.has(st)) {
      daeunCareerYears.push({ startAge: d.startAge, endAge: d.endAge, star: st });
    }
  }

  return { timingWindows, daeunCareerYears };
}
