// 펫 궁합 LLM 출력 결정론적 후처리 — 한자 제거 (본문 가독성)
//
// 왜: 프롬프트에 "한자 병기 최대 3개" 룰이 있지만 temp 0.85 + 신살 많은 tier1 차트에서
//     LLM이 못 지킴. 게다가 한자를 세 가지 형태로 섞어 뱉음:
//       ① 한글(漢字)  예: 홍염살(紅艶殺)
//       ② 漢字(한글)  예: 甲辰(갑진)      ← 역순
//       ③ 단독 漢字   예: 丁火, 丁卯       ← 병기 없이 raw
//     지시-only는 신뢰 불가(종 혼입 수정과 동일 교훈) → 코드에서 결정론적으로 제거한다.
//
// 정책(시니어 시청자 가독성 우선 — 본문 한자 0):
//   - 본문(사용설명서 문장·판정·시뮬·미래·헤드라인·공유문구): 한자 전부 제거.
//     ①②는 한글 이름을 남기고 (漢字)만 제거(의미 보존), ③ 단독 한자는 삭제.
//   - manual.spec의 띠 표기 "子(쥐)띠 金 기운"은 형식이라 **보존**(strip 대상에서 제외).
//   - manual.name(펫 이름)도 건드리지 않음.

// import type만 사용 → 런타임에 heavy 체인(callGemini 등) 미로드(tsx 단위 테스트 가능)
import type { PetCompatResult } from "./pet-compat";

// v0.3: 모든 펫에 반복돼 닳은 상투구. 프롬프트가 "쓰지 마"로 주입 + QA 게이트가 검출.
// (label.text는 서버 결정 문자열이라 검사 대상에서 제외 — "집안 실세와 월급 없는 운영진" 등)
export const TROPE_BLACKLIST: readonly string[] = [
  "집안 실세", "생존형 협상", "기준이 흐려지", "사랑보다 밥", "사랑보다 츄르", "사랑보다 간식",
  "만렙", "언제 그랬냐는 듯", "와이파이", "푸시 알림", "자동 결제", "필요할 때만", "5초 단위",
  "무릎 위 점령군", "영업 전략", "영업왕",
];

const H = "\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF"; // CJK 통합+확장A+호환

// 단독으로 남은 간지·오행 한자는 삭제 대신 한글 독음으로 치환(의미 손실 방지). "金처럼" → "금처럼"
const HANJA_READING: Record<string, string> = {
  金: "금", 木: "목", 水: "수", 火: "화", 土: "토",
  甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계",
  子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해",
};

/** 본문에서 한자를 제거하되 병기의 한글 이름은 남긴다. 세 형태(한글(漢字)/漢字(한글)/단독 漢字) 모두 처리. */
export function stripHanjaKeepKorean(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp(`([가-힣]+)\\(\\s*[${H}]+\\s*\\)`, "g"), "$1") // ① 한글(漢字) → 한글
    .replace(new RegExp(`[${H}]+\\(\\s*([가-힣]+)\\s*\\)`, "g"), "$1") // ② 漢字(한글) → 한글
    .replace(new RegExp(`[${H}]`, "g"), (c: string) => HANJA_READING[c] ?? "") // ③ 단독: 간지·오행은 독음, 나머지 삭제
    .replace(/\(\s*\)/g, "")       // 빈 괄호 정리
    .replace(/\s+([,.!?])/g, "$1") // 구두점 앞 공백 정리
    .replace(/\s{2,}/g, " ")
    .trim();
}

// v0.3: QA 게이트 — 지시-only는 못 믿으니(한자 사고 교훈) 위반을 코드로 검출 → 재생성 1회.
const FORBIDDEN = /운명|100%|절대|영원히|무조건|반드시|정답/;
const MEDICAL = /구토|설사|발작|경련|혈뇨|탈수|토했|토함|식욕\s*부진/;
const STAGES_2 = ["장생", "목욕", "관대", "건록", "제왕"]; // 12운성 두 글자 이름
const STAGES_1 = ["쇠", "병", "사", "묘", "절", "태", "양"]; // 한 글자 (일반 단어 오매칭 주의)

/** 한자 strip 후 본문을 검사해 위반 목록 반환(빈 배열=통과). label.text·manual.spec·name 제외. */
export function validatePetCompatResult(result: PetCompatResult, ctx: { petTwelveStage: string }): string[] {
  const v: string[] = [];
  const m = result.manual;
  const body = [
    result.label?.headline, m?.recommendedEnv, m?.warnings, m?.chargeMethod, m?.errorSignals, m?.ownerMode,
    result.ownerVerdict, result.petVerdict, result.futureLine, result.finalLine, result.disclaimer,
    ...(result.simulations || []).map((s) => `${s.scene} ${s.prediction}`),
  ].filter(Boolean).join(" \n ");

  const fw = body.match(FORBIDDEN);
  if (fw) v.push(`금지어 "${fw[0]}"`);
  for (const t of TROPE_BLACKLIST) if (body.includes(t)) v.push(`소진 표현 "${t}"`);

  // 12운성: futureLine에 petTwelveStage 아닌 다른 12운성 이름이 나오면 창작 의심
  const fl = result.futureLine || "";
  const stage = ctx.petTwelveStage;
  for (const s of STAGES_2) if (s !== stage && fl.includes(s)) v.push(`12운성 불일치 "${s}" (실제 "${stage}")`);
  for (const s of STAGES_1) {
    if (s === stage) continue;
    if (fl.includes(`12운성 ${s}`) || fl.includes(`${s}(`) || fl.includes(`${s}운`) || fl.includes(`${s}의 기운`) || fl.includes(`${s}에 들`)) {
      v.push(`12운성 불일치 "${s}" (실제 "${stage}")`);
    }
  }

  const med = (m?.errorSignals || "").match(MEDICAL);
  if (med) v.push(`errorSignals 의료 증상 "${med[0]}" (질병은 병원 안내로)`);

  return v;
}

/** 결과 전체에서 한자 제거 (manual.spec·name 제외). 원본을 변형해 반환. */
export function postprocessPetCompatResult(result: PetCompatResult): PetCompatResult {
  const s = stripHanjaKeepKorean;

  if (result.manual) {
    // spec·name은 보존, 나머지 본문만 strip
    result.manual.recommendedEnv = s(result.manual.recommendedEnv);
    result.manual.warnings = s(result.manual.warnings);
    result.manual.chargeMethod = s(result.manual.chargeMethod);
    result.manual.errorSignals = s(result.manual.errorSignals);
    result.manual.ownerMode = s(result.manual.ownerMode);
  }
  result.ownerVerdict = s(result.ownerVerdict);
  result.petVerdict = s(result.petVerdict);
  if (Array.isArray(result.simulations)) {
    for (const sim of result.simulations) {
      sim.scene = s(sim.scene);
      sim.prediction = s(sim.prediction);
    }
  }
  result.futureLine = s(result.futureLine);
  if (result.disclaimer) result.disclaimer = s(result.disclaimer);
  if (result.label) result.label.headline = s(result.label.headline);
  result.finalLine = s(result.finalLine);

  return result;
}
