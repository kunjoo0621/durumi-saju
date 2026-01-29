import { NextRequest, NextResponse } from "next/server";

// 목업 데이터 (개발용)
const MOCK_DATA = {
  tier: {
    grade: "A-",
    percentile: 15,
    title: "엔진은 강력한데 핸들이 좀 헐거운 스포츠카",
    description: "잠재력은 충분한데 방향성이 애매할 때가 많아요. 한 분야에 집중하면 탑티어까지 올라갈 수 있는 사람인데, 이것저것 손대다가 에너지가 분산되는 경향이 있어요. 일단 한 우물만 파면 진짜 대박 나는 타입입니다."
  },
  scores: {
    재물운: { score: 78, grade: "B+" },
    연애운: { score: 65, grade: "B" },
    직장운: { score: 82, grade: "A" },
    건강운: { score: 70, grade: "B+" },
    대인운: { score: 88, grade: "A" }
  },
  sections: [
    {
      icon: "🎭",
      title: "타고난 DNA",
      content: "당신의 일간은 甲木(갑목)인데, 子月(자월)에 태어났어요. 한겨울에 태어난 나무라 뿌리는 깊지만 가지가 잘 안 뻗는 구조예요. 이게 무슨 뜻이냐면, 내면은 단단한데 겉으로 표현하는 게 서툰 타입이라는 거예요. 어릴 때부터 '너 속을 모르겠다'는 소리 들어본 적 있죠? 혼자 끙끙 앓다가 나중에 터뜨리는 스타일이에요. 그래도 일단 마음 열면 의리 하나는 끝내주는 게 갑목의 특징입니다. 천천히 크지만 결국엔 큰 나무가 되는 사람이에요."
    },
    {
      icon: "💰",
      title: "돈과의 케미",
      content: "사주에 편재(偏財)가 있는데 비겁(比劫)이 많아요. 돈 들어올 구멍은 큰데 새는 구멍도 많은 구조라는 거죠. 벌 땐 많이 버는데, 쓸 때도 과감하게 써버려서 통장에 돈이 안 남는 패턴 아니었어요? 특히 친구 생일이나 모임에서 계산할 때 가장 먼저 카드 내미는 스타일일 거예요. 재테크는 혼자 하면 망하니까 자동이체나 적금처럼 강제 저축이 답입니다. 30대 중반 이후부터 재성(財星)이 좋아지니까 그때부터는 쌓이기 시작해요. 지금은 버는 힘 키우는 데 집중하세요."
    },
    {
      icon: "💕",
      title: "연애 성적표",
      content: "당신은 정관(正官)보다 편관(偏官)이 있는 사주예요. 정석적이고 안정적인 사랑보다는 좀 드라마틱한 관계를 겪을 가능성이 높아요. 소개팅보다는 우연히 만난 사람한테 끌리고, 뻔한 데이트보다 색다른 경험 같이 하는 게 재밌잖아요? 그런데 이게 양날의 칼이라서, 초반엔 재밌는데 오래 가려면 루틴이 필요한데 그게 안 맞는 거예요. 잘 맞는 타입은 당신만큼 자유롭지만 책임감은 있는 사람. 너무 평범하거나 보수적인 사람은 답답해서 못 견딥니다. 결혼은 늦어도 30대 중후반에 잘 맞는 사람 만나면 안정되니 조급해하지 마세요."
    },
    {
      icon: "💼",
      title: "커리어 내비게이션",
      content: "식신(食神)이 강하고 편인(偏印)도 있는 구조예요. 창의력은 뛰어난데 정해진 틀 안에서 일하는 게 답답한 타입이라는 거죠. 9 to 6 루틴이 딱 안 맞죠? 기획자, 크리에이터, 컨설턴트, 프리랜서처럼 재량권이 큰 일이 적성에 맞아요. 반대로 공무원이나 은행원처럼 매뉴얼 따라 하는 직업은 3년 못 가요. 회사에서도 실무자보다 팀장이나 PM 역할이 잘 맞고요. 다만 혼자 하면 흐지부지되니까 파트너나 팀이 있어야 지속 가능합니다. 35세 전후로 독립하거나 창업하는 게 수입적으로나 만족도 면에서 베스트예요."
    },
    {
      icon: "👥",
      title: "인간관계 리포트",
      content: "비겁(比劫)이 많은데 관성(官星)이 약해요. 친구나 동료는 많은데 윗사람이나 권위 있는 사람하고는 좀 불편한 관계예요. 선배나 상사한테 '얘는 왜 저렇게 튀지?'라는 소리 들어본 적 있지 않아요? 조직에서 눈 밖에 나기 쉬운 구조라서 정치력이 필요해요. 친구들 사이에서는 리더 포지션이거나 분위기 메이커인데, 위계질서 있는 곳에서는 적응이 좀 힘들죠. 그래서 수평적 조직이나 스타트업이 맞아요. 가족 관계는 부모님보다 형제자매나 사촌들하고 더 친하고, 나이 들수록 혈연보다 영혼의 친구들이 더 중요해질 거예요."
    },
    {
      icon: "⚠️",
      title: "위험 신호",
      content: "2026년은 丙午年(병오년)이라 당신 사주에 충(沖)이 들어와요. 특히 6-8월에 午未(오미)가 겹치면서 변화의 에너지가 강해지는데, 이때 큰 결정은 신중하게 하세요. 이직, 이사, 결혼 같은 중대사는 8월 이후로 미루는 게 좋아요. 건강은 火(화) 기운이 너무 세져서 염증이나 열성 질환 조심해야 하고요. 특히 심장, 혈압, 안구건조증 쪽 체크하세요. 금전적으로는 5월과 10월에 큰돈 나갈 일 있으니 미리 비상금 준비해두고요. 친구나 지인한테 투자, 보증, 대출 요청 들어와도 무조건 거절하세요. 이 시기는 내 일 잘하는 게 최선입니다."
    },
    {
      icon: "🔮",
      title: "2025-2026 전망",
      content: "2025년 하반기(8-12월)는 준비 기간이에요. 새로운 프로젝트 제안이나 기회가 들어올 텐데, 바로 뛰어들지 말고 리서치 먼저 하세요. 2026년 2-5월이 진짜 기회의 창이에요. 이때 준비된 사람은 연봉 30% 이상 올리거나 직급 점프 가능해요. 특히 3월은 대운(大運)과 세운(歲運)이 맞아떨어져서 10년에 한 번 올까 말까 한 타이밍이니 놓치지 마세요. 연애운은 2026년 봄(3-4월)에 제일 좋아서, 미팅이나 소개팅 있으면 적극적으로 나가세요. 기혼이라면 배우자 운도 좋아지니까 여행이나 큰 계획 세우기 좋은 시기예요."
    },
    {
      icon: "✨",
      title: "결론",
      content: "당신 사주는 A-급인데 실제 발휘하는 건 B급 정도예요. 왜냐면 에너지가 분산되어 있거든요. 앞으로 2년이 인생의 전환점이 될 건데, 핵심은 '선택과 집중'입니다. 이것저것 다 잘하려다가 다 놓치지 말고, 하나 정해서 올인하세요. 그럼 상위 5% 안에 들어갈 수 있는 잠재력이 충분한 사람입니다. 당신의 무기는 끈기와 성실함이니, 화려하게 가지 말고 꾸준하게 가세요."
    }
  ]
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
- 예시 문장 스타일:
  - 연애 중: "현재 연애 중이시네요. 올해 연애운을 보면..."
  - 솔로/미혼: "아직 인연을 찾고 계시네요. 좋은 인연이 올 시기는..."
  - 직장인: "현재 직장에서의 운세를 보면..."
  - 사업/프리랜서: "사업/프리랜서 관점에서 보면..."
  - 학생: "학업운 관점에서 보면..."
  - 취업 준비 중: "취업운을 살펴보면..."

[섹션별 작성 규칙 - 매우 중요]
각 섹션은 반드시 아래 구조로 4-6문장 이상 작성:

1. 사주 근거 먼저 제시 (1-2문장)
   - 일간, 월지, 천간지지, 십성 등 구체적 사주 요소 언급
   - 한자 병기 필수
   - 예: "당신의 일간은 壬水(임수)인데, 午月(오월)에 태어났어요. 한여름에 태어난 물이라 증발하기 쉬운 구조예요."

2. 현대적 해석 (2-3문장)
   - 사주 근거를 일상 언어로 풀어서 설명
   - 구체적 예시와 비유 사용
   - 예: "이게 무슨 뜻이냐면, 에너지가 확 타오르다가 금방 식는 타입이라는 거예요. 새 프로젝트 시작할 때 누구보다 열정적인데, 3개월 지나면 '이거 왜 하고 있지?' 싶은 적 많지 않았어요?"

3. 구체적 팩트나 조언 (1-2문장)
   - 실용적이고 구체적인 가이드
   - 숫자, 시기, 상황 등 디테일 포함
   - 예: "그래서 당신한테는 마감이 있는 일이 약입니다. 프리랜서보다 회사, 혼자보다 팀이 맞아요."

[분량]
- 각 섹션 최소 4-6문장, 현재보다 2배 정도 길게
- 일반론 금지, 개인화된 분석 필수

[Output Format - JSON]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "tier": {
    "grade": "A+",
    "percentile": 8,
    "title": "비유적 한 줄 요약 (예: 설계도는 완벽한데 공사를 안 하는 건축가)",
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
      "content": "사주 근거(일간, 월지 등 한자 병기) → 현대적 해석(구체적 예시와 공감 질문) → 조언 (4-6문장)"
    },
    {
      "icon": "💰",
      "title": "돈과의 케미",
      "content": "재성(財星)과 비겁(比劫) 구조 → 돈 버는/쓰는 패턴 분석 → 재테크 조언 (4-6문장)"
    },
    {
      "icon": "💕",
      "title": "연애 성적표",
      "content": "관성(官星) 분석 → 연애 스타일과 패턴 → 잘 맞는/피해야 할 타입 (4-6문장)"
    },
    {
      "icon": "💼",
      "title": "커리어 내비게이션",
      "content": "식상(食傷)과 인성(印星) 분석 → 적성과 업무 스타일 → 구체적 직업군 제시 (4-6문장)"
    },
    {
      "icon": "👥",
      "title": "인간관계 리포트",
      "content": "비겁(比劫)과 관성(官星) 관계 → 대인관계 패턴 → 실용적 조언 (4-6문장)"
    },
    {
      "icon": "⚠️",
      "title": "위험 신호",
      "content": "형충파해(刑沖破害) 분석 → 구체적 시기(년/월) → 주의사항 (4-6문장)"
    },
    {
      "icon": "🔮",
      "title": "2025-2026 전망",
      "content": "대운(大運)/세운(歲運) 분석 → 구체적 월별 운세 → 기회 포착 가이드 (4-6문장)"
    },
    {
      "icon": "✨",
      "title": "결론",
      "content": "핵심 사주 특징 요약 → 가장 중요한 조언 한 가지 (3-4문장)"
    }
  ]
}

[등급 기준]
- S: 상위 1% (극히 드문 대길)
- A+: 상위 5%
- A: 상위 10%
- A-: 상위 15%
- B+: 상위 25%
- B: 상위 40%
- B-: 상위 55%
- C+: 상위 70%
- C: 상위 85%
- D: 하위 15%

[사주 분석 원칙]
- 사주팔자(년주, 월주, 일주, 시주) 정확히 계산
- 음양오행 균형 분석
- 십성 해석 반영
- 대운/세운 흐름 고려`;

const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

function getModelFallbacks(): string[] {
  const fromEnv = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
}

function shouldFallback(status: number, apiStatus?: string) {
  if (status === 429 || status === 503) return true;
  if (!apiStatus) return false;
  return apiStatus === "RESOURCE_EXHAUSTED" || apiStatus === "UNAVAILABLE";
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
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
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

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    console.log("=== API 요청 시작 ===");

    // Mock 모드 체크
    const useMock = process.env.USE_MOCK === "true";
    console.log("Mock 모드:", useMock);

    if (useMock) {
      // Mock 모드: 실제 API 호출 없이 가짜 데이터 반환
      console.log("Mock 데이터 반환 (API 비용 절약)");

      // 약간의 딜레이를 주어 실제 API 호출처럼 보이게
      await new Promise((resolve) => setTimeout(resolve, 1500));

      return NextResponse.json({ result: MOCK_DATA });
    }

    // 실제 API 모드
    console.log("API 키 존재:", !!process.env.GEMINI_API_KEY);
    console.log("API 키 앞 6자:", process.env.GEMINI_API_KEY?.substring(0, 6));

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요." },
        { status: 500 }
      );
    }

    // 사용자 정보를 프롬프트로 구성
    const sajuInfo = data.saju ? `\n사주팔자: ${data.saju}` : "";
    const userInfo = `
이름: ${data.name}
생년월일: ${data.birthYear}년 ${data.birthMonth}월 ${data.birthDay}일
달력구분: ${data.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${data.unknownBirthTime ? "모름" : `${data.birthHour}시 ${data.birthMinute}분`}
출생지역: ${data.birthLocation}
성별: ${data.gender}
연애/결혼 상태: ${data.relationshipStatus}
직업/직장 상태: ${data.employmentStatus || data.jobStatus || "미제공"}${sajuInfo}

위 정보를 바탕으로 사주를 분석해주세요. 연애/직업 정보가 제공된 경우 해당 맥락을 결과에 반영하세요. 사주팔자가 제공된 경우 반드시 해당 정보를 기반으로 정확하게 분석하세요.
    `.trim();

    const prompt = `${SYSTEM_PROMPT}\n\n[User]\n${userInfo}`;
    const models = getModelFallbacks();
    let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

    for (const model of models) {
      console.log(`모델 호출 시작: ${model}`);
      const res = await callGemini(model, prompt);
      if (res.ok) {
        console.log("API 호출 성공");
        const cleaned = extractJson(res.text);
        try {
          const parsed = JSON.parse(cleaned);
          return NextResponse.json({ result: parsed });
        } catch (parseError) {
          console.warn("JSON 파싱 실패, 원문 반환");
          return NextResponse.json({ result: cleaned });
        }
      }

      lastError = res;
      console.warn(`모델 실패: ${model}`, res.status, res.apiStatus, res.message);

      if (!shouldFallback(res.status, res.apiStatus)) {
        break;
      }
    }

    return NextResponse.json(
      {
        error: "사주 분석 중 오류가 발생했습니다.",
        details: lastError?.message || "알 수 없는 오류"
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("=== API Error 상세 ===");
    console.error("에러 타입:", error?.constructor?.name);
    console.error("에러 메시지:", error?.message);
    console.error("에러 상태 코드:", error?.status);
    console.error("전체 에러:", JSON.stringify(error, null, 2));

    return NextResponse.json(
      {
        error: "사주 분석 중 오류가 발생했습니다.",
        details: error?.message || "알 수 없는 오류"
      },
      { status: 500 }
    );
  }
}
