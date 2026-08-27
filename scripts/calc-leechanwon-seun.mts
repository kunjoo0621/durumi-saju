/** 이찬원 과거 세운(2005~2032) 산출 — 대운은 calc-leechanwon-fortune.mts.
 *  실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-leechanwon-seun.mts
 *  ⚠️calculateFortune의 세운은 "현재연도-1 ~ +9"로 고정이라 과거 매칭엔 못 쓴다 → 라이브러리 함수를 직접 호출. */
import { calculateYearlyLuck, getTenGodForStem } from "@gracefullight/saju";

const L = (s = "") => process.stdout.write(s + "\n");

const STAGE = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
// 壬(양간) 장생 = 申
const stage = (branch: string) => STAGE[(BRANCHES.indexOf(branch) - BRANCHES.indexOf("申") + 12) % 12];

for (const y of calculateYearlyLuck(1996, 2005, 2032) as any[]) {
  L(`${y.year}(${y.age}세) ${y.pillar} ${getTenGodForStem("壬", y.stem).korean} ${stage(y.branch)}`);
}
