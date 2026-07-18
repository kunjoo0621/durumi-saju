// 반려동물 궁합 — 다양한 10마리 배치 실측 (개인화·중복·용어 확인)
// dev 서버의 /api/pet-compat/dev-test 로 진짜 파이프라인 실행(사주계산→신호→점수→LLM).
// 사전조건: dev 서버가 http://localhost:3005 에서 돌고 있어야 함.
// 실행: npx tsx scripts/pet-compat-10animals.mts [startIdx] [endIdx]
// 출력: /private/tmp/.../scratchpad/pet10-<TAG>.md  (PET10_TAG 로 파일명 태그)

import { writeFileSync } from "fs";

const BASE = process.env.PET10_BASE || "http://localhost:3005";
const TAG = process.env.PET10_TAG || "baseline";
const OUT = `/private/tmp/claude-501/-Users-kunjoo/d6846ace-ee32-4fd9-abc4-19e9c6878ff9/scratchpad/pet10-${TAG}.md`;

const owner = {
  name: "건주", birthYear: 1995, birthMonth: 6, birthDay: 21,
  birthHour: 14, birthMinute: 30, unknownBirthTime: false,
  birthLocation: "서울", gender: "male", calendarType: "solar",
};

// 종·품종·나이(생애단계)·기질 폭넓게 10마리
const PETS = [
  { name: "바람", species: "dog", breed: "보더콜리", gender: "male", birthTier: 1, birthDate: "2023-04-10", birthTime: "07:00", calendarType: "solar", adoptionRoute: "purchase", note: "목축견·초고에너지·젊은 성견(3살)" },
  { name: "몽실", species: "dog", breed: "시츄", gender: "female", birthTier: 1, birthDate: "2018-09-22", birthTime: "15:00", calendarType: "solar", adoptionRoute: "purchase", note: "토이·느긋·중년(8살)" },
  { name: "소시지", species: "dog", breed: "닥스훈트", gender: "male", birthTier: 1, birthDate: "2021-01-30", birthTime: "21:00", calendarType: "solar", adoptionRoute: "gift", note: "사냥/추적·고집·성견(5살)" },
  { name: "구름", species: "dog", breed: "포메라니안", gender: "female", birthTier: 1, birthDate: "2025-11-05", birthTime: "06:00", calendarType: "solar", adoptionRoute: "purchase", note: "토이·퍼피(생후 8개월)" },
  { name: "백호", species: "dog", breed: "진돗개", gender: "male", birthTier: 1, birthDate: "2015-06-18", birthTime: "12:00", calendarType: "solar", adoptionRoute: "rescue", note: "한국견·주인바라기·노령(11살)" },
  { name: "블루", species: "cat", breed: "러시안블루", gender: "female", birthTier: 1, birthDate: "2023-02-14", birthTime: "23:00", calendarType: "solar", adoptionRoute: "purchase", note: "내성적·조용·성묘(3살)" },
  { name: "표범", species: "cat", breed: "뱅갈", gender: "male", birthTier: 1, birthDate: "2025-05-20", birthTime: "03:00", calendarType: "solar", adoptionRoute: "purchase", note: "야생기·초활발·어린묘(1살)" },
  { name: "찐빵", species: "cat", breed: "스코티시폴드", gender: "female", birthTier: 1, birthDate: "2019-11-11", birthTime: "18:00", calendarType: "solar", adoptionRoute: "gift", note: "온순·집냥·성묘(7살)" },
  { name: "호두", species: "cat", breed: "코리안숏헤어", gender: "male", birthTier: 1, birthDate: "2013-08-08", birthTime: "09:00", calendarType: "solar", adoptionRoute: "rescue", note: "동네출신·독립·노묘(13살)" },
  { name: "여울", species: "dog", breed: "래브라도리트리버", gender: "male", birthTier: 1, birthDate: "2022-07-25", birthTime: "10:00", calendarType: "solar", adoptionRoute: "purchase", note: "사교·활발·성견(4살)" },
];

const sec = (t: string, b: string) => `\n**${t}**\n${b}\n`;

async function main() {
  const start = Number(process.argv[2] ?? 0);
  const end = Number(process.argv[3] ?? PETS.length);
  let md = `# 반려동물 궁합 실측 — ${TAG}\n보호자: 건주(1995-06-21 14:30 서울)\n엔드포인트: ${BASE}/api/pet-compat/dev-test\n`;

  for (let i = start; i < end; i++) {
    const pet = PETS[i];
    const label = `[${i + 1}/${PETS.length}] ${pet.name} · ${pet.species === "dog" ? "강아지" : "고양이"} · ${pet.breed} · ${pet.note}`;
    console.log(`\n${"━".repeat(64)}\n${label}\n${"━".repeat(64)}`);
    try {
      const started = Date.now();
      const resp = await fetch(`${BASE}/api/pet-compat/dev-test`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner, pet }),
      });
      const j: any = await resp.json();
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      if (!resp.ok || !j.ok) {
        console.log(`❌ 실패: ${j?.error || resp.status}`);
        md += `\n---\n## ${label}\n❌ 실패: ${j?.error || resp.status}\n`;
        writeFileSync(OUT, md); continue;
      }
      const res = j.result;
      const s = j.scores;
      console.log(`✅ ${elapsed}s · ${res.label.grade}등급 "${res.label.text}"`);

      // 이 펫이 실제로 받은 명리 신호 (개인화 근거 확인용)
      const sig = j.signals || {};
      const sigLines = [
        `신강약=${sig.petStrength ?? "?"}`,
        `일지관계=${sig.dayMasterRelation ?? "?"}`,
        [sig.dayBranchSamhap && "삼합", sig.dayBranchHap && "6합", sig.dayBranchBanghap && "방합", sig.dayBranchChung && "충", sig.dayBranchHyeong && "형", sig.dayBranchWonjin && "원진"].filter(Boolean).join(",") || "합충없음",
        [sig.petHasDohwa && "도화", sig.petHasYeokma && "역마", sig.petHasCheonEulGwiin && "천을귀인"].filter(Boolean).join(",") || "신살-",
        `12운성=${sig.petTwelveStage ?? "?"}`,
        `십성(관${sig.petGwanseong ?? 0}/인${sig.petInseong ?? 0}/식${sig.petSikSang ?? 0}/비${sig.petBigeob ?? 0}/재${sig.petJaeseong ?? 0})`,
      ].join(" · ");

      md += `\n---\n## ${label}\n`;
      md += `- 사주요약: ${j.petSummary?.dayPillar ?? "-"} 일주 / ${j.petSummary?.dayMaster ?? "-"} / ${j.petSummary?.strength ?? "-"}\n`;
      md += `- 신호(개인화 근거): ${sigLines}\n`;
      md += `- 점수: ${s.grade}등급 · 종합 ${s.composite} · 호흡 ${s.sync} · 실세 ${s.ruler} · 집사사랑 ${s.lover} · 펫충성 ${s.loyalty} · 어긋남 ${s.conflict}\n`;
      md += `- 사양(spec): ${res.manual.spec}\n`;
      md += sec("라벨/헤드라인", `- text: ${res.label.text}\n- headline: ${res.label.headline}`);
      md += sec("사용설명서", `- 환경: ${res.manual.recommendedEnv}\n- 주의: ${res.manual.warnings}\n- 충전: ${res.manual.chargeMethod}\n- 오류: ${res.manual.errorSignals}\n- 보호자모드: ${res.manual.ownerMode}`);
      md += sec(`보호자 판정 (${res.ownerVerdictTitle ?? "-"})`, res.ownerVerdict);
      md += sec(`펫 판정 (${res.petVerdictTitle ?? "-"})`, res.petVerdict);
      md += sec("시뮬레이션", res.simulations.map((x: any) => `- 📍 ${x.scene}\n  ${x.prediction}`).join("\n"));
      md += sec(`미래 (${res.futureLineTitle ?? "-"})`, res.futureLine);
      md += sec("종합 한 줄", `"${res.finalLine}"`);
      if (res.disclaimer) md += sec("면책", res.disclaimer);
      writeFileSync(OUT, md);
    } catch (e: any) {
      console.log(`❌ 예외: ${e?.message || e}`);
      md += `\n---\n## ${label}\n❌ 예외: ${e?.message || e}\n`;
      writeFileSync(OUT, md);
    }
  }
  writeFileSync(OUT, md);
  console.log(`\n📄 저장: ${OUT}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
