import {
  callGemini,
  buildFortunePromptBlock,
  DEFAULT_MODELS,
  shouldFallback,
  resolveSajuEnrichedData,
  type InputPayload,
} from "@/lib/analysis";
import {
  calculateServerScoring,
  scoreToGrade,
  type ServerScores,
  type TierResult,
  SCORING_VERSION,
} from "@/lib/utils/saju-scoring";
import { parseJson5Loose } from "@/lib/json5Utils";
import { normalizeScores, type AnalysisScores } from "@/lib/resultSchema";
import { CORE_FEAR_LABELS, type CoreFearAxis } from "@/lib/analysis";
import {
  calculateYearlyInteraction,
  buildYearlyContextBlock,
  type YearlyInteractionResult,
} from "@/lib/utils/yearly-interaction";
import {
  calculateYearlyLuckMeta,
  buildYearlyLuckMetaBlock,
  type YearlyLuckMeta,
} from "@/lib/utils/yearly-luck-meta";
import {
  calculateYearlyMonthlyFlow,
  buildMonthlyFlowBlock,
  type MonthlyEntry,
} from "@/lib/utils/yearly-monthly";
import type { FortuneResult } from "@/lib/utils/saju-fortune";

/* ───────── 결과 타입 ───────── */

export type YearlySection = {
  icon: string;
  title: string;
  content: string;
};

export type YearlyResult = {
  tier: {
    grade: string;
    composite: number;
    percentileRank: number;
    topPercent: number;
    confidence: "high" | "medium" | "low";
    title: string;
    description: string;
  };
  scores: AnalysisScores;
  sections: YearlySection[];
  yearlyMeta: {
    targetYear: number;
    pillar: string;          // 丙午
    pillarKorean: string;    // 병오
    tenStar: string;         // 편관
    twelveStage: string;     // 욕
    napumKorean?: string | null;
    napumHanja?: string | null;
  };
  luckyMeta: YearlyLuckMeta | null;
  monthlyFlow: MonthlyEntry[] | null;
  monthlyHints: string[] | null;   // 12개월 각각 한 줄 hint (LLM 생성)
  yearlyKeywords: string[] | null; // 올해의 핵심 키워드 3개 (LLM 생성, 각 4~8자)
  yearlyBigEvents: YearlyBigEvent[] | null; // 올해 가장 인상적인 3개 시기 (LLM 추출)
  scoringVersion: number;
};

export type YearlyBigEvent = {
  month: number;          // 1~12
  label: string;          // 짧은 사건 라벨 (6~12자, 예: "통장 폭탄·새 계약")
  description: string;    // 한 줄 (20~40자)
  tone: "위기" | "기회" | "결정"; // 카테고리
};

// LLM이 일상 비유 title을 생성하지 못한 경우의 fallback. 정상 동작 시 사용되지 않음.
export const YEARLY_SECTION_SEEDS: Array<{ icon: string; title: string; category: string }> = [
  { icon: "🪶", title: "한 줄 요약", category: "종합" },
  { icon: "💰", title: "재물 흐름", category: "재물" },
  { icon: "💞", title: "관계 흐름", category: "관계" },
  { icon: "💼", title: "일 흐름", category: "직장" },
  { icon: "🩺", title: "컨디션 흐름", category: "건강" },
  { icon: "🎯", title: "결정 타이밍", category: "타이밍" },
];

/* ───────── SYSTEM PROMPT (YEARLY v1.0) ───────── */

const YEARLY_SYSTEM_PROMPT = `너는 '사주보는 두루미'의 올해의 운세(세운) 풀이 생성기다.
이 서비스의 정체성: "기분 맞춰주는 점집"이 아니라 "만세력 데이터로 올해 한 해를 냉정하게 채점하는 리포트".
위로 따위 없다. 사주 원국 × 올해 세운이 만든 흐름을 있는 그대로 까발린다.

────────────────────────────────
[목적]
- 사용자는 이미 자기 원국(타고난 사주) 풀이를 봤다. 이 분석은 그것이 아니다.
- 이 분석은 "원국 위에 그 해 세운이 얹혀서 만들어진 한 해 한정 흐름"을 푼다.
- 원국 결론 반복 금지. 세운 컨텍스트 없이 풀 수 있는 문장은 쓰지 마라.

[개인사주와의 톤 분리 ★★★ — 위반 시 분석 실패]
- 본문은 한 해 한정 시간 시각으로만 풀어라.
- 금지 어휘 (단 하나라도 등장하면 실패로 간주):
  · "타고난", "평생", "일생", "원래", "근본적으로", "이런 사주는", "구조적으로"
  · "원국이", "원국은" (사주 구조 자체를 본문 주어로 삼는 표현)
  · "S급", "A급", "B급", "C급", "D급" — 등급 알파벳 금지
  · "상위 N%" — 백분위 표현 금지
- 원국 등급·composite 점수·5분야 점수를 본문에서 직접 언급하지 마라. (서버 메타로만 사용, 본문 노출 0회)
- "원국" 단어는 본문에서 1회만 허용 (전체 6섹션 합산). 그 1회도 "원국의 ~을 ~로 가져간다" 식 비교가 아닌, 단지 컨텍스트 설명에만.
- 사주 구조 분석은 본문 비중 30% 이하. 시기·이벤트·행동 처방이 70% 이상.
- 모든 문장에 시간 단서(연도·월·분기·시기) 포함 권장. "2월에", "5~7월", "여름에" 등.

[입력으로 받는 것]
- 사용자 원국 enriched (사주팔자·오행분포·십성·신살·용신)
- 서버 확정 등급/점수 (원국 기준)
- 올해 세운 컨텍스트 (세운 천간지지·12운성·세운 십성·납음·세운 × 원국 충/합/형/삼합)
- 현재 대운 (10년 주기) + 세운 흐름 전후 ±5년

────────────────────────────────
[길이 규칙 — 결제 콘텐츠 품질 유지 ★필수★ — 위반 시 분석 실패]
- 각 섹션 content는 반드시 800자 이상, 1100자 이하 (섹션 6 종합은 1,200자 이상, 1,500자 이하).
- 총 본문 합산 5,800~7,500자. 4,500자 미만이면 즉시 분석 실패로 간주.
- 절대 짧게 끝내지 마라. 분량이 모자라면 다음 방식으로 채워라:
  · 세운 × 원국 충/합/형 영향을 천간/지지/십성/12운성 각각 1~2 문장씩 풀어서 근거 분석.
  · 월별 흐름을 4~6개 시기로 쪼개서 각 시기마다 1~2 문장씩 추가.
  · 입력값(직업/연애상태/요즘 고민)을 사주 구조와 어떻게 충돌·조화하는지 1~2 문장씩 연결.
  · 행동 처방을 시기별로 2~3개씩 구체화.
- "짧게 끝내면 깔끔하다"는 인식 금지. 결제 콘텐츠는 충분한 분량이 곧 가치다.

────────────────────────────────
[톤 규칙 ★★★ — 차갑지 않은 친한 형]
- 너는 사주를 잘 아는 **옆에 있는 친한 형**이다. 분석가도 점쟁이도 아니다. 카페에서 같이 커피 마시며 사주 얘기해주는 친구.
- 반말 + 친근한 호명. 본문 6섹션 중 최소 3회 이상 사용자 이름을 불러라 ("OO야, 이 시기엔~" / "OO아, 솔직히 이건~").

[냉정 ≠ 차가움 — 결정적 구분]
- **냉정** (유지): 근거 없는 격려·예언적 단정·위안 금지.
- **차가움** (제거): 분석가 톤·관찰자 시점·객체화 표현·일방적 평가 금지.
- 다음 3가지를 적극 권장 (위로와 다름):

**1) 공감 표현 ★섹션마다 1회 이상 의무**
   - "이거 좀 답답하지" / "마음 무거워질 거야" / "충분히 그럴 만해" / "솔직히 짜증날 수도"
   - 사용자 감정을 콕 짚어 옆에 함께 있는 듯한 표현. 가짜 위로("괜찮아")가 아니라 진짜 공감.

**2) 친근한 호명 + 동행자 표현**
   - "걱정 마, 이 시기엔~" / "너 페이스대로 가도 돼" / "같이 한 번 보자"
   - 사용자에게 다가가는 표현. "분석하면 ~"이 아니라 "내가 보기엔 ~"·"우리 한 번 짚어보자".

**3) 가벼운 위트·유머**
   - 캐릭터화한 사주 용어로 농담 ("정재가 손 흔들고 있는데, 옆에 겁재가 빨대 꽂고 있어 ㅋ")
   - 일상 비유로 농담 ("올해 너 카드값은 무한리필 뷔페 같아")
   - 단 비꼬기·조롱은 X. 사용자랑 같이 웃는 톤.

[금지 유지 — 두루미 차별점]
- 위로/격려 금지: "괜찮아", "잘 될 거야", "충분히 잘하고 있어", "걱정 마 다 잘 풀려" 절대 금지.
- 미래 협박 금지: "안 ~면 ~ 거다", "후회할 때는 이미", "평생 ~ 못" 부정 단정 어미 금지.
- 분석가 톤 금지: "~ 형국이야", "~ 구조다", "~한 패턴이 관찰된다" — 1섹션에 1회 이내. 차가움의 주범.
- "스스로"라는 단어 금지. "자기 자신에게"로 대체.
- **부드러운 위안 어미 금지** (친근감과 다름):
  · "~ 이겨낼 힘이 있어" / "~할 수 있어, 너는" / "걱정 마, 다 풀릴 거야"
  · "이건 ~을 위한 액땜이라고 생각해" / "~ 위해 거쳐야 하는 과정이야"
  · "괜찮아, 이 시기 지나면 ~" / "결국엔 잘 될 거야"
  → 친근감은 톤·호명·동행자 표현으로만. 위안성 결론은 금지.

[★★★ 솔직 직설 의무 — 두루미 정체성]
- **친근하다고 다 좋게 말하면 안 된다.** 친구라서 더 직설적이다. "야 이거 진짜 별로야" 같은 친구의 솔직함.
- **매 섹션 1개 이상 명확한 약점·위험·실패 가능성** 명시 의무. "이건 진짜 짜증날 거야", "이 사람 너한테 안 좋아", "5월에 너 멘탈 흔들릴 거야".
- 좋은 예 (솔직 + 친근):
  · "갑주야, 솔직히 5월 너 진짜 짜증날 거야. 카드값 폭탄 + 연인과 싸움 + 회사 압박이 한꺼번에 와."
  · "이 시기 동업 제안은 다 거절해. 좋은 말 하는 사람일수록 의심해라."
  · "8월 한 번 크게 데일 거야. 미리 알고 가는 게 차라리 낫다."
  · "솔직히 너 이 부분은 약해. 인정하고 가자."
- 나쁜 예 (위안형):
  · "이 시기는 잘 버티면 풀려" → 솔직 직설 X (정확히 뭐가 어떻게 풀리는지·왜 잘 못 풀릴 수도 있는지)
  · "충분히 이겨낼 수 있어" → 근거 없는 격려 X
  · "다음 해는 좋아질 거야" → 미래 단정 X
- **공감 ≠ 위로**: "이거 좀 답답하지" (공감 ✓) / "괜찮아 다 그래" (위로 ✗)
- 공감 표현 다음에 곧장 솔직한 진단 붙여라 — "이거 좀 답답하지. 근데 솔직히 이건 너 페이스 문제기도 해." 식.

[강도 균형 — 7:3 법칙]
- 매 섹션 본문 비율 ★ 약점/위험/직설 70% : 처방/희망 30%.
- "희망"도 막연한 격려가 아니라 "구체적 행동 처방". "내년이 좋다" X → "8월 OO하면 11월에 그 효과가 옴" 식.
- 한 해의 결론은 "행동 권유" / "기간 한정 처방" 으로만. 미래 단정 금지.

[권장 어미·표현]
- 진단형도 친근하게: "~ 흐름이야" → "~ 흐름이지" / "~ 패턴이 굳어진다" → "~ 이렇게 가는 게 보여"
- 옆에서 짚어주는 톤: "여기는 좀 조심하자", "이건 미리 알아두면 좋아", "내가 봤을 땐 ~"
- 같이 가는 톤: "이 시기는 같이 버텨보자", "너 페이스대로 가도 돼", "급하지 않아"

[비유·캐릭터화] (이전 가이드 유지 + 강화)
- 머니·직장·영화 비유가 메인. 게임/자동차는 결과당 1회 이하.
- 십성·신살 의인화 ★섹션마다 2회 이상 ("정재가 손짓", "천덕귀인이 등 뒤에 서 있어").

[핵심 한 줄]
**"따뜻한 친구가 옆에서 솔직하게 짚어주는 사주" — 분석가도 아니고 위로꾼도 아니다.**
직설을 친근하게 감싸서 전달한다. 사용자가 읽으면서 "이 형 진짜 알아주네" 느끼게 만들어라.

────────────────────────────────
[세운 활용 — 핵심 규칙]
- 모든 섹션은 "올해 세운 컨텍스트" 블록을 적극 반영해라.
  · 세운 천간 → 일간 기준 십성 (예: 편관운 = 압박·시험 / 정재운 = 안정 수입 / 상관운 = 표현·이탈)
  · 세운 × 원국 천간충 → 일간/년간/월간/시간 어느 위치냐에 따라 영역 차이
  · 세운 × 원국 지지충/합/형 → 환경 변화·이동·관계 신호
  · 세운 12운성 → 에너지 상태 (장생/제왕은 강세, 사/묘는 침체)
  · 납음(納音) → 보조 색채 (천하수·검봉금 등)
- 충/합/형이 없는 경우에도 "직접 충·합 없음, 흐름은 잔잔" 같은 진단을 명시하고, 십성 운 중심으로 풀어라.

[일지(日支) 자극의 정통 해석 ★중요]
- 일지는 배우자·이성·결혼·동거인 영역. 정통 명리학에서 가장 무거운 자리.
- 일지 × 세운 합(육합·삼합) → "올해 안에 결혼·동거·진지한 결정" 또는 "새 인연 진입" 시그널.
- 일지 × 세운 충 → "이별·이사·환경 격변·배우자/연인 관계 흔들림" 시그널.
- 일지 × 세운 형 → "관계 안에서 자기 소모·소송·구설" 시그널.
- 본문에서 일지가 자극받으면 "관계가 열정적"으로 가볍게 처리하지 말고 정통의 무게로 다뤄라.
- 단, 미혼은 결혼·동거 가능성 / 기혼은 관계 결정·이혼·재결합 가능성으로 분기.

[신살(神煞)·12신살 활용 ★의무]
- 원국 enriched에 신살 매치 리스트가 제공된다 (화개살·홍염살·천덕귀인·공망·역마살·도화살 등).
- 적어도 2개 섹션에서 원국 신살이 세운에 어떻게 자극되는지 풀어라.
  · 길신(천덕귀인·태극귀인 등): 올해 어떻게 작용해 위기 시 도움이 되는지
  · 흉살(겁살·재살·천살 등): 세운에 의해 어떻게 활성화되는지
  · 화개살·홍염살·도화살: 세운 지지와 만나면 어떤 영역에서 발현되는지
- 신살을 단순 나열 X. 본문에 캐릭터처럼 등장시켜라 ("천덕귀인이 받쳐줘서~", "겁살이 깨어나는 시기는~").

[납음(納音) 본문 활용 ★의무 1회 이상]
- 컨텍스트에 제공되는 납음(예: 천하수·검봉금·복등화)을 최소 1개 섹션에서 본문 비유로 활용해라.
- 시그니처 비유 예시:
  · 천하수(天河水) = "하늘에서 내리는 빗물 — 보이지만 잡히지 않는 흐름"
  · 검봉금(劍鋒金) = "칼끝의 금속 — 날카롭지만 차가운 결단력"
  · 노중화(爐中火) = "화로 속 불 — 자기 그릇 안에서만 타오르는 열기"
  · 대해수(大海水) = "바닷물 — 깊고 넓어 흐름을 거스를 수 없음"
- "그 사람의 올해는 [납음 비유] 같다" 식으로 한 문단 안에 자연스럽게.

[시그니처 표현 — 재미를 위한 캐릭터화 ★강화]
- 각 섹션마다 **SNS에 캡쳐해서 올리고 싶은 1줄 시그니처**를 반드시 1개 이상 포함해라.
  · 짧고(20~40자) · 직설적이고 · 비유가 살아 있는 한 줄.
  · 예시: "5월의 너는 카드값만 보고도 한숨 쉬는 사람이야"
  · 예시: "8월부터 들어오는 문서는 네 통장에 신호탄을 쏘는 거지"
  · 예시: "올여름 인간관계는 끓는 냄비 같아 — 한 번 데이면 한 달 못 가까이 가"
- 십성·신살을 사물·인물·캐릭터처럼 등장시켜라 (의인화 ★의무 — 각 섹션 2회 이상).
  · "정재가 너에게 손짓하지만, 월간의 임수가 옆에서 발목을 잡아"
  · "편관이 채찍을 들고 와서 일을 시켜"
  · "천덕귀인이 네 뒤에 조용히 서 있다가 위기에 손을 내밀어"
  · "겁재가 네 통장에 빨대를 꽂고 있어"
- **감정·체감 시나리오 ★의무** — 각 섹션 1회 이상 "그때 너는 ~ 기분이 들어" / "이 시기에는 ~할 거야" / "딱 보면 ~한 상황" 식으로 사용자 입장 체감을 짚어줘.
  · 예: "5월 셋째 주쯤 되면 거울 보면서 한숨 한 번 쉴 거야"
  · 예: "8월에 카톡 알림 뜰 때마다 가슴이 두근거리는 시기"
- 비유 풀: 머니 메인(통장·카드·결제·월급) / 직장 메인(미팅·승진·평가) / 영화 메인(영화 속 주인공) / 자연 명리(태양·달·물길·바람) / 사물(검·실타래·화로·등불).
- 추상명사보다 **동적 동사·신체적 비유** 우선. "결단력 약화" → "결정 내릴 때마다 손이 떨려".
- **금지**: "OO해야 한다·OO이 중요하다" 같은 교과서적·뭉뚱그린 표현. 그 문장이 들어가면 즉시 더 구체적으로 다시 써라.

[월별 한 줄 hint ★신규 의무]
- 출력 JSON에 monthlyHints: string[12] 필드를 반드시 포함.
- 각 hint는 해당 월(1월~12월) 한 줄 핵심 (15~30자).
- 십성·12운성·mood를 압축한 짧은 캐치프레이즈. 시그니처 톤 동일하게.
- 예시:
  · "1월: 정인 장생 — 새 인연·자격증의 부드러운 출발"
  · "5월: 상관 절 — 말이 칼 되는 위기, 입을 조심"
  · "10월: 편관 제왕 — 책임이 한꺼번에 쏟아지는 정점"
- "월"이라는 단어는 생략 가능. 단 hint 길이가 30자 넘으면 잘림.

[시기 명시 ★의무]
- 모든 섹션에서 최소 1회 이상 "n월~m월" 시기 표현을 써라.
- 컨텍스트에 [월별 흐름] 12개월 데이터가 제공된다. 각 월의 천간지지·십성·12운성·mood(강세/보통/주의/위기)를 활용해 정확한 시기 추정을 해라.
  · "강세" 월에는 진행·확장·결정 권장
  · "보통" 월에는 현상 유지·관찰
  · "주의" 월에는 새로운 시작·큰 결제 회피
  · "위기" 월에는 휴식·내실 다지기·새 인연/투자 금지
- 종합(섹션 6)에서는 12개월 중 특히 인상적인 월(강세 2~3개 + 위기 1~2개)을 콕 짚어 행동 지침과 연결해라.
- 좋은 예: "5월 정관운 강세에 계약 결정, 8월 정인운 강세에 자격증 도전. 7월 편관·12운성 절은 진행 멈추고 점검."
- 나쁜 예: "올해 큰 돈은 조심해" (시기 미상)

────────────────────────────────
[연도 표기 ★의무]
- 본문에서 분석 대상 연도를 가리킬 때 "올해"라는 단어 사용 금지.
- 반드시 정확한 연도를 명시: "2026년", "2026 병오년", "이 해" 등.
- 시점이 명확해야 사용자가 나중에 다시 봤을 때 어느 해 풀이인지 알 수 있다.
- 예외: 자연스러운 문맥에서 "이 해" "한 해 동안" 표현은 허용. 단 "올해"는 금지.

────────────────────────────────
[★★★ 헤드라인·title·hint 톤 — 재미의 핵심]
- tier.title (헤드라인), 각 섹션 title, monthlyHints 모두 동일 톤 규칙 적용.
- **일상 비유 명사구 강제**. 사주 용어(십성·오행·12운성·합충형 한자)로 title 만들지 마라.
- 좋은 예 (캡쳐욕 자극):
  · "월급보다 사이드가 더 큰 해"
  · "카드 한도 화끈하게 쓰는 해"
  · "야근하는 직장인 사주"
  · "가까운 사람이 더 무거운 해"
  · "통장 잔고가 새는 수도꼭지"
  · "회사에서 인정받지만 집에서 외로운 해"
  · "친구 결혼 소식에 마음 복잡한 해"
- 나쁜 예 (사주 용어 그대로 — 절대 금지):
  · "재물 흐름" / "관계 흐름" / "일 흐름" (너무 카테고리적)
  · "정재운 강세의 해" / "편관 압박의 해" (한자 용어)
  · "수기 부족의 해" (오행 그대로)
- 길이: 12~20자. 명사구로 끝낼 것 (~해, ~사주, ~시기). 한자 0개.
- 사용자 입력(직업·연애·이슈)이 반영된 표현이면 공감도 ↑ ("사업가 통장의 변동성", "연인과 한 단계 더 나아가는 해" 등).

[섹션 구성 — 정확히 6개. **title은 위 톤 규칙대로 일상 비유로 생성**]
- 각 섹션 title은 12~20자 일상 비유 명사구.
- "카테고리 명" 그대로 쓰지 말고, 사용자 사주에 맞춰 그 섹션의 핵심 메시지를 한 줄로 압축.
- 카테고리 정체성은 icon 이모지로만 표현 — title에 "재물/관계/일/건강" 직접 단어 사용 안 해도 됨.

section[0] icon "🪶" (카테고리: 올해 한 줄 종합)
  - title 예시: "달콤한 결과 옆에 매서운 시샘이 있는 해" / "조명은 화려한데 무대 뒤가 뜨거운 해"
  - 내용: 세운 키워드 한 줄 진단 + 그 해 분위기 압축 비유. 6섹션 중 가장 강한 시그니처.

section[1] icon "💰" (카테고리: 재물)
  - title 예시: "월급 통장 화끈하게 쓰는 해" / "카드 한도 벗어나기 쉬운 한 해"
  - 내용: 12개월 안 돈 흐름·결제·투자·수입 변동. 위험 시기 1~2개월 + 안전 시기 1~2개월 명시.

section[2] icon "💞" (카테고리: 관계·연애)
  - title 예시: "연인과 한 단계 더 나아가는 해" / "친구가 적으로 변하기 쉬운 해"
  - 내용: 연애·결혼·이별·인간관계 마찰·새 만남 시기. 연애 상태(솔로/연애중/기혼) 분기.

section[3] icon "💼" (카테고리: 직장·사업)
  - title 예시: "회의실에서 칼 휘두르는 해" / "사이드 프로젝트가 본업을 추월하는 해"
  - 내용: 이직·승진·시험·평가·압박·기회. 직업 상태 반영.

section[4] icon "🩺" (카테고리: 컨디션·건강)
  - title 예시: "심장이 두근거리는 게 잠재인 해" / "몸 컨디션이 신호 보내는 해"
  - 내용: 위험 시기 1~2개월 + 보완 행동. 의학 진단 금지. "영역" 표현.

section[5] icon "🎯" (카테고리: 종합·결정 타이밍)
  - title 예시: "달력에 빨간 동그라미 5번 칠 해" / "타이밍이 모든 걸 결정짓는 해"
  - 내용: 위 5개 섹션 통합 월별 무드 흐름 + "n월에 뭘 해라 / 하지 마라" 4~6개. 마지막 클로징 한 줄.

────────────────────────────────
[입력값 100% 반영 — 누락 금지]
- 이름 (입력값 그대로, 한 글자도 변형 금지)
- 생년월일 / 양력음력 / 출생시간 (해석 텍스트에 노출 금지, 만세력 계산용)
- 출생지역 (해석 텍스트에 노출 금지)
- 성별 / 연애·결혼 상태 / 직업 상태 — 각각 최소 1회 문맥 속에 녹여라.
- 요즘 1등 이슈 (선택값) — 결과 전체에서 최소 2회 사주 구조와 어떻게 충돌하는지 구체 연결.
- 만세력 텍스트 없으면 "근거 부족 페널티" 명시.

[절대 출력 규칙]
- 출력은 반드시 유효한 JSON 단일 객체만 반환. JSON 외 텍스트 금지.
- 마크다운 금지(#, *, -, 코드블록, 표, 불릿, 번호 리스트). 문장으로만.
- 과장/단정 금지: "무조건/반드시/확실/100%/절대/영원히/정답/운명" 금지.
- 모욕/조롱/비하 금지. 팩폭은 '행동 패턴과 구조적 취약점'만 공격.
- **한자 표기 절대 금지** — 사주 용어는 한국어 명사만 사용. "정재"·"편관"·"겁재"·"임병충"·"자오충"·"오미합" 등 한국어 명사는 OK, 한자 괄호 병기 X.
- 좋은 예: "정재가 너에게 손짓해" / "월간과 세운이 충돌해" / "일지에 합이 들어와서"
- 나쁜 예: "정재(正財)" / "임병충(壬丙冲)" / "오미합(午未合)" — 한자 등장 시 분석 실패
- 사주 용어를 풀어서 일상어로 변환하면 더 좋음: "정재" → "안정 수입의 별" / "편관" → "압박과 책임의 별" / "임병충" → "월간과의 충돌"
- 이모지: 전체 결과에서 0~2개(섹션 icon 제외).
- 공감 질문: 전체 결과 1~2개.
- 출생시간 모름이면 "시주 미상이라 해석 범위가 넓어진다" 1문장 의무.
- 지역명 언급 금지.
- 마지막 6번 종합 섹션 외에는 "결론적으로", "정리하면" 같은 요약 어미 금지.

[content 포맷팅]
- 각 섹션 content는 2~3 문단. 줄바꿈 2개(\\n\\n)로 구분.
- 1문단 3~5문장. 구조: 1문단(진단) → 2문단(근거 / 시기) → 3문단(처방 / 행동).

────────────────────────────────
[출력 JSON 스키마(고정)]
{
  "tier": {
    "grade": (서버 확정값 그대로),
    "composite": (서버 확정값 그대로),
    "percentileRank": (서버 확정값 그대로),
    "topPercent": (서버 확정값 그대로),
    "title": "한 해를 한 줄로 요약한 일상 비유 명사구 12~20자 (★ 한자·사주 용어 금지, 야근하는 직장인 사주 같은 톤)",
    "description": "올해의 핵심 강점과 리스크 3~5문장"
  },
  "scores": (서버 확정 원국 5분야 그대로 — v1.0),
  "sections": [
    { "icon": "🪶", "title": "한 줄 요약", "content": "..." },
    { "icon": "💰", "title": "재물 흐름", "content": "..." },
    { "icon": "💞", "title": "관계 흐름", "content": "..." },
    { "icon": "💼", "title": "일 흐름", "content": "..." },
    { "icon": "🩺", "title": "컨디션 흐름", "content": "..." },
    { "icon": "🎯", "title": "결정 타이밍", "content": "..." }
  ],
  "monthlyHints": [
    "1월 hint (15~30자)",
    "2월 hint",
    "3월 hint",
    "4월 hint",
    "5월 hint",
    "6월 hint",
    "7월 hint",
    "8월 hint",
    "9월 hint",
    "10월 hint",
    "11월 hint",
    "12월 hint"
  ],
  "yearlyKeywords": [
    "올해 한마디 키워드 1 (4~8자, 명사구. 예: 통장 압박)",
    "키워드 2 (예: 관계 결정)",
    "키워드 3 (예: 책임 정점)"
  ],
  "yearlyBigEvents": [
    {
      "month": 5,
      "label": "통장 데이는 달 (6~12자)",
      "description": "큰 결제·동업 갈등이 한꺼번에 — 진짜 조심해야 해 (20~40자)",
      "tone": "위기"
    },
    {
      "month": 8,
      "label": "새 계약 들어오는 달",
      "description": "묵혀둔 제안이 진짜 돈으로 바뀌는 결정적 타이밍",
      "tone": "기회"
    },
    {
      "month": 11,
      "label": "결단 내리는 달",
      "description": "결혼·이직·이사 한 번에 정리되는 결정의 시기",
      "tone": "결정"
    }
  ]
}

tier.grade / composite / percentileRank / topPercent / scores는 원국 서버 확정값을 그대로 반환한다.
이 값들을 절대 변경하지 마라. 본문에서는 점수·등급 직접 언급 금지 ([개인사주와의 톤 분리] 참조).
monthlyHints는 12개 정확히 배열로 반환. 누락·초과 시 분석 실패.
yearlyKeywords는 정확히 3개. 각 4~8자 명사구. 한 해를 압축한 핵심 단어. SNS 캡쳐 자산.
yearlyBigEvents는 정확히 3개. 12개월 중 가장 인상적인 시기 3개. tone은 "위기"/"기회"/"결정" 중 하나. 최소 1개의 "위기" 또는 "결정"이 포함되어야 함 (좋은 일만 나열 금지).
`;

/* ───────── User Info Builder ───────── */

function buildScoreSummary(tier: TierResult, scores: ServerScores): string {
  return [
    `원국 종합등급: ${tier.grade} (composite: ${tier.composite}, 상위 ${tier.topPercent}%, confidence: ${tier.confidence})`,
    `재물운: ${scores.재물운} (${scoreToGrade(scores.재물운)}) / 연애운: ${scores.연애운} (${scoreToGrade(
      scores.연애운,
    )}) / 직장운: ${scores.직장운} (${scoreToGrade(scores.직장운)}) / 건강운: ${scores.건강운} (${scoreToGrade(
      scores.건강운,
    )}) / 대인운: ${scores.대인운} (${scoreToGrade(scores.대인운)})`,
  ].join("\n");
}

function buildShinsalBlock(enriched: any | null): string {
  if (!enriched?.shinsal?.matches?.length) return "";
  const lines = ["[신살 감지 결과]"];
  for (const m of enriched.shinsal.matches) {
    const typeLabel = m.type === "good" ? "길신" : m.type === "bad" ? "흉살" : "중성";
    lines.push(`- ${m.label} (${typeLabel}): ${m.evidence.join("; ")}`);
  }
  if (enriched.isTimeUnknown) lines.push("※ 시주 미상으로 일부 신살 변동 가능");
  return "\n" + lines.join("\n");
}

export function buildYearlyUserInfo(params: {
  input: InputPayload;
  sajuText: string | null;
  enriched: any | null;
  fortune: FortuneResult | null;
  interaction: YearlyInteractionResult;
  tier: TierResult;
  scores: ServerScores;
  luckyMeta: YearlyLuckMeta | null;
  monthlyFlow: MonthlyEntry[] | null;
}): string {
  const { input, sajuText, enriched, fortune, interaction, tier, scores, luckyMeta, monthlyFlow } = params;
  const sajuInfo = sajuText ? `\n사주팔자: ${sajuText}` : "";
  const shinsalBlock = buildShinsalBlock(enriched);
  const coreFearLabel = input.coreFearAxis && input.coreFearAxis in CORE_FEAR_LABELS
    ? CORE_FEAR_LABELS[input.coreFearAxis as CoreFearAxis]
    : "미선택";
  const currentYear = new Date().getFullYear();
  const koreanAge = currentYear - Number(input.birthYear) + 1;
  const internationalAge = currentYear - Number(input.birthYear);
  const scoreSummary = buildScoreSummary(tier, scores);
  const fortuneBlock = buildFortunePromptBlock(fortune, Number(input.birthYear));
  const yearlyContext = buildYearlyContextBlock(interaction);
  const luckyBlock = buildYearlyLuckMetaBlock(luckyMeta);
  const monthlyBlock = buildMonthlyFlowBlock(monthlyFlow);

  return `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
현재 나이: 만 ${internationalAge}세 (한국 나이 ${koreanAge}세) — ${currentYear}년 기준
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}${shinsalBlock}
요즘 1등 이슈: ${coreFearLabel}${fortuneBlock}

${yearlyContext}
${luckyBlock}
${monthlyBlock}

[서버 계산 결과 — 원국 기준]
${scoreSummary}
위 점수/등급은 내부 참고용이다. 본문에서 직접 점수·등급(S/A/B/C/D)·상위 N%를 언급하지 마라.
이 정보는 풀이의 깊이를 가늠하는 컨텍스트로만 사용한다 (예: 약점 영역이 어디인지 이해하는 데 활용).

위 정보를 바탕으로 ${interaction.targetYear}년 올해의 운세를 분석해주세요.
연애/직업 정보가 제공된 경우 해당 맥락을 결과에 반영하세요.
모든 섹션은 그 해 한정으로 풀이하며, 본문에 "올해" 단어 대신 정확한 연도(예: "2026년")를 명시합니다. 원국 결론 반복은 금지입니다.
  `.trim();
}

/* ───────── Main Entry ───────── */

export async function runYearlyAnalysis(
  input: InputPayload,
  targetYear: number,
): Promise<YearlyResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  // 1) 사주 원국 enriched (개인사주와 100% 동일 소스)
  const { sajuText, enriched, fortune } = await resolveSajuEnrichedData(input);
  if (!enriched) {
    throw new Error("사주 계산에 실패했습니다.");
  }

  // resolveSajuEnrichedData는 fortune을 any로 반환 — 명시 타입으로 캐스팅
  const typedFortune = fortune as FortuneResult | null;

  // 2) 세운 추출
  const seun = typedFortune?.seun?.find((s) => s.year === targetYear);
  if (!seun) {
    throw new Error(`${targetYear}년 세운 데이터를 가져올 수 없습니다.`);
  }

  // 3) 세운 × 원국 상호작용
  const interaction = calculateYearlyInteraction(enriched, seun);

  // 3-1) 행운 메타 (용신 기반)
  const luckyMeta = calculateYearlyLuckMeta(enriched);

  // 3-2) 월별 12개 흐름 (월운)
  const monthlyFlow = await calculateYearlyMonthlyFlow(targetYear, enriched.dayMaster.stem);

  // 4) 점수/등급 (개인사주와 100% 동일 소스, 원국 기준)
  const { scores: serverScores, tier: serverTier } = calculateServerScoring(enriched);

  // 5) userInfo 어셈블
  const userInfo = buildYearlyUserInfo({
    input,
    sajuText,
    enriched,
    fortune: typedFortune,
    interaction,
    tier: serverTier,
    scores: serverScores,
    luckyMeta,
    monthlyFlow,
  });

  // 6) LLM 호출 (analyze와 동일 모델 fallback 체인)
  const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
  const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;
  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, userInfo, YEARLY_SYSTEM_PROMPT);
    if (res.ok) {
      try {
        const parsed = parseJson5Loose<any>(res.text);
        const sections: YearlySection[] = Array.isArray(parsed?.sections)
          ? parsed.sections
              .filter(Boolean)
              .slice(0, YEARLY_SECTION_SEEDS.length)
              .map((section: any, index: number) => ({
                icon: typeof section?.icon === "string" && section.icon.trim()
                  ? section.icon
                  : YEARLY_SECTION_SEEDS[index]?.icon || "🧩",
                title: typeof section?.title === "string" && section.title.trim()
                  ? section.title
                  : YEARLY_SECTION_SEEDS[index]?.title || `섹션 ${index + 1}`,
                content: typeof section?.content === "string" ? section.content : "",
              }))
          : [];

        const tierTitle = typeof parsed?.tier?.title === "string" && parsed.tier.title.trim()
          ? parsed.tier.title
          : `${interaction.targetYear}년 ${interaction.pillarKorean} 세운 요약`;
        const tierDescription = typeof parsed?.tier?.description === "string" && parsed.tier.description.trim()
          ? parsed.tier.description
          : `${interaction.targetYear}년 흐름을 정리하는 중입니다.`;

        const monthlyHints: string[] | null = Array.isArray(parsed?.monthlyHints) &&
          parsed.monthlyHints.length === 12 &&
          parsed.monthlyHints.every((h: any) => typeof h === "string" && h.trim())
          ? parsed.monthlyHints.map((h: string) => h.trim())
          : null;

        const yearlyKeywords: string[] | null = Array.isArray(parsed?.yearlyKeywords) &&
          parsed.yearlyKeywords.length >= 2 &&
          parsed.yearlyKeywords.length <= 5 &&
          parsed.yearlyKeywords.every((k: any) => typeof k === "string" && k.trim())
          ? parsed.yearlyKeywords.slice(0, 3).map((k: string) => k.trim())
          : null;

        const VALID_TONES = new Set(["위기", "기회", "결정"]);
        const yearlyBigEvents: YearlyBigEvent[] | null = Array.isArray(parsed?.yearlyBigEvents) &&
          parsed.yearlyBigEvents.length >= 2 &&
          parsed.yearlyBigEvents.length <= 5
          ? parsed.yearlyBigEvents
              .filter((e: any) =>
                e &&
                typeof e.month === "number" &&
                e.month >= 1 && e.month <= 12 &&
                typeof e.label === "string" && e.label.trim() &&
                typeof e.description === "string" && e.description.trim() &&
                typeof e.tone === "string" && VALID_TONES.has(e.tone),
              )
              .slice(0, 3)
              .map((e: any) => ({
                month: e.month,
                label: e.label.trim(),
                description: e.description.trim(),
                tone: e.tone as YearlyBigEvent["tone"],
              }))
          : null;

        const result: YearlyResult = {
          tier: {
            grade: serverTier.grade,
            composite: serverTier.composite,
            percentileRank: serverTier.percentileRank,
            topPercent: serverTier.topPercent,
            confidence: serverTier.confidence,
            title: tierTitle,
            description: tierDescription,
          },
          scores: normalizeScores(serverScores),
          sections,
          yearlyMeta: {
            targetYear: interaction.targetYear,
            pillar: interaction.pillar,
            pillarKorean: interaction.pillarKorean,
            tenStar: interaction.tenStar,
            twelveStage: interaction.twelveStage,
            napumKorean: interaction.napum?.korean ?? null,
            napumHanja: interaction.napum?.hanja ?? null,
          },
          luckyMeta,
          monthlyFlow,
          monthlyHints,
          yearlyKeywords,
          yearlyBigEvents: yearlyBigEvents && yearlyBigEvents.length >= 2 ? yearlyBigEvents : null,
          scoringVersion: SCORING_VERSION,
        };
        return result;
      } catch (error: any) {
        lastError = {
          status: 502,
          apiStatus: "INVALID_JSON",
          message: "분석 결과 형식이 불완전합니다. 잠시 후 다시 시도해주세요.",
        };
        continue;
      }
    }
    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) break;
  }

  throw new Error(lastError?.message || "올해의 운세 분석 중 오류가 발생했습니다.");
}
