import JSON5 from "json5";
import crypto from "crypto";

export type AnalysisResult = {
  tier: {
    grade: string;
    percentile: number;
    title: string;
    description: string;
  };
  scores: Record<string, { score: number; grade: string }>;
  sections: Array<{
    icon: string;
    title: string;
    content: string;
  }>;
  coreFearAxisBlock?: string;
};

export type TeaserSection = {
  icon: string;
  title: string;
};

export type TeaserResult = {
  tier: {
    grade: string;
    percentile: number;
    title: string;
    description: string;
  };
  scores: Record<string, { score: number; grade: string }>;
  sections: TeaserSection[];
  coreFearAxisBlock?: string;
};

export type CoreFearAxis = "DISMISS" | "ABANDON" | "INCOMPETENT" | "LOSS_OF_CONTROL";

export type InputPayload = {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: CoreFearAxis | "";
  unknownBirthTime: boolean;
  saju?: string | null;
};

// 핵심 공포 축 라벨
export const CORE_FEAR_LABELS: Record<CoreFearAxis, string> = {
  DISMISS: "무시/가치절하",
  ABANDON: "버려짐/관계 단절",
  INCOMPETENT: "무능/실패 노출",
  LOSS_OF_CONTROL: "통제 상실/불확실",
};

// 핵심 공포 축 중립 템플릿
export const CORE_FEAR_TEMPLATES: Record<CoreFearAxis, {
  inference: string;
  strongWeak: string;
  relationshipBranch: Record<string, string>;
  employmentBranch: Record<string, string>;
}> = {
  DISMISS: {
    inference:
      "이 축을 선택한 경우, 타인에게 인정받지 못하거나 무시당하는 상황에서 불안이 촉발될 수 있습니다. " +
      "이로 인해 자신의 가치를 증명하려는 행동이 자주 나타나며, 성취나 외적 평가에 민감해지는 경향이 있습니다.",
    strongWeak:
      "이 축이 강하면 칭찬과 인정에 크게 반응하고, 약하면 외부 평가에 덜 흔들리는 편입니다.",
    relationshipBranch: {
      솔로: "혼자일 때 자신의 매력이나 가치에 의문을 품기 쉽습니다.",
      연애중: "파트너의 관심이 줄어들면 자신이 덜 중요해졌다고 느낄 수 있습니다.",
      기혼: "배우자의 무관심이 자존감에 영향을 줄 수 있습니다.",
    },
    employmentBranch: {
      직장인: "상사나 동료의 피드백에 예민하게 반응할 수 있습니다.",
      "사업·프리랜서": "클라이언트의 평가가 자기 가치와 직결되는 느낌을 받을 수 있습니다.",
      학생: "성적이나 교수의 평가가 자신감에 크게 영향을 줄 수 있습니다.",
      "취업 준비 중": "불합격 통보가 자신의 능력 전체를 부정당한 것처럼 느껴질 수 있습니다.",
    },
  },
  ABANDON: {
    inference:
      "이 축을 선택한 경우, 관계가 끊기거나 혼자 남겨지는 상황에서 불안이 촉발될 수 있습니다. " +
      "이로 인해 관계 유지에 많은 에너지를 쏟거나, 거리를 두는 상대에게 집착하는 패턴이 나타날 수 있습니다.",
    strongWeak:
      "이 축이 강하면 관계 변화에 민감하고, 약하면 혼자 있는 시간도 편하게 받아들이는 편입니다.",
    relationshipBranch: {
      솔로: "새로운 관계를 시작하는 것보다 거절당할 가능성을 더 크게 느낄 수 있습니다.",
      연애중: "파트너의 연락이 뜸해지면 관계가 끝날 것 같은 불안이 올 수 있습니다.",
      기혼: "배우자와의 정서적 거리감이 생기면 강한 불안을 느낄 수 있습니다.",
    },
    employmentBranch: {
      직장인: "팀에서 소외되거나 배제되는 느낌에 예민할 수 있습니다.",
      "사업·프리랜서": "장기 클라이언트와의 관계 종료가 큰 상실로 느껴질 수 있습니다.",
      학생: "친구 그룹에서 빠지거나 따돌림에 대한 걱정이 있을 수 있습니다.",
      "취업 준비 중": "면접 탈락이 사회에서 배제된 느낌으로 연결될 수 있습니다.",
    },
  },
  INCOMPETENT: {
    inference:
      "이 축을 선택한 경우, 자신의 무능함이 드러나거나 실패가 노출되는 상황에서 불안이 촉발될 수 있습니다. " +
      "이로 인해 완벽주의적 성향이 나타나거나, 새로운 도전을 회피하는 패턴이 생길 수 있습니다.",
    strongWeak:
      "이 축이 강하면 실수에 대한 두려움이 크고, 약하면 실패를 성장의 일부로 받아들이는 편입니다.",
    relationshipBranch: {
      솔로: "연애 실패 경험이 자신의 능력 부족으로 해석될 수 있습니다.",
      연애중: "파트너 앞에서 부족한 모습을 보이는 것이 부담될 수 있습니다.",
      기혼: "배우자나 가족에게 좋은 모습을 유지해야 한다는 압박을 느낄 수 있습니다.",
    },
    employmentBranch: {
      직장인: "업무 실수나 성과 부진이 큰 스트레스 요인이 될 수 있습니다.",
      "사업·프리랜서": "사업 실패가 자신의 전문성 전체를 부정하는 것처럼 느껴질 수 있습니다.",
      학생: "시험이나 발표에서의 실패가 과도한 자기비판으로 이어질 수 있습니다.",
      "취업 준비 중": "취업 실패가 능력 부족의 증거로 느껴질 수 있습니다.",
    },
  },
  LOSS_OF_CONTROL: {
    inference:
      "이 축을 선택한 경우, 상황을 통제할 수 없거나 미래가 불확실한 상황에서 불안이 촉발될 수 있습니다. " +
      "이로 인해 계획을 철저히 세우거나, 예상치 못한 변화에 강하게 저항하는 패턴이 나타날 수 있습니다.",
    strongWeak:
      "이 축이 강하면 예측 가능성을 중시하고, 약하면 즉흥적인 상황에도 유연하게 대처하는 편입니다.",
    relationshipBranch: {
      솔로: "연애의 불확실성 자체가 시작을 망설이게 하는 요인이 될 수 있습니다.",
      연애중: "관계의 방향이 불분명하면 불안이 커질 수 있습니다.",
      기혼: "예상치 못한 가정 내 변화에 스트레스를 받을 수 있습니다.",
    },
    employmentBranch: {
      직장인: "조직 변화나 갑작스러운 업무 변경이 큰 스트레스가 될 수 있습니다.",
      "사업·프리랜서": "불안정한 수입과 예측 불가능한 상황이 부담될 수 있습니다.",
      학생: "진로의 불확실성이나 갑작스러운 일정 변경이 스트레스가 될 수 있습니다.",
      "취업 준비 중": "취업 시장의 불확실성이 지속적인 불안 요인이 될 수 있습니다.",
    },
  },
};

const MOCK_DATA: AnalysisResult = {
  tier: {
    grade: "A-",
    percentile: 15,
    title: "엔진은 강력한데 핸들이 좀 헐거운 스포츠카",
    description:
      "잠재력은 충분한데 방향성이 애매할 때가 많아요. 한 분야에 집중하면 탑티어까지 올라갈 수 있는 사람인데, 이것저것 손대다가 에너지가 분산되는 경향이 있어요. 일단 한 우물만 파면 진짜 대박 나는 타입입니다.",
  },
  scores: {
    재물운: { score: 78, grade: "B+" },
    연애운: { score: 65, grade: "B" },
    직장운: { score: 82, grade: "A" },
    건강운: { score: 70, grade: "B+" },
    대인운: { score: 88, grade: "A" },
  },
  sections: [
    {
      icon: "🎭",
      title: "타고난 DNA",
      content:
        "당신의 일간은 甲木(갑목)인데, 子月(자월)에 태어났어요. 한겨울에 태어난 나무라 뿌리는 깊지만 가지가 잘 안 뻗는 구조예요. 이게 무슨 뜻이냐면, 내면은 단단한데 겉으로 표현하는 게 서툰 타입이라는 거예요. 어릴 때부터 '너 속을 모르겠다'는 소리 들어본 적 있죠? 혼자 끙끙 앓다가 나중에 터뜨리는 스타일이에요. 그래도 일단 마음 열면 의리 하나는 끝내주는 게 갑목의 특징입니다. 천천히 크지만 결국엔 큰 나무가 되는 사람이에요.",
    },
    {
      icon: "💰",
      title: "돈과의 케미",
      content:
        "사주에 편재(偏財)가 있는데 비겁(比劫)이 많아요. 돈 들어올 구멍은 큰데 새는 구멍도 많은 구조라는 거죠. 벌 땐 많이 버는데, 쓸 때도 과감하게 써버려서 통장에 돈이 안 남는 패턴 아니었어요? 특히 친구 생일이나 모임에서 계산할 때 가장 먼저 카드 내미는 스타일일 거예요. 재테크는 혼자 하면 망하니까 자동이체나 적금처럼 강제 저축이 답입니다. 30대 중반 이후부터 재성(財星)이 좋아지니까 그때부터는 쌓이기 시작해요. 지금은 버는 힘 키우는 데 집중하세요.",
    },
    {
      icon: "💕",
      title: "연애 성적표",
      content:
        "당신은 정관(正官)보다 편관(偏官)이 있는 사주예요. 정석적이고 안정적인 사랑보다는 좀 드라마틱한 관계를 겪을 가능성이 높아요. 소개팅보다는 우연히 만난 사람한테 끌리고, 뻔한 데이트보다 색다른 경험 같이 하는 게 재밌잖아요? 그런데 이게 양날의 칼이라서, 초반엔 재밌는데 오래 가려면 루틴이 필요한데 그게 안 맞는 거예요. 잘 맞는 타입은 당신만큼 자유롭지만 책임감은 있는 사람. 너무 평범하거나 보수적인 사람은 답답해서 못 견딥니다. 결혼은 늦어도 30대 중후반에 잘 맞는 사람 만나면 안정되니 조급해하지 마세요.",
    },
  ],
};

const SYSTEM_PROMPT = `[Role]
당신은 '운명 데이터 분석가'입니다. 사주를 데이터처럼 분석해서 등급과 수치로 보여주되, 설명은 친구한테 말하듯 재밌고 술술 읽히게 합니다.

[핵심 컨셉]
- 등급과 퍼센트로 객관화 (S/A/B/C/D 등급, 상위 N%)
- 카테고리별 점수 시각화
- 설명은 비유와 스토리텔링으로 재밌게
- 좋은 말 60% + 팩트폭력 40%

[문체 규칙]
- 반말과 존댓말 적절히 섞기
- 이모지 사용 OK
- 마크다운 문법(**bold**, ## 등) 절대 사용 금지
- "ㅋㅋ", "ㄹㅇ" 같은 인터넷 용어 금지
- 사주 용어는 한자 병기 (예: 편관(偏官), 식신(食神))
- "~하지 않았어요?", "~한 적 있죠?" 같은 공감 질문 넣기

[사용자 입력 반영 규칙 - 필수]
- 사용자가 입력한 연애 상태와 직업/직장 상태를 반드시 반영하세요.
- 해당 정보가 있는 경우, 관련 섹션에서 직접 언급하고 맞춤 해석을 제공합니다.

[섹션별 작성 규칙 - 매우 중요]
각 섹션은 반드시 아래 구조로 4-6문장 이상 작성:

1. 사주 근거 먼저 제시 (1-2문장)
2. 현대적 해석 (2-3문장)
3. 구체적 팩트나 조언 (1-2문장)

[Output Format - JSON]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "tier": {
    "grade": "A+",
    "percentile": 8,
    "title": "비유적 한 줄 요약",
    "description": "2-3문장 핵심 설명"
  },
  "scores": {
    "재물운": { "score": 85, "grade": "A" },
    "연애운": { "score": 72, "grade": "B+" },
    "직장운": { "score": 68, "grade": "B" },
    "건강운": { "score": 90, "grade": "A+" },
    "대인운": { "score": 75, "grade": "B+" }
  },
  "sections": [
    {
      "icon": "🎭",
      "title": "타고난 DNA",
      "content": "사주 근거 → 현대적 해석 → 조언"
    }
  ]
}`;

const TEASER_PROMPT = `[Role]
당신은 '운명 데이터 분석가'입니다. 사주를 데이터처럼 분석해서 등급과 수치로만 간단히 요약합니다.

[핵심 컨셉]
- 등급과 퍼센트로 객관화 (S/A/B/C/D 등급, 상위 N%)
- 카테고리별 점수 시각화
- 섹션은 제목/아이콘만 제공 (본문 설명 금지)

[문체 규칙]
- 마크다운 문법(**bold**, ## 등) 절대 사용 금지
- 불필요한 텍스트 금지, JSON만 반환

[Output Format - JSON]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "tier": {
    "grade": "A+",
    "percentile": 8,
    "title": "비유적 한 줄 요약",
    "description": "2-3문장 핵심 설명"
  },
  "scores": {
    "재물운": { "score": 85, "grade": "A" },
    "연애운": { "score": 72, "grade": "B+" },
    "직장운": { "score": 68, "grade": "B" },
    "건강운": { "score": 90, "grade": "A+" },
    "대인운": { "score": 75, "grade": "B+" }
  },
  "sections": [
    { "icon": "🎭", "title": "타고난 DNA" },
    { "icon": "💰", "title": "돈과의 케미" },
    { "icon": "💕", "title": "연애 성적표" }
  ]
}`;

const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1).trim();
  }
  return text.trim();
}

async function callGemini(model: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        response_mime_type: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiStatus = data?.error?.status;
    const message = data?.error?.message || "Gemini API error";
    return { ok: false as const, status: response.status, apiStatus, message };
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    return { ok: false as const, status: 500, apiStatus: undefined, message: "빈 응답" };
  }

  return { ok: true as const, text };
}

function shouldFallback(status: number, apiStatus?: string) {
  if (status === 429 || status === 503) return true;
  if (!apiStatus) return false;
  return apiStatus === "RESOURCE_EXHAUSTED" || apiStatus === "UNAVAILABLE";
}

export function buildInputHash(input: InputPayload) {
  const normalizeText = (value?: string) => (value || "").trim().replace(/\s+/g, " ");
  const normalizeNumber = (value?: string, length = 2) => {
    if (!value) return "";
    const numeric = String(parseInt(value, 10));
    if (!numeric || numeric === "NaN") return "";
    return numeric.padStart(length, "0");
  };

  const normalized = JSON.stringify({
    name: normalizeText(input.name),
    birthYear: normalizeNumber(input.birthYear, 4),
    birthMonth: normalizeNumber(input.birthMonth, 2),
    birthDay: normalizeNumber(input.birthDay, 2),
    calendarType: input.calendarType || "solar",
    birthHour: input.unknownBirthTime ? "unknown" : normalizeNumber(input.birthHour, 2),
    birthMinute: input.unknownBirthTime ? "unknown" : normalizeNumber(input.birthMinute, 2),
    birthLocation: normalizeText(input.birthLocation),
    gender: normalizeText(input.gender),
    relationshipStatus: normalizeText(input.relationshipStatus),
    employmentStatus: normalizeText(input.employmentStatus),
    coreFearAxis: normalizeText(input.coreFearAxis),
    unknownBirthTime: Boolean(input.unknownBirthTime),
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// 핵심 공포 축 블록 생성 함수
export function buildCoreFearAxisBlock(
  axis: CoreFearAxis,
  relationshipStatus?: string,
  employmentStatus?: string
): string {
  const template = CORE_FEAR_TEMPLATES[axis];
  const label = CORE_FEAR_LABELS[axis];

  let result = `선택한 축: ${label}\n\n`;
  result += template.inference + "\n\n";
  result += template.strongWeak;

  // 연애 상태 분기 추가
  if (relationshipStatus && template.relationshipBranch[relationshipStatus]) {
    result += "\n\n" + template.relationshipBranch[relationshipStatus];
  }

  // 직업 상태 분기 추가
  if (employmentStatus && template.employmentBranch[employmentStatus]) {
    result += "\n\n" + template.employmentBranch[employmentStatus];
  }

  return result;
}

export function buildTeaserFromFull(full: AnalysisResult): TeaserResult {
  return {
    tier: full.tier,
    scores: full.scores,
    sections: (full.sections || []).map((section) => ({
      icon: section.icon,
      title: section.title,
    })),
  };
}

export function assertNoContentKey(value: unknown, path: string[] = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoContentKey(item, [...path, String(index)]));
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === "content") {
      const where = path.length ? path.join(".") : "root";
      throw new Error(`Teaser payload contains forbidden key 'content' at ${where}`);
    }
    assertNoContentKey(record[key], [...path, key]);
  }
}

export async function runFullAnalysis(input: InputPayload) {
  const useMock = process.env.USE_MOCK === "true";
  if (useMock) {
    const mockResult = { ...MOCK_DATA };
    if (input.coreFearAxis) {
      mockResult.coreFearAxisBlock = buildCoreFearAxisBlock(
        input.coreFearAxis as CoreFearAxis,
        input.relationshipStatus,
        input.employmentStatus
      );
    }
    return mockResult;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  const sajuInfo = input.saju ? `\n사주팔자: ${input.saju}` : "";
  const userInfo = `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
출생지역: ${input.birthLocation}
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}

위 정보를 바탕으로 사주를 분석해주세요. 연애/직업 정보가 제공된 경우 해당 맥락을 결과에 반영하세요.
  `.trim();

  const prompt = `${SYSTEM_PROMPT}\n\n[User]\n${userInfo}`;
  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;
  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, prompt);
    if (res.ok) {
      const cleaned = extractJson(res.text);
      const parsed = JSON5.parse(cleaned) as AnalysisResult;

      // 핵심 공포 축 블록 추가
      if (input.coreFearAxis) {
        parsed.coreFearAxisBlock = buildCoreFearAxisBlock(
          input.coreFearAxis as CoreFearAxis,
          input.relationshipStatus,
          input.employmentStatus
        );
      }

      return parsed;
    }

    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) {
      break;
    }
  }

  throw new Error(lastError?.message || "사주 분석 중 오류가 발생했습니다.");
}

export async function runTeaserAnalysis(input: InputPayload) {
  const useMock = process.env.USE_MOCK === "true";
  if (useMock) {
    const teaser = buildTeaserFromFull(MOCK_DATA);
    if (input.coreFearAxis) {
      teaser.coreFearAxisBlock = buildCoreFearAxisBlock(
        input.coreFearAxis as CoreFearAxis,
        input.relationshipStatus,
        input.employmentStatus
      );
    }
    return teaser;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  const userInfo = `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
출생지역: ${input.birthLocation}
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}
  `.trim();

  const prompt = `${TEASER_PROMPT}\n\n[User]\n${userInfo}`;
  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;
  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, prompt);
    if (res.ok) {
      const cleaned = extractJson(res.text);
      const parsed = JSON5.parse(cleaned) as TeaserResult;

      // 핵심 공포 축 블록 추가
      if (input.coreFearAxis) {
        parsed.coreFearAxisBlock = buildCoreFearAxisBlock(
          input.coreFearAxis as CoreFearAxis,
          input.relationshipStatus,
          input.employmentStatus
        );
      }

      return parsed;
    }

    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) {
      break;
    }
  }

  throw new Error(lastError?.message || "사주 분석 중 오류가 발생했습니다.");
}
