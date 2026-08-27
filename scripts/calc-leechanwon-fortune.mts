/** 이찬원 대운·세운 산출. 실행: TZ=UTC NODE_OPTIONS='--conditions=import' node_modules/.bin/tsx scripts/calc-leechanwon-fortune.mts */
import * as fortuneMod from "../lib/utils/saju-fortune";
// ⚠️이 모듈은 CJS로 해석돼 named export가 안 잡힌다 → default를 먼저 본다
const calculateFortune =
  (fortuneMod as any).calculateFortune ??
  (fortuneMod as any).default?.calculateFortune ??
  (fortuneMod as any)["module.exports"]?.calculateFortune;

const L = (s = "") => process.stdout.write(s + "\n");

const res = await calculateFortune({
  birthYear: 1996,
  birthMonth: 11,
  birthDay: 1,
  gender: "male",
  yearPillar: "丙子",
  monthPillar: "戊戌",
  dayPillar: "壬寅",
  hourPillar: "",
  isTimeUnknown: true,
});

if (!res) { L("⚠️계산 실패"); process.exit(1); }

L("=== 대운 ===");
L(JSON.stringify(res.daeun, null, 2));
L("\n=== 세운 ===");
for (const s of res.seun) {
  L(`${s.year}(${s.age}세) ${s.pillar} ${s.tenStar} ${s.twelveStage}`);
}
