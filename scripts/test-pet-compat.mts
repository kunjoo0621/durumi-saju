// 펫 궁합 프롬프트 v0.2 테스트
// 점수는 결정론적 코드(pet-compat-scoring), LLM은 라벨/텍스트만
// 실행: npx tsx scripts/test-pet-compat.mts [case]
//   case: "dog-good" (기본) | "cat-rebel" | "dog-fallback"

import { readFileSync } from "fs";

const petCompatModule = await import("../lib/pet-compat");
const petCompat: typeof import("../lib/pet-compat") =
  ((petCompatModule as any).default ?? petCompatModule) as any;
const { runPetCompatAnalysis } = petCompat;
type PetCompatInput = import("../lib/pet-compat").PetCompatInput;

const scoringModule = await import("../lib/pet-compat-scoring");
const scoring: typeof import("../lib/pet-compat-scoring") =
  ((scoringModule as any).default ?? scoringModule) as any;
const { computePetCompatScores, mockSignalsForTest } = scoring;

// .env.local 로드
const envText = readFileSync(".env.local", "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const ownerSajuSample = `
[보호자 사주]
연주: 갑술(甲戌)
월주: 정사(丁巳)
일주: 갑인(甲寅)
시주: 병자(丙子)
일간: 갑(甲) 木 일주
오행 분포: 木(2) 火(2) 土(1) 金(0) 水(1)
신강신약: 신약 (일간 약, 인성 부족)
용신: 수(水) 인성 보강 / 기신: 금(金)
십성: 정인(正印) 1, 식신(食神) 2, 편관(偏官) 1, 비견(比肩) 2
합충형: 인사신(寅巳申) 삼형 (편관 강함)
신살: 도화살(卯), 역마살(寅)
12운성: 일간 갑목 일지 인목 = 건록(建祿)
대운: 28~37세 임신(壬申) 편인+편관 운
세운: 올해 식신 운
`.trim();

const ownerInputBase = {
  name: "신건주",
  birthYear: 1995,
  birthMonth: 6,
  birthDay: 21,
  birthHour: 14,
  birthMinute: 30,
  unknownBirthTime: false,
  birthLocation: "서울",
  gender: "male" as const,
  calendarType: "solar" as const,
  sajuText: ownerSajuSample,
};

const CASE_DOG_GOOD: Omit<PetCompatInput, "precomputedScores"> = {
  owner: ownerInputBase,
  ownerSajuText: ownerSajuSample,
  pet: {
    name: "콩이",
    species: "dog",
    breed: "골든리트리버",
    gender: "male",
    birthTier: 1,
    birthDate: "2021-03-15",
    birthTime: "08:00",
    calendarType: "solar",
    adoptionRoute: "purchase",
  },
  petSajuText: `
[펫 사주 — 강아지 콩이]
연주: 신축(辛丑)
월주: 신묘(辛卯)
일주: 정해(丁亥)
시주: 갑진(甲辰)
일간: 정(丁) 火 일주
오행 분포: 木(2) 火(1) 土(2) 金(2) 水(1)
신강신약: 신강
용신: 토(土) 식상 / 기신: 수(水)
십성: 정관(正官) 1, 정인(正印) 1, 식신(食神) 1
합충형: 묘진(卯辰) 합 (안정), 충 없음
신살: 천을귀인(亥), 천덕(寅)
12운성: 일간 정화 일지 해수 = 태(胎)
종 본성: 戌(土) — 중화의 성격, 어디든 잘 어울림
견종 본성: 골든리트리버 — 사교성 만점, 사람 좋아함
보호자와의 관계: 펫 일지 해수 ↔ 보호자 일지 인목 = 寅亥 합
`.trim(),
};

const CASE_CAT_REBEL: Omit<PetCompatInput, "precomputedScores"> = {
  owner: ownerInputBase,
  ownerSajuText: ownerSajuSample,
  pet: {
    name: "미오",
    species: "cat",
    breed: "코숏",
    gender: "female",
    birthTier: 1,
    birthDate: "2022-08-10",
    birthTime: "23:00",
    calendarType: "solar",
    adoptionRoute: "rescue",
  },
  petSajuText: `
[펫 사주 — 고양이 미오]
연주: 임인(壬寅)
월주: 무신(戊申)
일주: 경자(庚子)
시주: 정해(丁亥)
일간: 경(庚) 金 일주
오행 분포: 木(1) 火(1) 土(1) 金(2) 水(3)
신강신약: 신강 (일지 자수, 강한 인성+식상)
용신: 화(火) 관살 / 기신: 수(水) 과다
십성: 식신(食神) 2, 편관(偏官) 1, 정재(正財) 1
합충형: 인신(寅申) 충, 자해(子亥) 합
신살: 도화살(子), 홍염살(申)
12운성: 일간 경금 일지 자수 = 사(死)
종 본성: 寅(木) — 상향 의지, 천진난만, 정 끌어들임
묘종 본성: 코숏 — 영역 의식 강함, 독립적, 츤데레
보호자와의 관계: 펫 도화 + 홍염 = 귀여움으로 권력 행사
`.trim(),
};

const CASE_DOG_FALLBACK: Omit<PetCompatInput, "precomputedScores"> = {
  owner: ownerInputBase,
  ownerSajuText: ownerSajuSample,
  pet: {
    name: "감자",
    species: "dog",
    breed: "시고르자브종",
    gender: "unknown",
    birthTier: 4,
    adoptionDate: "2024-11-20",
    adoptionRoute: "rescue",
  },
  petSajuText: `
[펫 사주 — 강아지 감자 (참고용 — 가족 된 날 기반)]
※ 정확한 생일 미상. 입양일 기준 사주 (참고용).
연주: 갑진(甲辰)
월주: 을해(乙亥)
일주: 갑술(甲戌)
(시 미상)
일간: 갑(甲) 木 (보호자와 같은 일간)
오행 분포 (추정): 木(2) 土(2) 水(1) 火(0) 金(0)
종 본성: 戌(土)
견종 본성: 시고르자브종(믹스) — 중성적, 적응력 좋음
※ 신뢰도 낮음. 큰 흐름만 해석 가능.
`.trim(),
};

const CASES: Record<string, { base: Omit<PetCompatInput, "precomputedScores">; preset: "good" | "rebel" | "fallback" }> = {
  "dog-good": { base: CASE_DOG_GOOD, preset: "good" },
  "cat-rebel": { base: CASE_CAT_REBEL, preset: "rebel" },
  "dog-fallback": { base: CASE_DOG_FALLBACK, preset: "fallback" },
};

async function main() {
  const caseKey = (process.argv[2] || "dog-good") as keyof typeof CASES;
  const config = CASES[caseKey];
  if (!config) {
    console.error(`알 수 없는 케이스: ${caseKey}. 가능: ${Object.keys(CASES).join(", ")}`);
    process.exit(1);
  }

  // 결정론적 점수 계산 (서버에서)
  const signals = mockSignalsForTest(config.preset);
  const scores = computePetCompatScores(signals);

  console.log(`\n${"━".repeat(70)}`);
  console.log(`  🐾 펫 궁합 v0.2 테스트 — 케이스: ${caseKey}`);
  console.log(`  보호자: ${config.base.owner.name} / 펫: ${config.base.pet.name} (${config.base.pet.species})`);
  console.log(`${"━".repeat(70)}`);
  console.log(`\n[서버 결정 점수 (LLM 호출 전)]`);
  console.log(`  composite: ${scores.composite} → ${scores.grade}등급`);
  console.log(`  🐾 호흡: ${scores.sync} / 👑 실세: ${scores.ruler} / 🐶 집사: ${scores.lover} / ⚡ 어긋남: ${scores.conflict}`);
  console.log(`  scoring v${scores.scoringVersion}\n`);

  const input: PetCompatInput = {
    ...config.base,
    precomputedScores: scores,
    signals,
  };

  const startedAt = Date.now();
  const r = await runPetCompatAnalysis(input);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (!r.ok) {
    console.error(`❌ 실패 (${elapsed}s):`);
    console.error(r.error);
    process.exit(1);
  }

  console.log(`✅ 성공 (${elapsed}s)\n`);

  const { result } = r;

  console.log(`━━ 라벨 ━━`);
  console.log(`  ${result.label.grade}등급: ${result.label.text}`);
  console.log(`  ${result.label.headline}`);

  console.log(`\n━━ 점수 (서버값 강제) ━━`);
  console.log(`  composite: ${result.scores.composite}`);
  console.log(`  🐾 호흡: ${result.scores.sync} / 👑 실세: ${result.scores.ruler} / 🐶 집사: ${result.scores.lover} / ⚡ 어긋남: ${result.scores.conflict}`);

  console.log(`\n━━ 사용설명서 ━━`);
  console.log(`  [제품명] ${result.manual.name}`);
  console.log(`  [사양]   ${result.manual.spec}`);
  console.log(`  [환경]   ${result.manual.recommendedEnv}`);
  console.log(`  [주의]   ${result.manual.warnings}`);
  console.log(`  [충전]   ${result.manual.chargeMethod}`);
  console.log(`  [오류]   ${result.manual.errorSignals}`);
  console.log(`  [모드]   ${result.manual.ownerMode}`);

  console.log(`\n━━ 보호자 판정 ━━`);
  console.log(`  ${result.ownerVerdict}`);

  console.log(`\n━━ 펫 판정 ━━`);
  console.log(`  ${result.petVerdict}`);

  console.log(`\n━━ 시뮬레이션 ━━`);
  for (const sim of result.simulations) {
    console.log(`  📍 ${sim.scene}`);
    console.log(`  ${sim.prediction}\n`);
  }

  console.log(`━━ 종합 한 줄 (공유용) ━━`);
  console.log(`  "${result.finalLine}"`);

  if (result.disclaimer) {
    console.log(`\n━━ 면책 ━━`);
    console.log(`  ${result.disclaimer}`);
  }

  console.log(`\n${"━".repeat(70)}\n`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
