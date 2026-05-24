import type { EnrichedSajuData } from "./saju-enrichment";
import {
  STEM_ELEMENT,
  BRANCH_INFO,
  YUKAP,
  YUKCHUNG,
  HYUNG,
  SAMHAP,
} from "./saju-enrichment";
import type { SeunEntry } from "./saju-fortune";
import { getNapum, type NapumEntry } from "@/lib/constants/napum";

// 천간충 / 천간합 — battle-interaction.ts와 동일한 표준 매핑 재정의
// (배틀 모듈은 두 사람 일간만 비교 — yearly는 세운 천간을 4주 천간 전체에 매칭하므로 별도 모듈로 둔다)
const CHEONGAN_HAP: [string, string][] = [
  ["甲", "己"], ["乙", "庚"], ["丙", "辛"], ["丁", "壬"], ["戊", "癸"],
];
const CHEONGAN_CHUNG: [string, string][] = [
  ["甲", "庚"], ["乙", "辛"], ["丙", "壬"], ["丁", "癸"],
];

export interface YearlyStemInteraction {
  position: "year" | "month" | "day" | "hour";
  positionLabel: string;     // 년간 / 월간 / 일간 / 시간
  originStem: string;        // 원국 천간 (한자)
  originKorean: string;      // 갑 / 을 / ...
  type: "합" | "충";
  detail: string;            // "년간 甲과 세운 庚: 갑경충(甲庚冲)"
}

export interface YearlyBranchInteraction {
  position: "year" | "month" | "day" | "hour";
  positionLabel: string;     // 년지 / 월지 / 일지 / 시지
  originBranch: string;      // 원국 지지 (한자)
  originKorean: string;      // 자 / 축 / ...
  type: "충" | "합" | "형" | "삼합완성";
  detail: string;
}

export interface YearlyInteractionResult {
  targetYear: number;
  pillar: string;              // 丙午
  stem: string;
  branch: string;
  pillarKorean: string;        // 병오
  tenStar: string;             // 편관 등 (fortune.seun에서 전달받음)
  twelveStage: string;         // 욕 등
  stemInteractions: YearlyStemInteraction[];
  branchInteractions: YearlyBranchInteraction[];
  napum: NapumEntry | null;
  summary: string;             // 한 문장 요약 (프롬프트 헤더용)
}

const POSITION_LABEL_STEM: Record<"year" | "month" | "day" | "hour", string> = {
  year: "년간",
  month: "월간",
  day: "일간",
  hour: "시간",
};

const POSITION_LABEL_BRANCH: Record<"year" | "month" | "day" | "hour", string> = {
  year: "년지",
  month: "월지",
  day: "일지",
  hour: "시지",
};

function pillarKoreanFor(stem: string, branch: string): string {
  const stemK = STEM_ELEMENT[stem]?.korean ?? stem;
  const branchK = BRANCH_INFO[branch]?.korean ?? branch;
  return `${stemK}${branchK}`;
}

function buildStemInteractions(
  enriched: EnrichedSajuData,
  seunStem: string,
): YearlyStemInteraction[] {
  const seunKorean = STEM_ELEMENT[seunStem]?.korean ?? seunStem;
  const positions: Array<"year" | "month" | "day" | "hour"> = ["year", "month", "day", "hour"];
  const out: YearlyStemInteraction[] = [];

  for (const pos of positions) {
    const pillar = enriched.pillars[pos];
    if (!pillar) continue;
    const originStem = pillar[0];
    if (!originStem) continue;
    const originKorean = STEM_ELEMENT[originStem]?.korean ?? originStem;
    const posLabel = POSITION_LABEL_STEM[pos];

    for (const [a, b] of CHEONGAN_HAP) {
      if ((originStem === a && seunStem === b) || (originStem === b && seunStem === a)) {
        out.push({
          position: pos,
          positionLabel: posLabel,
          originStem,
          originKorean,
          type: "합",
          detail: `${posLabel} ${originKorean}(${originStem}) × 세운 ${seunKorean}(${seunStem}) — 천간합`,
        });
      }
    }
    for (const [a, b] of CHEONGAN_CHUNG) {
      if ((originStem === a && seunStem === b) || (originStem === b && seunStem === a)) {
        out.push({
          position: pos,
          positionLabel: posLabel,
          originStem,
          originKorean,
          type: "충",
          detail: `${posLabel} ${originKorean}(${originStem}) × 세운 ${seunKorean}(${seunStem}) — 천간충`,
        });
      }
    }
  }
  return out;
}

function buildBranchInteractions(
  enriched: EnrichedSajuData,
  seunBranch: string,
): YearlyBranchInteraction[] {
  const seunKorean = BRANCH_INFO[seunBranch]?.korean ?? seunBranch;
  const positions: Array<"year" | "month" | "day" | "hour"> = ["year", "month", "day", "hour"];
  const out: YearlyBranchInteraction[] = [];

  // 4주 지지 수집 (시지가 null인 경우 제외)
  const originBranches: Array<{ pos: "year" | "month" | "day" | "hour"; branch: string }> = [];
  for (const pos of positions) {
    const pillar = enriched.pillars[pos];
    if (!pillar) continue;
    const branch = pillar[1];
    if (!branch) continue;
    originBranches.push({ pos, branch });
  }

  // 1) 지지충
  for (const { pos, branch } of originBranches) {
    const originKorean = BRANCH_INFO[branch]?.korean ?? branch;
    for (const [a, b] of YUKCHUNG) {
      if ((branch === a && seunBranch === b) || (branch === b && seunBranch === a)) {
        out.push({
          position: pos,
          positionLabel: POSITION_LABEL_BRANCH[pos],
          originBranch: branch,
          originKorean,
          type: "충",
          detail: `${POSITION_LABEL_BRANCH[pos]} ${originKorean}(${branch}) × 세운 ${seunKorean}(${seunBranch}) — 지지충`,
        });
      }
    }
  }

  // 2) 지지합 (육합)
  for (const { pos, branch } of originBranches) {
    const originKorean = BRANCH_INFO[branch]?.korean ?? branch;
    for (const [a, b, elem] of YUKAP) {
      if ((branch === a && seunBranch === b) || (branch === b && seunBranch === a)) {
        out.push({
          position: pos,
          positionLabel: POSITION_LABEL_BRANCH[pos],
          originBranch: branch,
          originKorean,
          type: "합",
          detail: `${POSITION_LABEL_BRANCH[pos]} ${originKorean}(${branch}) × 세운 ${seunKorean}(${seunBranch}) — 육합 → ${elem} 강화`,
        });
      }
    }
  }

  // 3) 지지형
  for (const { pos, branch } of originBranches) {
    const originKorean = BRANCH_INFO[branch]?.korean ?? branch;
    for (const [group, name] of HYUNG) {
      // 자형(같은 글자 2개) — 세운에서 보태져 자형 발현
      if (group.length === 2 && group[0] === group[1]) {
        if (branch === group[0] && seunBranch === group[0]) {
          out.push({
            position: pos,
            positionLabel: POSITION_LABEL_BRANCH[pos],
            originBranch: branch,
            originKorean,
            type: "형",
            detail: `${POSITION_LABEL_BRANCH[pos]} ${originKorean}와 세운 ${seunKorean} — ${name} 발현`,
          });
        }
        continue;
      }
      // 일반 형: 원국에 group 멤버 1개 + 세운이 다른 멤버
      if (group.includes(branch) && group.includes(seunBranch) && branch !== seunBranch) {
        out.push({
          position: pos,
          positionLabel: POSITION_LABEL_BRANCH[pos],
          originBranch: branch,
          originKorean,
          type: "형",
          detail: `${POSITION_LABEL_BRANCH[pos]} ${originKorean}(${branch}) × 세운 ${seunKorean}(${seunBranch}) — ${name}`,
        });
      }
    }
  }

  // 4) 삼합 완성 — 세운 가입으로 원국 2개 + 세운 = 삼합 완성
  const originBranchSet = new Set(originBranches.map((o) => o.branch));
  for (const [a, b, c, elem] of SAMHAP) {
    const trio = [a, b, c];
    if (!trio.includes(seunBranch)) continue;
    const inOrigin = trio.filter((t) => t !== seunBranch && originBranchSet.has(t));
    if (inOrigin.length >= 2) {
      // 어느 위치인지 첫 매치 기준으로 기록
      const firstMatch = originBranches.find((o) => inOrigin.includes(o.branch));
      if (firstMatch) {
        out.push({
          position: firstMatch.pos,
          positionLabel: POSITION_LABEL_BRANCH[firstMatch.pos],
          originBranch: firstMatch.branch,
          originKorean: BRANCH_INFO[firstMatch.branch]?.korean ?? firstMatch.branch,
          type: "삼합완성",
          detail: `세운 ${seunKorean}(${seunBranch}) 가입 → ${a}${b}${c} 삼합 ${elem}국(三合) 완성`,
        });
      }
    }
  }

  return out;
}

function summarize(
  pillar: string,
  pillarKorean: string,
  tenStar: string,
  twelveStage: string,
  stems: YearlyStemInteraction[],
  branches: YearlyBranchInteraction[],
): string {
  const parts: string[] = [];
  parts.push(`${pillarKorean}(${pillar}) ${tenStar}운 · 12운성 ${twelveStage}`);
  if (stems.length === 0 && branches.length === 0) {
    parts.push("원국과의 직접 충·합 없음");
  } else {
    if (stems.length > 0) {
      const s = stems.map((x) => `${x.positionLabel}${x.type}`).join(", ");
      parts.push(`천간: ${s}`);
    }
    if (branches.length > 0) {
      const b = branches.map((x) => `${x.positionLabel}${x.type}`).join(", ");
      parts.push(`지지: ${b}`);
    }
  }
  return parts.join(" / ");
}

export function calculateYearlyInteraction(
  enriched: EnrichedSajuData,
  seun: SeunEntry,
): YearlyInteractionResult {
  const stemInteractions = buildStemInteractions(enriched, seun.stem);
  const branchInteractions = buildBranchInteractions(enriched, seun.branch);
  const napum = getNapum(seun.pillar);
  const pillarKorean = pillarKoreanFor(seun.stem, seun.branch);
  const summary = summarize(
    seun.pillar,
    pillarKorean,
    seun.tenStar,
    seun.twelveStage,
    stemInteractions,
    branchInteractions,
  );
  return {
    targetYear: seun.year,
    pillar: seun.pillar,
    stem: seun.stem,
    branch: seun.branch,
    pillarKorean,
    tenStar: seun.tenStar,
    twelveStage: seun.twelveStage,
    stemInteractions,
    branchInteractions,
    napum,
    summary,
  };
}

export function buildYearlyContextBlock(interaction: YearlyInteractionResult): string {
  const lines: string[] = [];
  lines.push(`[올해 세운 컨텍스트]`);
  lines.push(
    `${interaction.targetYear}년 세운: ${interaction.pillarKorean}(${interaction.pillar})`,
  );
  lines.push(
    `세운 천간 ${interaction.stem} → 일간 기준 ${interaction.tenStar}운 / 12운성: ${interaction.twelveStage}`,
  );

  if (interaction.napum) {
    lines.push(`납음: ${interaction.napum.korean}(${interaction.napum.hanja}) / 오행 ${interaction.napum.element}`);
  }

  if (interaction.stemInteractions.length > 0) {
    lines.push(`\n세운 × 원국 천간 상호작용:`);
    for (const s of interaction.stemInteractions) {
      lines.push(`  - ${s.detail}`);
    }
  } else {
    lines.push(`\n세운 × 원국 천간: 직접 충·합 없음`);
  }

  if (interaction.branchInteractions.length > 0) {
    lines.push(`\n세운 × 원국 지지 상호작용:`);
    for (const b of interaction.branchInteractions) {
      lines.push(`  - ${b.detail}`);
    }
  } else {
    lines.push(`\n세운 × 원국 지지: 직접 충·합·형·삼합 없음`);
  }

  return lines.join("\n");
}
