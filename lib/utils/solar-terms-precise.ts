/**
 * 정밀 절기(節) 계산 — `lunar-javascript` 직접 호출.
 *
 * ## 왜 이 모듈이 있나
 *
 * 엔진 `@gracefullight/saju@1.2.0` 의 `dist/core/solar-terms.js` 는 태양황경을
 * **Meeus 저정밀 공식**으로 자체 계산한다. 중심차(C) 항이 3개뿐이고 행성 섭동이 없다.
 * 공칭 정확도 ±0.01° ≈ **±14분**. 2026-08-21 실측 편차(KASI 대비):
 *
 *   청명 11분 · 입하 13분 · 경칩 9분 · 망종 10분   (상반기)
 *   백로 1분 · 한로 1분 · 입동 1분                  (하반기)
 *
 * 상반기가 크고 하반기가 작은 **구조적 편차**다. 빠진 섭동 항의 위상 탓이라
 * 상수 조정으로는 못 고친다.
 *
 * 반면 `lunar-javascript`(중국 만세력 표준 구현)는 두 독립 출처와 모두 맞았다:
 *   - 발행 만세력 1990/1999 청명·입하 4건 → **전부 +0분**
 *   - 한국천문연구원(KASI) 2005년 12절 → **평균 0.5분, 최대 1분**
 *
 * ## 규약 — 여기서 틀리기 쉽다
 *
 * 1. **`lunar-javascript` 는 중국표준시(UTC+8) 기준**이다. 한국(UTC+9)으로 쓰려면 **+1시간**.
 * 2. 이 프로젝트의 millis 는 **"한국 벽시계를 UTC 인 척 인코딩한" 값**이다
 *    (`Date.UTC(한국벽시계)`). 엔진의 `prevJieMillis` 도 같은 규약이고
 *    `lib/saju-solar-terms.golden.test.ts` 의 `expectedMs` 도 그렇다.
 *    ★진짜 epoch 으로 바꾸려고 -9h 하지 말 것 — 정확히 540분 어긋난다.
 * 3. **12절(節)만** 쓴다. 중기(氣)는 월주를 바꾸지 않는다. `getJieQiTable()` 에는
 *    중기도 들어 있으므로 화이트리스트로 걸러야 한다.
 * 4. **y-1, y, y+1 세 해를 병합**한다. 한 해 테이블만 쓰면 소한·입춘 근처가 깨진다.
 *
 * ## 한계
 *
 * - 1961년 이전 한국 표준시는 UTC+8:30 이었다. 여기선 +9h 균일로 본다.
 *   현행 엔진도 같은 가정이라 회귀는 아니지만, 1950년대는 오차가 있을 수 있다.
 */
import { Solar } from "lunar-javascript";

/** 월주를 가르는 12절. 중기(冬至·大寒 등)는 제외한다. */
const JIE_CN_TO_KR: Record<string, string> = {
  立春: "입춘", 惊蛰: "경칩", 清明: "청명", 立夏: "입하",
  芒种: "망종", 小暑: "소서", 立秋: "입추", 白露: "백로",
  寒露: "한로", 立冬: "입동", 大雪: "대설", 小寒: "소한",
};

/** 중국표준시(UTC+8) → 한국시(UTC+9) 보정 */
const CST_TO_KST_MS = 60 * 60 * 1000;

export interface PreciseJie {
  name: string;
  /** 한국 벽시계를 UTC 로 인코딩한 ms (엔진 prevJieMillis 와 같은 규약) */
  ms: number;
}

const cache = new Map<number, PreciseJie[]>();

/** 한 해의 12절을 시각순으로. 실패하면 빈 배열. */
export function getJieOfYear(year: number): PreciseJie[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const out: PreciseJie[] = [];
  try {
    // 연중(6/15) 기준으로 뽑으면 그 해 전체 절기표가 나온다.
    const table = Solar.fromYmd(year, 6, 15).getLunar().getJieQiTable() as Record<string, any>;
    for (const [cn, kr] of Object.entries(JIE_CN_TO_KR)) {
      const t = table[cn];
      if (!t) continue;
      out.push({
        name: kr,
        ms: Date.UTC(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour(), t.getMinute()) + CST_TO_KST_MS,
      });
    }
    out.sort((a, b) => a.ms - b.ms);
  } catch {
    return [];
  }
  cache.set(year, out);
  return out;
}

/**
 * 출생 시각을 감싸는 직전/다음 절을 돌려준다.
 *
 * @param birthWallMs 한국 벽시계를 UTC 로 인코딩한 출생 시각
 *                    (`Date.UTC(y, m-1, d, h, mi)`)
 * @returns 실패하면 `null` — 호출부는 엔진 값으로 폴백해야 한다.
 */
export function getPreciseJieMillis(
  birthWallMs: number,
): { prevJieMillis: number; nextJieMillis: number; prevName: string; nextName: string } | null {
  if (!Number.isFinite(birthWallMs)) return null;
  const year = new Date(birthWallMs).getUTCFullYear();
  // ★세 해를 병합해야 소한(1월 초)·입춘(2월 초) 근처가 안 깨진다.
  const list = [...getJieOfYear(year - 1), ...getJieOfYear(year), ...getJieOfYear(year + 1)]
    .sort((a, b) => a.ms - b.ms);
  if (list.length < 12) return null;

  const next = list.find((t) => t.ms > birthWallMs);
  const prev = [...list].reverse().find((t) => t.ms <= birthWallMs);
  if (!next || !prev) return null;

  return {
    prevJieMillis: prev.ms,
    nextJieMillis: next.ms,
    prevName: prev.name,
    nextName: next.name,
  };
}

/** 출생 시각이 절입에서 몇 분 떨어져 있는지 — 경계 고지·감사용. */
export function minutesFromNearestJie(birthWallMs: number): number | null {
  const r = getPreciseJieMillis(birthWallMs);
  if (!r) return null;
  return Math.min(
    Math.abs(birthWallMs - r.prevJieMillis),
    Math.abs(r.nextJieMillis - birthWallMs),
  ) / 60000;
}
