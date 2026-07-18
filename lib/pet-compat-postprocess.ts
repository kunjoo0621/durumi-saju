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

// ────────────────────────────────────────────────────────
// v1.0(F4): 신살 환각 결정론 차단
// 왜: 실측에서 "백호살"(펫이 실제로 보유하지 않는 신살) 환각이 QA 2회 재생성 안에서도
//     안 잡혀 출고되는 케이스 관측. 지시-only(프롬프트)·QA 재생성만으론 못 막는다(한자·종혼입 교훈).
//     → 서버가 보유 신호(signals)를 알고 있으니, 본문에 나온 '미보유 신살 이름'을 코드로 제거·치환한다.
// 정책: 허용 신살(홍염살/도화살=petHasDohwa, 역마살=petHasYeokma, 천을귀인=petHasCheonEulGwiin)만 이름 유지.
//       그 외 신살 이름(백호살·장성살·지살·공망·괴강·양인살·화개살·문창귀인 등)은 이름 없이 '기질/기운'으로 치환.
//       허용 신살이라도 해당 signal이 false면 미보유 → 치환.
// ────────────────────────────────────────────────────────

/** 신살 보유 여부 신호 (validate·postprocess가 미보유 신살 판정에 사용) */
export interface ShinsalSignals {
  petHasDohwa: boolean;          // 홍염살/도화살 허용
  petHasYeokma: boolean;         // 역마살 허용
  petHasCheonEulGwiin: boolean;  // 천을귀인 허용
}

// 신살 이름 → 이름 없이 푼 '기질/기운' 치환어 (한자 병기는 stripHanjaKeepKorean이 먼저 제거하므로 한글 이름만 매칭)
const SHINSAL_PLAIN: Record<string, string> = {
  // 항상 미보유(LLM 환각 단골) — 무조건 치환
  백호살: "낯선 걸 경계하는 기질",
  장성살: "앞장서서 이끄는 기질",
  지살: "자리를 자주 옮기고 싶어 하는 기운",
  공망: "붙잡기 어려운 결",
  괴강: "강단 있는 기질",
  양인살: "날이 선 기질",
  화개살: "혼자만의 시간을 즐기는 기질",
  문창귀인: "영리하고 눈치 빠른 기질",
  // 조건부 허용 — 해당 signal이 false면 아래 치환어로
  홍염살: "사람을 끌어당기는 매력",
  도화살: "사람을 끌어당기는 매력",
  역마살: "돌아다니고 싶어 하는 기운",
  천을귀인: "복이 따르는 기운",
};

// 이름 유지가 허용되는 신살 집합을 signals에서 계산
function allowedShinsalSet(sig: ShinsalSignals): Set<string> {
  const s = new Set<string>();
  if (sig.petHasDohwa) { s.add("홍염살"); s.add("도화살"); }
  if (sig.petHasYeokma) s.add("역마살");
  if (sig.petHasCheonEulGwiin) s.add("천을귀인");
  return s;
}

/** 본문에서 '미보유 신살 이름'을 결정론적으로 제거·치환. 허용 신살(signals)은 그대로 둔다. */
export function stripHallucinatedShinsal(text: string, sig: ShinsalSignals): string {
  if (!text) return text;
  const allowed = allowedShinsalSet(sig);
  let out = text;
  for (const [name, plain] of Object.entries(SHINSAL_PLAIN)) {
    if (allowed.has(name)) continue;      // 보유 신살은 이름 유지
    if (!out.includes(name)) continue;
    out = out.split(name).join(plain);    // 결정론적 치환 (정규식 특수문자 걱정 없음)
  }
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

// 미보유 신살 이름 검출용 정규식 후보 (validate의 방어적 백업 검사에 사용)
const ALL_SHINSAL_NAMES = Object.keys(SHINSAL_PLAIN);

// v0.3: QA 게이트 — 지시-only는 못 믿으니(한자 사고 교훈) 위반을 코드로 검출 → 재생성 1회.
const FORBIDDEN = /운명|100%|절대|영원히|무조건|반드시|정답/;
const MEDICAL = /구토|설사|발작|경련|혈뇨|탈수|토했|토함|식욕\s*부진/;
// v0.4: headline·finalLine에 명리 용어 이름 금지(캡처·공유용) — 본문은 허용
// v1.0(F4): 구조 용어(일지·일간·연지·신강·신약·원진·삼합·방합·비화·12운성)도 헤드라인/마무리 금지어에 추가.
//   오탐 회피: 충/합/형 단독은 흔한 일상어("충성"·"합격"·"형")라 제외 — 위 결합어/두 글자 이상만.
const MYEONGRI_IN_TITLE = /홍염살|도화살|역마살|화개살|백호살|양인살|공망|천을귀인|문창귀인|괴강|제왕|장생|목욕|관대|건록|비겁|식상|재성|관성|십성|삼합|방합|원진|비화|12운성|신강|신약|일지|일간|연지/;
// v0.5: 시뮬레이션은 상황극이라 명리 용어 이름 0 (본문 판정/설명서는 허용).
// 오탐 회피: "목욕"(시뮬 상황 풀)·한 글자 12운성(쇠·병·사·묘·절·태·양)·"인성"(일상어) 제외
const MYEONGRI_IN_SIM = /비겁|비견|겁재|식상|식신|상관|재성|편재|정재|편관|정관|편인|정인|관성|십성|역마살|역마|도화살|도화|홍염살|홍염|화개살|화개|백호살|양인살|장성살|괴강|공망|천을귀인|문창귀인|신살|장생|건록|제왕|관대|12운성|신강|신약|삼합|방합|육합|원진|일간|일지|연지/;
const STAGES_2 = ["장생", "목욕", "관대", "건록", "제왕"]; // 12운성 두 글자 이름
const STAGES_1 = ["쇠", "병", "사", "묘", "절", "태", "양"]; // 한 글자 (일반 단어 오매칭 주의)
// v0.9: 본문(판정·설명서·미래) 구조 용어 누수 검사. 신살 이름(홍염살·역마살·천을귀인)은 1회 허용이라 제외.
// 오탐 회피: 흔한 단어(합격·충성·형태·재정)와 겹치는 한 글자 용어는 넣지 않음.
const MYEONGRI_IN_BODY = /일지|일간|연지|12운성|삼합|방합|원진|비화|신강|신약|장성살|백호살|공망|지살|화개살|괴강|양인살|합화|진술충|묘술합/;
// v0.9: 내부 점수 숫자 노출 검사 (점수는 2자리라 "\d{2}점" + "ruler")
const SCORE_IN_BODY = /\d{2}\s*점|ruler/i;

/** 한자 strip 후 본문을 검사해 위반 목록 반환(빈 배열=통과). label.text·manual.spec·name 제외. */
export function validatePetCompatResult(
  result: PetCompatResult,
  ctx: { petTwelveStage: string } & ShinsalSignals,
): string[] {
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

  const titleText = `${result.label?.headline ?? ""} ${result.finalLine ?? ""}`;
  const term = titleText.match(MYEONGRI_IN_TITLE);
  if (term) v.push(`헤드라인/마무리에 명리 용어 "${term[0]}" (제목엔 쉬운 말만)`);

  for (const sim of result.simulations || []) {
    const simTerm = `${sim?.scene ?? ""} ${sim?.prediction ?? ""}`.match(MYEONGRI_IN_SIM);
    if (simTerm) { v.push(`시뮬레이션에 명리 용어 "${simTerm[0]}" (시뮬은 용어 없이 행동으로만)`); break; }
  }

  // v0.9: 본문 prose(판정·설명서·미래)에 구조 용어/점수 숫자 누수
  const prose = [
    m?.recommendedEnv, m?.warnings, m?.chargeMethod, m?.errorSignals, m?.ownerMode,
    result.ownerVerdict, result.petVerdict, result.futureLine,
  ].filter(Boolean).join(" \n ");
  const bodyTerm = prose.match(MYEONGRI_IN_BODY);
  if (bodyTerm) v.push(`본문 구조 용어 "${bodyTerm[0]}" (쉬운 말로 번역할 것)`);
  const scoreLeak = prose.match(SCORE_IN_BODY);
  if (scoreLeak) v.push(`본문 점수 노출 "${scoreLeak[0]}" (숫자 대신 방향으로)`);

  // v1.0(F4): 미보유 신살 이름 방어 검사. postprocess가 결정론적으로 제거하므로 여기서 걸리면 안 되지만,
  //   후처리 우회 시(직접 validate 호출 등) 백업으로 검출. 허용 신살(signals)은 제외.
  const allowed = allowedShinsalSet(ctx);
  for (const name of ALL_SHINSAL_NAMES) {
    if (allowed.has(name)) continue;
    if (body.includes(name)) { v.push(`미보유 신살 이름 "${name}" (보유하지 않은 신살 — 제거/치환 필요)`); break; }
  }

  return v;
}

/** 결과 전체에서 한자 제거 + 미보유 신살 이름 결정론 치환 (manual.spec·name 제외). 원본을 변형해 반환. */
export function postprocessPetCompatResult(result: PetCompatResult, sig: ShinsalSignals): PetCompatResult {
  // 한자 strip 후 미보유 신살 이름 치환 (순서 중요: "백호살(白虎殺)" → "백호살" → 치환)
  const s = (t: string): string => stripHallucinatedShinsal(stripHanjaKeepKorean(t), sig);

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
  if (result.ownerVerdictTitle) result.ownerVerdictTitle = s(result.ownerVerdictTitle);
  if (result.petVerdictTitle) result.petVerdictTitle = s(result.petVerdictTitle);
  if (result.futureLineTitle) result.futureLineTitle = s(result.futureLineTitle);
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
