import {
  analyzeSolarTerms,
  calculateMajorLuck,
  calculateYearlyLuck,
  getTenGodForStem,
  type MajorLuckResult,
  type LuckPillar,
  type YearlyLuckResult,
  type Gender,
} from "@gracefullight/saju";
import { getAdapter, isInKoreaDST } from "./saju";
import { getPreciseJieMillis } from "./solar-terms-precise";

// ── 12운성 단일 지지 계산 유틸 ──

const STAGE_KOREAN = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);

// 양간 장생 시작 지지
const YANG_BIRTH: Record<string, string> = { "甲": "亥", "丙": "寅", "戊": "寅", "庚": "巳", "壬": "申" };
// 음간 장생 시작 지지
const YIN_BIRTH: Record<string, string> = { "乙": "午", "丁": "酉", "己": "酉", "辛": "子", "癸": "卯" };

function getTwelveStageKorean(dayStem: string, branch: string): string {
  const isYang = YANG_STEMS.has(dayStem);
  const birthBranch = isYang ? YANG_BIRTH[dayStem] : YIN_BIRTH[dayStem];
  if (!birthBranch) return "알수없음";
  const birthIdx = BRANCHES.indexOf(birthBranch as typeof BRANCHES[number]);
  const targetIdx = BRANCHES.indexOf(branch as typeof BRANCHES[number]);
  if (birthIdx < 0 || targetIdx < 0) return "알수없음";
  const stageIdx = isYang
    ? (targetIdx - birthIdx + 12) % 12
    : (birthIdx - targetIdx + 12) % 12;
  return STAGE_KOREAN[stageIdx];
}

// ── 타입 정의 ──

export interface DaeunEntry {
  index: number;
  startAge: number;
  endAge: number;
  pillar: string;
  stem: string;
  branch: string;
  tenStar: string;
  twelveStage: string;
}

export interface DaeunResult {
  gender: "male" | "female";
  isForward: boolean;
  startAge: number;
  startAgeDetail: { years: number; months: number; days: number };
  daysToTerm: number;
  pillars: DaeunEntry[];
}

export interface SeunEntry {
  year: number;
  age: number;
  pillar: string;
  stem: string;
  branch: string;
  tenStar: string;
  twelveStage: string;
}

export interface FortuneResult {
  daeun: DaeunResult;
  seun: SeunEntry[];
}

// ── 대운/세운 계산 ──

export async function calculateFortune(params: {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  gender: "male" | "female";
  birthLocation?: string;
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;
  isTimeUnknown?: boolean;
}): Promise<FortuneResult | null> {
  try {
    const adapter = await getAdapter();

    const birthHour = params.birthHour ?? 12;
    const birthMinute = params.birthMinute ?? 0;

    // DST 보정
    const isDST = isInKoreaDST(params.birthYear, params.birthMonth, params.birthDay);
    let birthDate = new Date(params.birthYear, params.birthMonth - 1, params.birthDay, birthHour, birthMinute);
    if (isDST) {
      birthDate = new Date(birthDate.getTime() - 60 * 60 * 1000);
    }

    const dateFnsDate = { date: birthDate, timeZone: "Asia/Seoul" };

    // 절입 계산 (엔진) — 폴백용
    const solarTermInfo = analyzeSolarTerms(dateFnsDate, { adapter });

    // ── 정밀 절기 주입 ────────────────────────────────────────────────
    // 엔진의 절기에는 두 가지 문제가 있다(2026-08-21 전수 실측, 3,197건):
    //
    //  ① 정밀도 — dist/core/solar-terms.js 가 Meeus 저정밀 공식(중심차 3항·섭동 없음)을
    //     쓴다. 공칭 ±0.01° ≈ ±14분. KASI 대비 청명 11분·입하 13분(상반기가 크다).
    //
    //  ② ★DST 좌표계 어긋남 — 더 크다. 위에서 출생 시각의 서머타임을 -1h 해
    //     **표준시(KST)** 로 되돌려 놓는데, 그 값을 `Asia/Seoul` 존으로 넘기면
    //     엔진은 IANA DST(1955~1961·1987~1988 은 GMT+10)를 적용한 좌표계로 절기를
    //     돌려준다. 출생=표준시 / 절기=DST시계 로 **1시간** 어긋난다.
    //     1987년은 절기 자체를 잘못 짚기까지 했다(망종을 5/6 으로).
    //     절기는 천문 현상이라 표준시로 표기하는 게 맞다. 서머타임은 시계를
    //     인위적으로 돌린 것이지 태양 위치가 바뀐 게 아니다.
    //
    // 실측 영향: 절기 이동 20분 초과 64건(2.0%) / 정수 대운수 변경 3건 /
    //           startAgeDetail(년·월·일) 변경 1,030건(32.2%).
    //
    // 정밀 소스는 발행 만세력(1990·1999)과 KASI(2005·2026) 양쪽에 0~1분으로 맞는다.
    // 실패하면 null 을 주므로 엔진 값으로 조용히 폴백한다 — 프로덕션 경로다.
    const preciseJie = getPreciseJieMillis(
      Date.UTC(
        birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate(),
        birthDate.getHours(), birthDate.getMinutes(),
      ),
    );

    // 대운 계산
    const majorLuck: MajorLuckResult = calculateMajorLuck(
      dateFnsDate,
      params.gender as Gender,
      params.yearPillar,
      params.monthPillar,
      {
        adapter,
        count: 10,
        nextJieMillis: preciseJie?.nextJieMillis ?? solarTermInfo.nextJieMillis,
        prevJieMillis: preciseJie?.prevJieMillis ?? solarTermInfo.prevJieMillis,
      },
    );

    // 일간 (dayPillar의 첫 글자)
    const dayStem = params.dayPillar[0];

    // 대운 각 주에 십성 + 12운성 주석
    const daeunPillars: DaeunEntry[] = majorLuck.pillars.map((p: LuckPillar) => {
      const tenGodLabel = getTenGodForStem(dayStem, p.stem);
      return {
        index: p.index,
        startAge: p.startAge,
        endAge: p.endAge,
        pillar: p.pillar,
        stem: p.stem,
        branch: p.branch,
        tenStar: tenGodLabel.korean,
        twelveStage: getTwelveStageKorean(dayStem, p.branch),
      };
    });

    const daeun: DaeunResult = {
      gender: params.gender,
      isForward: majorLuck.isForward,
      startAge: majorLuck.startAge,
      startAgeDetail: majorLuck.startAgeDetail,
      daysToTerm: majorLuck.daysToTerm,
      pillars: daeunPillars,
    };

    // 세운 계산 — 현재 연도 기준 ±5년
    const currentYear = new Date().getFullYear();
    const fromYear = currentYear - 1;
    const toYear = currentYear + 9;
    const yearlyLuck: YearlyLuckResult[] = calculateYearlyLuck(params.birthYear, fromYear, toYear);

    const seun: SeunEntry[] = yearlyLuck.map((y: YearlyLuckResult) => {
      const tenGodLabel = getTenGodForStem(dayStem, y.stem);
      return {
        year: y.year,
        age: y.age,
        pillar: y.pillar,
        stem: y.stem,
        branch: y.branch,
        tenStar: tenGodLabel.korean,
        twelveStage: getTwelveStageKorean(dayStem, y.branch),
      };
    });

    return { daeun, seun };
  } catch (error) {
    console.error("[FORTUNE] 대운/세운 계산 실패:", error);
    return null;
  }
}
