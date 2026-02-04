import JSON5 from "json5";
import crypto from "crypto";
import { calculateSaju, formatSajuText } from "@/lib/utils/saju";
import { convertLunarToSolar } from "@/lib/utils/lunar";

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
  DISMISS: "인간관계",
  ABANDON: "이직·커리어",
  INCOMPETENT: "돈·재정",
  LOSS_OF_CONTROL: "건강·컨디션",
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
      "요즘 고민 1순위가 인간관계라면, ‘거리감’과 ‘소속감’ 사이에서 균형을 찾고 있을 가능성이 큽니다. " +
      "말 한마디나 분위기 변화에 민감해질 수 있고, 관계의 온도를 자주 점검하게 될 수 있어요.",
    strongWeak:
      "이 고민이 강하면 작은 오해도 크게 느껴지고, 약하면 관계를 유연하게 바라보는 편입니다.",
    relationshipBranch: {
      솔로: "새 만남의 시작에서 ‘우리 대화 잘 맞나?’가 핵심 포인트가 될 수 있습니다.",
      연애중: "연락 빈도나 말투 변화에 예민해지기 쉬운 타이밍입니다.",
      기혼: "역할 분담이나 소통 방식이 관계 만족도를 좌우할 수 있습니다.",
    },
    employmentBranch: {
      직장인: "팀 내 관계와 커뮤니케이션 방식이 스트레스 요인일 수 있습니다.",
      "사업·프리랜서": "고객과의 신뢰 관리가 성과만큼 중요하게 느껴질 수 있습니다.",
      학생: "친구/동아리 관계에서 거리감이 고민으로 이어질 수 있습니다.",
      "취업 준비 중": "면접/네트워킹에서의 첫인상과 관계 형성이 핵심일 수 있습니다.",
    },
  },
  ABANDON: {
    inference:
      "요즘 커리어가 고민 1순위라면, ‘지금 방향이 맞나?’라는 질문이 자주 떠오를 수 있어요. " +
      "성장 속도, 평가, 방향 전환(이직/전환)에 대한 관심이 커질 수 있습니다.",
    strongWeak:
      "이 고민이 강하면 작은 피드백에도 커리어 전체가 흔들리는 느낌이 들 수 있고, 약하면 장기 플랜으로 차분히 가는 편입니다.",
    relationshipBranch: {
      솔로: "일에 몰입하면서 연애/만남 우선순위가 내려갈 수 있습니다.",
      연애중: "커리어 고민이 커지면 데이트/시간 배분에 민감해질 수 있습니다.",
      기혼: "가정의 안정과 커리어 변화 사이에서 선택의 무게가 커질 수 있습니다.",
    },
    employmentBranch: {
      직장인: "이직 타이밍, 승진 루트, 역할 변화가 핵심 고민이 될 수 있습니다.",
      "사업·프리랜서": "프로젝트 파이프라인과 브랜딩 방향이 중요해질 수 있습니다.",
      학생: "전공/진로 선택과 인턴 경험이 커리어 방향의 힌트가 될 수 있습니다.",
      "취업 준비 중": "지원 전략, 포트폴리오, 합격 신호에 집중하게 될 수 있습니다.",
    },
  },
  INCOMPETENT: {
    inference:
      "요즘 돈/재정이 고민 1순위라면, 수입과 지출의 흐름이 더 예민하게 느껴질 수 있습니다. " +
      "‘지금 잘 굴러가고 있나?’를 계속 체크하는 시기일 수 있어요.",
    strongWeak:
      "이 고민이 강하면 작은 지출에도 불안이 커지고, 약하면 돈을 도구로 차분히 관리하는 편입니다.",
    relationshipBranch: {
      솔로: "자기계발/취미 비용과 저축 사이의 균형이 고민일 수 있습니다.",
      연애중: "데이트 비용, 미래 자금에 대한 합의가 중요해질 수 있습니다.",
      기혼: "가계/대출/자녀 교육비 등 장기 계획이 핵심이 될 수 있습니다.",
    },
    employmentBranch: {
      직장인: "연봉/성과급/복지가 재정 안정감에 큰 영향을 줄 수 있습니다.",
      "사업·프리랜서": "매출 변동과 현금흐름 관리가 가장 큰 이슈가 될 수 있습니다.",
      학생: "알바/용돈 등 단기 재정 계획이 고민이 될 수 있습니다.",
      "취업 준비 중": "준비 비용과 공백 기간의 지출이 부담이 될 수 있습니다.",
    },
  },
  LOSS_OF_CONTROL: {
    inference:
      "요즘 건강/컨디션이 고민 1순위라면, 몸의 신호와 생활 리듬을 더 예민하게 체감하고 있을 수 있습니다. " +
      "컨디션이 곧 하루 성과를 좌우한다고 느껴질 수 있어요.",
    strongWeak:
      "이 고민이 강하면 작은 피로에도 불안해지고, 약하면 루틴을 안정적으로 유지하는 편입니다.",
    relationshipBranch: {
      솔로: "생활 패턴을 지키는 것이 중요해지는 시기일 수 있습니다.",
      연애중: "약속/일정 조율이 컨디션 관리에 영향을 줄 수 있습니다.",
      기혼: "가족 건강과 생활 리듬 관리가 우선순위가 될 수 있습니다.",
    },
    employmentBranch: {
      직장인: "야근/수면 부족이 컨디션에 직접 영향을 줄 수 있습니다.",
      "사업·프리랜서": "불규칙한 일정이 컨디션 관리의 큰 변수일 수 있습니다.",
      학생: "시험/과제 시즌에 컨디션 기복이 심해질 수 있습니다.",
      "취업 준비 중": "루틴 관리가 멘탈/체력 유지의 핵심이 될 수 있습니다.",
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
당신은 '두루미 사주 결과 디렉터'입니다. 사주(만세력)를 데이터처럼 분석해 등급/점수로 보여주고, 설명은 MZ 세대가 읽기 쉬운 톤으로 재밌고 술술 읽히게 합니다.

[핵심 컨셉]
- 등급과 퍼센트로 객관화 (S/A/B/C/D 등급, 상위 N%)
- 카테고리별 점수 시각화
- 설명은 비유/스토리텔링 + 현실적인 디테일
- 좋은 말 60% + 팩트 40% (과장/단정 금지)

[문체 규칙]
- 반말/존댓말 적절히 섞기 (가볍고 자연스럽게)
- 이모지 사용 OK (과도하게 쓰지 않기)
- 마크다운 문법(**bold**, ## 등) 절대 사용 금지
- "ㅋㅋ", "ㄹㅇ" 같은 인터넷 용어 금지
- 사주 용어는 한자 병기 (예: 편관(偏官), 식신(食神))
- "~하지 않았어요?", "~한 적 있죠?" 같은 공감 질문 1~2개 포함

[사용자 입력 반영 규칙 - 필수]
아래 입력값을 모두 자연스럽게 반영하세요. 누락 금지.
- 사주팔자(만세력) 정보
- 성별
- 연애/결혼 상태
- 직업/직장 상태
- 요즘 1등 이슈(고민)

반영 방식:
- 최소 2개 섹션에서 직접 언급
- 요즘 1등 이슈는 적어도 1개 섹션에서 명확히 연결
- 성별/연애/직장 상태는 문장 속에 자연스럽게 녹여서 설명

[섹션별 작성 규칙 - 매우 중요]
각 섹션은 반드시 아래 구조로 4-6문장 이상 작성:
1) 사주 근거 먼저 제시 (1-2문장)
2) 현대적 해석 (2-3문장)
3) 구체적 포인트/행동 팁 (1-2문장)

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
      "content": "사주 근거 → 현대적 해석 → 팁"
    }
  ]
}`;

const TEASER_PROMPT = `[Role]
당신은 '두루미 사주 결과 디렉터'입니다. 사주를 데이터처럼 분석해서 등급과 수치로만 간단히 요약합니다.

[핵심 컨셉]
- 등급과 퍼센트로 객관화 (S/A/B/C/D 등급, 상위 N%)
- 카테고리별 점수 시각화
- 섹션은 제목/아이콘만 제공 (본문 설명 금지)

[문체 규칙]
- 마크다운 문법(**bold**, ## 등) 절대 사용 금지
- 불필요한 텍스트 금지, JSON만 반환
- 본문(content) 생성 금지 (섹션 제목/아이콘만)

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

export async function resolveSajuText(input: InputPayload) {
  const existing = input.saju?.trim();
  if (existing) return existing;

  const year = Number(input.birthYear);
  const month = Number(input.birthMonth);
  const day = Number(input.birthDay);
  if (!year || !month || !day) return null;

  let calcYear = year;
  let calcMonth = month;
  let calcDay = day;

  if (input.calendarType === "lunar") {
    const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
    if (!converted) return null;
    calcYear = converted.year;
    calcMonth = converted.month;
    calcDay = converted.day;
  }

  const hour = input.unknownBirthTime ? undefined : Number(input.birthHour || "0");
  const minute = input.unknownBirthTime ? undefined : Number(input.birthMinute || "0");

  try {
    const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute);
    if (!saju) return null;
    return formatSajuText(saju);
  } catch (error) {
    console.warn("[SAJU] failed to resolve saju text", error);
    return null;
  }
}

// 핵심 공포 축 블록 생성 함수
export function buildCoreFearAxisBlock(
  axis: CoreFearAxis,
  relationshipStatus?: string,
  employmentStatus?: string
): string {
  const template = CORE_FEAR_TEMPLATES[axis];
  const label = CORE_FEAR_LABELS[axis];

  let result = `선택한 고민: ${label}\n\n`;
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

  const resolvedSajuText = await resolveSajuText(input);
  const sajuInfo = resolvedSajuText ? `\n사주팔자: ${resolvedSajuText}` : "";
  const coreFearLabel = input.coreFearAxis
    ? CORE_FEAR_LABELS[input.coreFearAxis as CoreFearAxis]
    : "미선택";
  const userInfo = `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
출생지역: ${input.birthLocation}
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}
요즘 1등 이슈: ${coreFearLabel}

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

  const resolvedSajuText = await resolveSajuText(input);
  const sajuInfo = resolvedSajuText ? `\n사주팔자: ${resolvedSajuText}` : "";
  const coreFearLabel = input.coreFearAxis
    ? CORE_FEAR_LABELS[input.coreFearAxis as CoreFearAxis]
    : "미선택";
  const userInfo = `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
출생지역: ${input.birthLocation}
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}
요즘 1등 이슈: ${coreFearLabel}
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
