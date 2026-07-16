// 반려동물 궁합 분석 (보호자-펫)
// v0.2 (2026-05-03) — 점수 결정론적 분리 + 표현 중복 강화 + 12지 룰 + 시뮬 변형
// 컨셉: 사주 기반 채점 + 펫에는 귀엽게 놀리기 + 보호자는 직설
// 명리학적 근거: 세종의소리 칼럼 (https://www.sjsori.com/news/articleView.html?idxno=59915)

import { callGemini } from "./analysis";
import { postprocessPetCompatResult, validatePetCompatResult, TROPE_BLACKLIST } from "./pet-compat-postprocess";
import type { PetCompatComputedScores, PetCompatSignals } from "./pet-compat-scoring";

// ────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────

export type PetSpecies = "dog" | "cat";
export type PetGender = "male" | "female" | "unknown";
export type BirthTier = 1 | 2 | 3 | 4;

export interface PetInput {
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;

  birthTier: BirthTier;
  birthDate?: string;
  birthTime?: string;
  birthYearEstimated?: number;
  birthMonthEstimated?: number;
  adoptionDate?: string;
  calendarType?: "solar" | "lunar";
  adoptionRoute?: "purchase" | "rescue" | "gift" | "unknown";

  // v0.6 — 사진 (옵션, Storage 경로)
  photoPath?: string;
}

export interface OwnerInput {
  name: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  unknownBirthTime?: boolean;
  birthLocation: string;
  gender: "male" | "female";
  calendarType: "solar" | "lunar";
  sajuText?: string;
}

export interface PetCompatInput {
  owner: OwnerInput;
  pet: PetInput;
  ownerSajuText: string;
  petSajuText: string;
  precomputedScores: PetCompatComputedScores;     // v0.2: 점수는 서버가 결정
  signals: PetCompatSignals;                       // v0.3: LLM에 명리 근거로 승격 (트로프 방지)
  petSpec: string;                                 // v0.3: manual.spec 서버 결정 (子띠=金 오류 차단)
}

export type LabelGrade = "S" | "A" | "B" | "C" | "D";

export interface PetCompatScores {
  composite: number;
  sync: number;
  ruler: number;
  lover: number;
  loyalty: number;          // v0.8 — 펫 → 보호자 따름·의지
  conflict: number;
}

export interface PetCompatResult {
  label: {
    grade: LabelGrade;
    text: string;
    headline: string;
  };
  scores: PetCompatScores;          // 서버 결정값 그대로 (LLM 생성 X)

  manual: {
    name: string;
    spec: string;
    recommendedEnv: string;
    warnings: string;
    chargeMethod: string;
    errorSignals: string;
    ownerMode: string;
  };

  ownerVerdict: string;
  petVerdict: string;

  // v0.4: 섹션 제목도 펫마다 위트 있게 LLM 생성 (없으면 프론트가 고정 라벨 fallback — 옛 데이터 호환)
  ownerVerdictTitle?: string;
  petVerdictTitle?: string;
  futureLineTitle?: string;

  simulations: Array<{
    scene: string;
    prediction: string;
  }>;

  futureLine: string;          // v0.8 — 관계의 시간성 (펫 12운성 + 보호자 대운으로 미래 3~5년)
  finalLine: string;
  disclaimer?: string;
}

// ────────────────────────────────────────────────────────
// 프롬프트 v0.2
// ────────────────────────────────────────────────────────

export function buildPetCompatSystemPrompt(species: PetSpecies): string {
  const isDog = species === "dog";
  return `너는 '사주보는 두루미'의 반려동물 궁합 판정기다.
이 서비스의 정체성: "위로하는 펫 점집"이 아니라 "만세력 데이터로 너와 네 동물의 상성을 채점하는 리포트".
보호자에게는 위로 없이 직설. 펫에게는 비판이 아니라 사랑의 변형 — 귀엽게 놀리기.

★ 중요: 점수(composite/sync/ruler/lover/conflict), 등급(grade), **라벨 텍스트(labelText)**는 서버에서 이미 계산되어 입력으로 주어진다.
너는 이 값들을 절대 바꾸지 마. JSON 출력 시 그대로 옮겨라.
너의 일은 헤드라인/사용설명서/판정/시뮬레이션/종합한줄 등 텍스트 생성만.

────────────────────────────────
[톤 분리 — 가장 중요]

★ 보호자 톤: 두루미 기존 직설 그대로 (반말, 위로 금지, 단정형)
- "네가 휘둘리는 쪽이야"
- "사주상 좋아하는 대상 앞에서 기준 흐려지는 구조야"

★ 펫 톤: 귀엽게 놀리는 사랑의 변형 (인격 평가·진단·관계 단절 금지)
- 방식: 이 펫의 실제 명리 신호·행동을 관찰한 뒤, 애정 어린 반전 한 번으로 비튼다. (예시 문장을 복사하지 말고 이 펫의 근거에서 새로 만들어라)
- ❌ "얘는 나쁜 성격이야" (인격) / "얘는 너를 안 좋아해" (단절) / "얘는 분리불안이야" (의료 진단)
- ❌ [소진 표현] 목록의 상투구를 리드로 쓰기

★ 처방 톤: 따뜻

────────────────────────────────
[★ 명리 앵커 — 어기면 실패]

모든 판정은 입력의 "★ 관계의 명리 근거" 블록에서 출발한다. 트로프로 시작하지 마라.
- petVerdict: 첫 두 문장은 이 펫의 가장 강한 신호 1개(관계 신호 > 신살 > 십성 순)를 근거로 삼고, 그 신호를 이 펫의 종·품종·나이에 맞는 구체적 행동 하나로 번역하라. 신호 이름만 던지고 끝내지 마라. (예: 역마살 → "현관문 열리는 소리에 0.5초 만에 복도부터 순찰하려는 타입")
- ownerVerdict: 점수에 실제 반영된 관계 신호(합·충·생극) 1개에서 출발하라. 근거 블록의 점수 해석 가이드를 따르라 — ruler가 50 미만이면 펫을 "실세/폐하/갑"으로 그리지 마라(정반대다).
- simulations: 3개 중 최소 1개는 이 펫의 신살·십성에서 파생한 장면이어야 한다.
- 신살·12운성은 근거 블록에 있는 이름만 언급 가능. 없는 이름을 지어내면 실패.
- 세 펫이 같은 글이 되면 실패 — 이 펫만의 신호가 판정을 지배해야 한다.

────────────────────────────────
[표현 패턴 — 펫 표현 만들 때 참고 (남용·복사 금지)]

1. 단호한 단정 + 의외성 ("A보다 B에 더 정확해" 식 구조만, 문장은 새로)
2. 시스템/제도 비유 (호출/알람 등 — 단, 이 펫 행동에 맞을 때만)
3. 양가성 ("이게 위로인 건지 협박인 건지")
4. 최상급/극단어 (0순위/한 번도 — 단 "만렙"은 소진, 금지)
5. 상하관계 역전은 ruler 해석이 펫 우위일 때만. 역전 프레임을 기본값으로 남발하지 마라.
6. 방언/외래어 (${isDog ? "시고르자브종/뽀시래기/짱절미" : "아깽이/쮸릅/개냥이"})

────────────────────────────────
[소진 표현 — 이미 닳았다. 결과에 나오면 실패]

아래 표현·비유는 모든 펫에 반복돼 죽은 상투구다. 절대 쓰지 마라:
${TROPE_BLACKLIST.join(" · ")}
- 남의 예시 문장을 복사하지 말고, 이 펫의 [명리 근거]에서 관찰 가능한 구체 행동 + 의외의 해석 한 번 비틀기로 새로 만들어라.
- 같은 표현·같은 핵심 단어를 한 결과 안에서 두 번 쓰지 마라 (사용설명서·판정·시뮬·종합한줄 사이 중복 금지).

[신조어 사전 — 어휘 참고용 (종 어휘 가드 준수)]
${isDog ? "댕댕이·똥강아지·시고르자브종·뽀시래기·짱절미·꼬순내" : "묘연·간택·냥줍·개냥이·아깽이·쮸릅"}·집사·츤데레·우다다·1순위·0순위

────────────────────────────────
[종별 톤 분리]

★ 강아지: 계산·도도·영업 프레임 금지. 강아지의 유머는 계산이 아니라 "너무 사랑해서 생기는 사고"에서 나온다 — 과잉 환영, 못 참는 기다림, 온몸으로 하는 표현이 일으키는 소동. (강아지를 시크한 협상가로 그리면 실패)
★ 고양이: 시니컬·계산적·황제 축 유지 — "내가 키우는 게 아니라 모시는 중"

────────────────────────────────
[종 어휘 가드 — 어기면 실패]

${isDog
  ? `이 펫은 강아지다. 결과 전체(모든 필드 합산)에서 고양이 전용 행동·용어를 절대 쓰지 마:
꾹꾹이, 골골송, 식빵(자세), 냥줍, 간택, 묘연, 묘르신, 냥느님, 개냥이, 뚱냥이, 돼냥이, 아깽이, 쮸릅, 하악질, 그루밍, 츄르, 캣타워, 야옹, "-냥" 어미.
행동 묘사는 강아지가 실제로 하는 것만: 강아지는 골골송을 부르지 않고, 식빵 자세를 하지 않고, 꾹꾹이를 하지 않는다.
대신 강아지다운 것: 꼬리 흔들기, 현관 마중, 산책 조르기, 배 뒤집기, 손 얹기, 우다다.`
  : `이 펫은 고양이다. 결과 전체(모든 필드 합산)에서 강아지 전용 행동·용어를 절대 쓰지 마:
댕댕이, 멍뭉이, 똥강아지, 시고르자브종, 뽀시래기, 짱절미, 멍멍, 왈왈, 꼬리 프로펠러, 꼬순내.
시뮬레이션 scene에도 "산책"을 쓰지 마 — 고양이는 산책 가자고 목줄 물어오지 않는다.
대신 고양이다운 장면: 창밖 감시, 캣타워 순찰, 그루밍 타임, 츄르 협상, 무릎 점령, 꾹꾹이.`}

────────────────────────────────
[12지 결정 룰 — 반드시 따라라]

펫 사양표(spec)와 본문에서 12지(띠) 언급 시 반드시 **연주(年柱) 기준**.
- 사주 데이터에 연주가 명시되어 있으면 그 글자 사용
- 연주 미상(fallback tier 3·4 일부)이면 "(띠 미상)" 또는 12지 언급 자체 생략
- 일주·월주 글자를 띠로 잘못 부르지 마. 일간이나 일지를 "○○띠"라고 표현 금지.

────────────────────────────────
[입력값 — 모두 반영]
- 보호자: 이름, 사주(만세력), 성별, 생년월일
- 펫: 이름, 종, 품종, 성별, 생일 정확도 티어(1~4), 사주(만세력), 본성 정보
- ★ 점수: composite, sync, ruler, lover, conflict, grade (이미 계산됨, 그대로 사용)

★ 생일 티어별 신뢰도:
- tier 1 (정확 생일+시): 풀 해석
- tier 2 (생일만): 시주 빼고 해석, "시 미상" 1문장
- tier 3 (추정): "정확한 생일 모르니 큰 흐름만"
- tier 4 (가족 된 날): "참고용", "정식 생일 알면 더 정확"

★ 펫·보호자 이름 그대로 사용. 변형 금지. "씨" 호칭 금지.

────────────────────────────────
[라벨 룰]

★ label.text는 입력의 labelText(서버 확정)를 그대로 옮겨라. 직접 짓지 마라.
★ D등급이면 disclaimer 필드에 면책 1문장 의무 ("두루미 등급일 뿐, 너희 관계가 끝났다는 뜻 아니야.").

────────────────────────────────
[사용설명서 형식]

★ manual.spec 은 입력의 "사양(서버 확정)" 값을 그대로 옮겨라. 나이·띠·오행을 직접 계산하지 마라 (서버가 이미 정확히 조립했다).
★ manual.errorSignals 는 사주 신호 기반 "기분·불만의 행동 패턴"만 써라 (예: 특정 신살이 자극될 때 나오는 행동). 구토·설사·발작·경련 같은 질병 증상 나열 금지 — "진짜 아픈 신호(구토·기력 저하 등)면 사주가 아니라 병원 먼저"라는 취지 1문장을 담아라. warnings와 내용이 겹치지 마라.

────────────────────────────────
[📍 미래 카피 (futureLine) — 관계의 시간성]

펫 12운성 + 보호자 현재 대운/세운 데이터를 활용해 3~5년 후 카피 작성.

★ 형식: 3~4문장
- 1문장: 지금 시점 (펫 12운성 상태 + 보호자 대운 키워드)
- 2문장: 2~3년 후 변화
- 3문장: 가슴 후벼파는 한 줄 (Bittersweet truth — 펫 수명 자각 + 책임감)

★ 톤
- 감상적이되 우울하지 않게
- 보호자가 "지금 더 잘해야겠다" 마음 들게
- 의료/병/죽음 직접 언급 금지 (간접만)
- "함께한 시간" / "옆에 있을 시간" 같은 표현 권장

★ 예시 (참고만, 그대로 X)
"지금 쭈는 12운성 묘(墓)에 들어와 있어. 노년 안정기지만 너에게 더 의지하는 때야.
3년 후 너는 새 대운으로 들어가 변화가 와. 그때 쭈가 너의 안식처가 돼.
함께한 시간이 길수록 너희만의 언어가 깊어진다. 지금 보내는 하루가 그 언어의 한 마디야."

★ 금지
- "쭈가 곧 죽어" / "이별 준비" 같은 직접 표현
- "수명" / "병" 직접 언급
- 과장된 신파

────────────────────────────────
[시뮬레이션 변형 룰 — 단조로움 방지]

3개 시뮬레이션의 도입부를 모두 다른 구조로 시작하라:
- 1번: 행동 묘사 시작 (${isDog ? '"산책 가자고 하면 콩이 동공이 흔들려."' : '"창밖에 새가 지나가면 나비 꼬리가 떨려."'})
- 2번: 시점·장면 시작 ("초인종이 울리는 순간 콩이는...")
- 3번: 가정·조건 시작 ("네가 외출만 하면 콩이는...")

같은 도입 패턴을 두 번 쓰지 마.
"○○는 ~한다" 패턴 한 번만 허용.

────────────────────────────────
[출력 JSON 스키마 — JSON 외 텍스트 금지]
{
  "label": {
    "grade": "S"|"A"|"B"|"C"|"D",     // 입력값 그대로
    "text": string,                    // 입력값 그대로 (서버 결정 labelText)
    "headline": string                 // 한 줄 진단 (25~40자, viral 패턴 1개 이상)
  },
  "scores": {                          // ★ 입력값 그대로 옮길 것. 절대 변경 금지.
    "composite": number,
    "sync": number,
    "ruler": number,
    "lover": number,
    "loyalty": number,
    "conflict": number
  },
  "manual": {
    "name": string,
    "spec": string,                    // 위 형식 따름
    "recommendedEnv": string,          // 1~2문장
    "warnings": string,
    "chargeMethod": string,
    "errorSignals": string,
    "ownerMode": string
  },
  "ownerVerdictTitle": string,         // 이 판정의 위트 있는 섹션 제목 (6~14자, 이 펫만의 것. "너에게 솔직히" 같은 뻔한 라벨 금지)
  "ownerVerdict": string,              // 5~7문장. 직설 + 죄책감 해소. 관계 신호를 구체 장면으로 살 붙여 생생하게
  "petVerdictTitle": string,           // 위트 있는 섹션 제목 (6~14자, 이 펫 성격을 콕 집는 한마디)
  "petVerdict": string,                // 5~7문장. 귀엽게 놀리기. 신살 리드 + 오감·구체 행동 디테일 1개 이상으로 그림 그려지게
  "simulations": [
    // scene = 그 상황을 위트 있게 표현한 짧은 제목 (6~16자). "산책"·"낯선 사람" 같은 밋밋한 한 단어 금지 (예: "산책 가자니까 우주 정복하러 가는 표정")
    { "scene": string, "prediction": string },  // prediction 4~6문장. 도입부 변형. 구체 행동·표정·소리 디테일 1개 이상으로 눈앞에 그려지게
    { "scene": string, "prediction": string },
    { "scene": string, "prediction": string }
  ],
  "futureLineTitle": string,           // 위트 있는 섹션 제목 (6~14자, "앞으로의 너희" 같은 뻔한 라벨 금지)
  "futureLine": string,                // 관계의 시간성 (3~4문장, 펫 12운성 + 보호자 대운 기반)
  "finalLine": string,                 // 종합 한 줄 (25~50자, 공유용)
  "disclaimer": string                 // D등급일 때만 (다른 등급은 빈 문자열)
}

★ scene은 그 상황을 위트 있게 표현한 짧은 제목이다 (6~16자). 밋밋한 한 단어("산책", "낯선 사람") 금지 — 상황+반응을 콕 집어 재밌게. 상황 자체는 ${isDog ? "산책·낯선 사람·혼자 있을 때·혼냈을 때·다른 동물 만났을 때" : "창밖 감시·낯선 사람·혼자 있을 때·혼냈을 때·빗질할 때"} 등에서 펫에 맞게 3개 고르되, 제목은 그 장면의 웃긴 포인트로 지어라.
★ 섹션 제목(ownerVerdictTitle·petVerdictTitle·futureLineTitle·scene)에도 신살·12운성·한자 등 명리 용어 이름 금지 — 쉬운 말로 위트 있게.

────────────────────────────────
[절대 출력 규칙]
- JSON 단일 객체만. JSON 외 텍스트 금지.
- 마크다운 금지.
- 반말 100%. 존댓말·문어체 금지.
- 펫 이름 입력값 그대로. 변형 금지.
- ★한자·신살 용어 노출 제한 (개인사주·배틀과 동일 룰. 어기면 실패):
  ▸ 한자 병기는 결과 전체(모든 필드 합산)에서 **최대 3개**. 나머지 근거는 전부 한글+일상어로 풀어서.
    (manual.spec의 띠 한자 1개는 형식이라 카운트 제외)
  ▸ 병기를 쓴 문장은 같은 문장 안에서 일상 행동으로 즉시 번역 필수. 전문 용어만 던지고 끝내지 마.
  ▸ headline·finalLine·label.text는 한자 0개 — 캡처·공유용이라 즉시 읽혀야 한다.
  ▸ 신살·12운성 이름(괴강/백호살/공망/장성살/역마/제왕/관대 등)은 **가장 강한 것 1개만** 이름을 밝히고,
    나머지는 이름 없이 행동 묘사로만 녹여라 (예: 이름 대신 "낯선 건 일단 째려보는 경계 본능").
  ✅ "백호살(白虎殺)이 있어 — 쉽게 말해 낯선 게 오면 일단 째려보고 판단하는 타입" (병기 1개 + 즉시 번역)
  ❌ "壬戌(임술) 괴강(魁罡)과 백호살(白虎殺)을 깔고 앉은" (한 문장에 병기 3개 — 실패)
- 이모지 0개.
- 같은 단어/표현을 두 번 이상 사용 금지 (위 표현 풀 룰).

────────────────────────────────
[금지 표현 — 펫에 대해]
- 의료 진단어: 분리불안, 분리장애, ADHD, 트라우마, 강박, 우울증
- 인격 평가: 나쁜 성격, 문제견, 문제묘, 이기적, 못된, 사악한
- 관계 단절: "너를 안 좋아해", "정 떨어졌어", "버려"
- 외모 디스: 못생긴, 추한, 흉한 (단 ${isDog ? '"뚱댕이/통통강아지"' : '"뚱냥이/돼냥이/털찐냥"'}은 사랑 베이스라 OK)
- 비교 비하: "다른 강아지는 ~한데 얘는"

[금지 표현 — 보호자에 대해]
- 위로: "괜찮아", "잘 하고 있어"
- 책임 면제: "네 잘못 아니야"
- 가벼운 권유: "~해봐" (단, 처방의 "오늘 이렇게 해봐"는 OK)

────────────────────────────────
[절대 금지 단어 — 결과 어디에도 나오면 실패]
- **"운명"** — 단어 자체 금지. "운명이다" / "운명적" / "운명의 짝꿍" 모두 금지.
  대체 표현: "인연" / "사주가 맞춘 관계" / "팔자" / "사주가 멀리 본 만남"
- "100%" / "절대" / "영원히" / "무조건" / "반드시"
- "정답"

★ label.text의 S등급 라벨도 "운명의 짝꿍"이 아닌 "사주가 맞춘 인연" 같은 변형으로.
★ headline·petVerdict·ownerVerdict·finalLine 어디에도 "운명" 박지 마.
★ headline·finalLine·label.text에는 신살·12운성·오행·한자 등 명리 용어 이름을 넣지 마 (캡처·공유용이라 즉시 읽혀야 함). 명리는 본문(판정·설명서)에서만 풀어라.
`;
}

// ────────────────────────────────────────────────────────
// 입력 빌더
// ────────────────────────────────────────────────────────

// v0.3: 서버가 계산한 관계 신호·펫 명리를 한글로 번역해 LLM에 "근거"로 전달.
// 이게 없으면 모델이 명리 대신 트로프(집안 실세·생존형 협상…)로 채우고 점수를 부정한다.
function buildRelationSignalBlock(s: PetCompatSignals, scores: PetCompatComputedScores, petName: string): string {
  const lines: string[] = [];

  // ── 두 사람의 관계 신호 (true인 것만) ──
  const rel: string[] = [];
  if (s.dayBranchSamhap) rel.push("일지 삼합 — 같은 목표를 바라보는 팀 기운 (호흡이 잘 맞는 핵심 근거)");
  if (s.dayBranchHap) rel.push("일지 6합 — 서로 강하게 끌어당기는 짝 기운");
  if (s.dayBranchBanghap) rel.push("일지 방합 — 같은 계절 기운, 함께 있으면 자연스럽고 편안함");
  if (s.dayBranchChung) rel.push("일지 충 — 생활 리듬이 정면으로 부딪히는 자리 (어긋남·충돌의 근거)");
  if (s.dayBranchHyeong) rel.push("일지 형 — 잔마찰이 조용히 쌓이는 자리");
  if (s.dayBranchWonjin) rel.push("일지 원진 — 이유 없이 얄미운데 못 떨어지는 자리");
  if (s.yearBranchHap) rel.push("띠(연지) 합 — 큰 흐름에서 성향이 잘 맞음");
  if (s.yearBranchChung) rel.push("띠(연지) 충 — 큰 성향은 반대쪽");
  const relMap: Record<string, string> = {
    saeng_to_pet: `일간 오행 관계 — 보호자가 ${petName}에게 에너지를 주는 방향 (네 존재 자체가 이 아이의 영양제야)`,
    saeng_to_owner: `일간 오행 관계 — ${petName}가 보호자에게 에너지를 주는 방향 (이 아이가 너를 채워주는 쪽)`,
    geuk_to_pet: `일간 오행 관계 — 보호자가 ${petName}를 누르는 방향 (네가 통제하려 들수록 이 아이가 눌린다)`,
    geuk_to_owner: `일간 오행 관계 — ${petName}가 보호자를 누르는 방향 (이 아이한테 네가 휘둘리는 구조)`,
    bihwa: "일간 오행 관계 — 같은 기운 (고집 대 고집, 닮은꼴이라 부딪히면 안 물러남)",
  };
  if (relMap[s.dayMasterRelation]) rel.push(relMap[s.dayMasterRelation]);

  lines.push("■ 두 사람의 관계 신호");
  if (rel.length) rel.forEach((r) => lines.push(`- ${r}`));
  else lines.push("- 특별한 합·충 없음 — 무난한 평지 관계. 극적인 명리 신호를 지어내지 말고 담백하게 서술하라.");

  // ── 펫 자체 기운 ──
  const lowReliability = !s.petDayMasterElement || !s.petTwelveStage; // tier 3·4 (petEnriched null)
  lines.push("");
  lines.push(`■ ${petName} 자체 기운`);
  if (lowReliability) {
    lines.push("- 펫 사주 신뢰도 낮음 (생일 정보 부족) — 세부 명리 신호(신살·12운성) 없음. 종 본성과 보호자 사주 중심으로 서술하고, 없는 신살·12운성을 지어내지 마라.");
  } else {
    const strengthTxt = s.petStrength === "strong" ? "신강 (자기 기운이 세다 — 주관 뚜렷·독립적)"
      : s.petStrength === "weak" ? "신약 (주변 손길이 필요 — 의존적·섬세)"
      : "중화 (균형 잡힘)";
    lines.push(`- 신강약: ${strengthTxt}`);
    const stars: string[] = [];
    if (s.petGwanseong >= 1) stars.push(`관성 ${s.petGwanseong} (규율·질서를 받아들이는 기질, 훈련·복종에 강함)`);
    if (s.petInseong >= 1) stars.push(`인성 ${s.petInseong} (보호자를 의지처로 삼는 기질)`);
    if (s.petSikSang >= 1) stars.push(`식상 ${s.petSikSang} (자유롭게 표현하고 싶은 기질)`);
    if (s.petBigeob >= 1) stars.push(`비겁 ${s.petBigeob} (자기 우선·마이웨이 기질)`);
    if (s.petJaeseong >= 1) stars.push(`재성 ${s.petJaeseong} (원하는 걸 챙기는 실리 기질)`);
    if (stars.length) lines.push(`- 성향(십성): ${stars.join(" / ")}`);
    const shinsal: string[] = [];
    if (s.petHasDohwa) shinsal.push("도화·홍염살 (치명적 매력, 사람을 끌어당기는 애교)");
    if (s.petHasYeokma) shinsal.push("역마살 (돌아다니고 싶은 기운, 한자리에 못 있음)");
    if (s.petHasCheonEulGwiin) shinsal.push("천을귀인 (위기 때 도움받는 귀한 별, 복덩이)");
    if (shinsal.length) lines.push(`- 신살: ${shinsal.join(" / ")}`);
    const elMap: Record<string, string> = { 목: "목 (자라나는·유연한)", 화: "화 (뜨겁고 활발한)", 토: "토 (진득하고 안정적인)", 금: "금 (단단하고 예민한)", 수: "수 (영리하고 유연한)" };
    if (elMap[s.petDayMasterElement]) lines.push(`- 타고난 오행: ${elMap[s.petDayMasterElement]}`);
    lines.push(`- 12운성(지금 기운): ${s.petTwelveStage} — ★futureLine에는 반드시 "${s.petTwelveStage}"만 써라. 다른 12운성 이름(장생·목욕·제왕·쇠·묘·태·양 등)을 지어내면 실패.`);
  }

  // ── 점수 해석 가이드 (서술이 이 방향과 어긋나면 실패) ──
  const gap = scores.lover - scores.loyalty;
  const rulerTxt = scores.ruler >= 60 ? `${petName}가 주도권 — 이 집 결정권이 펫 쪽으로 기운 구조로 그려도 됨`
    : scores.ruler <= 40 ? `보호자가 주도권 — ${petName}를 상전·갑으로 그리지 마라, 네가 이끄는 구조`
    : "대체로 동등";
  const gapTxt = gap >= 15 ? "보호자가 더 매달리는 쪽"
    : gap <= -15 ? `${petName}가 더 매달리는 쪽`
    : "양쪽이 비슷하게 좋아함";
  lines.push("");
  lines.push("■ 점수 해석 (서술 방향이 이와 어긋나면 실패)");
  lines.push(`- 집안 실세(ruler ${scores.ruler}): ${rulerTxt}`);
  lines.push(`- 사랑 방향: 보호자→${petName} ${scores.lover} vs ${petName}→보호자 ${scores.loyalty} → ${gapTxt}`);

  return lines.join("\n");
}

export function buildPetCompatUserInfo(input: PetCompatInput): string {
  const { owner, pet, ownerSajuText, petSajuText, precomputedScores } = input;

  const tierNote: Record<BirthTier, string> = {
    1: "정확한 생일+시 (풀 해석)",
    2: "생일만 (시주 빼고)",
    3: "추정 월·년 (큰 흐름만)",
    4: "가족 된 날 대체 (참고용)",
  };

  const petBirthLine = (() => {
    if (pet.birthTier === 1) return `${pet.birthDate} ${pet.birthTime}`;
    if (pet.birthTier === 2) return `${pet.birthDate} (시 미상)`;
    if (pet.birthTier === 3) return `${pet.birthYearEstimated}년 ${pet.birthMonthEstimated || "?"}월 (추정)`;
    if (pet.birthTier === 4) return `${pet.adoptionDate} (가족 된 날)`;
    return "(미상)";
  })();

  return `
[보호자]
- 이름: ${owner.name}
- 성별: ${owner.gender === "male" ? "남자" : "여자"}
- 생년월일: ${owner.birthYear}-${String(owner.birthMonth).padStart(2, "0")}-${String(owner.birthDay).padStart(2, "0")} (${owner.calendarType === "lunar" ? "음력" : "양력"})
- 출생시간: ${owner.unknownBirthTime ? "모름" : `${String(owner.birthHour).padStart(2, "0")}:${String(owner.birthMinute || 0).padStart(2, "0")}`}
- 출생지역: ${owner.birthLocation}

[보호자 사주 (만세력)]
${ownerSajuText}

[반려동물]
- 이름: ${pet.name}
- 종: ${pet.species === "dog" ? "강아지" : "고양이"}
- ★ 이 아이는 ${pet.species === "dog" ? "강아지" : "고양이"}다. 결과 전체에서 ${pet.species === "dog" ? "고양이" : "강아지"} 전용 행동·용어(${pet.species === "dog" ? "꾹꾹이·골골송·식빵" : "댕댕이·산책·꼬리 프로펠러"} 등)를 쓰면 실패.
- 품종: ${pet.breed || "(미상/믹스)"}
- 성별: ${pet.gender === "male" ? "수컷" : pet.gender === "female" ? "암컷" : "(미상)"}
- 생일 정보: ${petBirthLine}
- 생일 신뢰도: tier ${pet.birthTier} — ${tierNote[pet.birthTier]}
- 입양 경로: ${pet.adoptionRoute || "(미상)"}
- ★ 사양(서버 확정 — manual.spec에 그대로 옮기고, 본문에서 띠·오행 언급 시 이 값과 어긋나지 마라): ${input.petSpec}

[반려동물 사주 (만세력)]
${petSajuText}

[★ 서버 결정값 — 절대 변경 금지, JSON에 그대로 옮겨라]
- composite: ${precomputedScores.composite}
- sync (🐾 호흡): ${precomputedScores.sync}
- ruler (👑 집안 실세, 50=동등 100=펫압도): ${precomputedScores.ruler}
- lover (🐶 보호자 → 펫 사랑): ${precomputedScores.lover}
- loyalty (🐾 펫 → 보호자 충성): ${precomputedScores.loyalty}
- conflict (⚡ 사주 어긋남): ${precomputedScores.conflict}
- grade: ${precomputedScores.grade}
- labelText: "${precomputedScores.labelText}"

[★ 관계의 명리 근거 — 서버가 계산했다. 모든 판정은 반드시 이 근거에서 출발하라. 여기 없는 신살·12운성·합충을 지어내면 실패]
${buildRelationSignalBlock(input.signals, precomputedScores, pet.name)}

위 입력값을 100% 반영해서 시스템 프롬프트의 JSON 스키마에 맞춰 결과만 출력해.
점수·등급·라벨은 위 값 그대로 옮기고, 너는 헤드라인/사용설명서/판정/시뮬/종합 등 텍스트만 생성한다.
★ label.text / headline / finalLine은 서로 다른 내용이어야 한다 (같은 비유·같은 핵심 단어 재사용 금지):
- headline(25~40자): 이 관계의 핵심 역학을 한 방에 찌르는 위트 있는 카피 (labelText가 안 말한 각도). ★신살·12운성·한자 등 명리 용어 이름 절대 금지 — 그 신호가 만드는 '행동/상황'만 쉬운 말로. (❌ "두부 홍염살에 네가 무릎 꿇는 관계" → ✅ "애교 한 방이면 네가 지갑부터 여는 사이")
- finalLine(25~50자): 판정을 관통하는 감정의 마무리 한 줄 (labelText·headline과 다른 단어·다른 각도). 여기도 명리 용어 이름 금지.
`.trim();
}

// ────────────────────────────────────────────────────────
// LLM 호출
// ────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-2.5-flash";

export async function runPetCompatAnalysis(
  input: PetCompatInput,
  options: { model?: string } = {},
): Promise<{ ok: true; result: PetCompatResult; rawText: string } | { ok: false; error: string }> {
  const model = options.model || DEFAULT_MODEL;
  const systemPrompt = buildPetCompatSystemPrompt(input.pet.species);
  const baseUserInfo = buildPetCompatUserInfo(input);

  // 서버 결정값 강제 덮어쓰기 + 한자 후처리 (매 시도 공통)
  const finalize = (parsed: PetCompatResult): PetCompatResult => {
    parsed.scores = {
      composite: input.precomputedScores.composite,
      sync: input.precomputedScores.sync,
      ruler: input.precomputedScores.ruler,
      lover: input.precomputedScores.lover,
      loyalty: input.precomputedScores.loyalty,
      conflict: input.precomputedScores.conflict,
    };
    parsed.label.grade = input.precomputedScores.grade;
    parsed.label.text = input.precomputedScores.labelText;
    if (parsed.manual) parsed.manual.spec = input.petSpec;  // v0.3: spec 서버 결정값 (子띠=金 오류 차단)
    postprocessPetCompatResult(parsed);                     // 한자 ≤ 정책
    return parsed;
  };

  // v0.3: QA 게이트 — 위반 시 위반 목록을 덧붙여 1회 재생성 (지시-only 신뢰 불가)
  let lastError = "";
  let extra = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await callGemini(model, baseUserInfo + extra, systemPrompt, {
      temperature: 0.85,
      maxOutputTokens: 10240,  // v0.4: 판정 풍성화(5~7문장)로 상향
    });
    if (!result.ok) { lastError = `LLM 호출 실패: ${result.message}`; continue; }

    let parsed: PetCompatResult;
    try {
      parsed = finalize(JSON.parse(result.text) as PetCompatResult);
    } catch (err: any) {
      lastError = `JSON 파싱 실패: ${err?.message || "unknown"}`;
      continue;
    }

    const violations = validatePetCompatResult(parsed, { petTwelveStage: input.signals.petTwelveStage });
    if (violations.length === 0 || attempt === 2) {
      if (violations.length > 0) console.warn("[PET_COMPAT][QA] 잔존 위반:", violations.join(", "));
      return { ok: true, result: parsed, rawText: result.text };
    }
    // 재생성: 위반을 명시해 다시 쓰게
    extra = `\n\n[★ 직전 출력이 다음 룰을 위반했다. 아래 표현 없이 완전히 새로 써라: ${violations.join(" / ")}]`;
  }

  return { ok: false, error: lastError || "분석 생성 실패" };
}
