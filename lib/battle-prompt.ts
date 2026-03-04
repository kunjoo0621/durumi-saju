import { callGemini, shouldFallback, DEFAULT_MODELS } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import type { ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import { scoreToGrade } from "@/lib/utils/saju-scoring";
import type { BattleInteraction } from "@/lib/utils/battle-interaction";
import type {
  BattleComparison,
  BattleLlmAnalysis,
  FutureTimelineEntry,
  RelationshipType,
} from "@/types/battle";
import { postprocessBattleResult, type SubjectVerification } from "@/lib/battle-postprocess";
import { surgicalRewriteBattle } from "@/lib/surgical-rewrite";
import type { SelectedSimulation } from "@/lib/battle-simulations";

/* ── 관계 유형별 톤 ── */

const RELATIONSHIP_TONE: Record<RelationshipType, string> = {
  lover: "연인 관계에 맞게 솔직한 톤으로 분석하라. 반말 유지, 위로/격려 금지.",
  friend: "친구 관계에 맞게 재미있고 가벼운 톤으로 분석하라. 친구 간 우열 비교를 유쾌하게 풀어라.",
  colleague: "직장동료 관계에 맞게 프로페셔널하면서도 위트 있는 톤으로 분석하라. 업무 스타일 차이에 초점.",
  family: "가족 관계에 맞게 객관적인 톤으로 분석하라. 가족 내 역할과 시너지를 언급하라. 반말 유지, 위로/격려 금지.",
  other: "일반적인 톤으로 두 사람의 사주를 비교 분석하라.",
};

const RELATIONSHIP_COMPAT_FOCUS: Record<RelationshipType, string> = {
  lover: "감정/애착 역학에 초점: 감정적으로 어떤 패턴을 만드는지, 애착 스타일이 어떻게 충돌하거나 맞물리는지.",
  friend: "대인관계 역학에 초점: 함께할 때 어떤 에너지가 만들어지는지, 누가 주도하고 누가 따르는지.",
  colleague: "업무 스타일 역학에 초점: 역할 분배, 갈등 포인트, 시너지.",
  family: "기운 균형에 초점: 가족 내 두 사람의 기운 상호작용, 보완과 충돌.",
  other: "두 사주가 만났을 때 생기는 역학 관계.",
};

/* ── 보너스 시나리오 선택 ── */

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  lover: "연인", friend: "친구", colleague: "직장동료", family: "가족", other: "지인",
};

const RELATIONSHIP_LABEL_SUFFIX: Record<RelationshipType, string> = {
  lover: "연인이었다면", friend: "친구였다면", colleague: "직장동료였다면",
  family: "가족이었다면", other: "지인이었다면",
};

const BONUS_PRIORITY: RelationshipType[] = ["lover", "friend", "colleague", "family", "other"];

function selectBonusScenarios(mainType: RelationshipType): { type: RelationshipType; label: string }[] {
  return BONUS_PRIORITY
    .filter((t) => t !== mainType)
    .slice(0, 2)
    .map((t) => ({ type: t, label: RELATIONSHIP_LABEL_SUFFIX[t] }));
}

/* ── 시스템 프롬프트 ── */

export const BATTLE_SYSTEM_PROMPT = `너는 "두루미"라는 이름의 냉정한 사주 심판관이다.
두 사람의 사주를 비교 판정하는 것이 네 역할이다.
위로 따위 없다. 사주가 보여주는 구조를 있는 그대로 까발린다.

────────────────────────────────
[톤 규칙 — 절대 준수]
- 반말 사용. 존댓말·문어체 절대 금지.
  ▸ 금지 어미 (존댓말): ~입니다, ~습니다, ~됩니다, ~합니다, ~해요, ~돼요, ~있어요, ~거예요, ~세요, ~시죠
  ▸ 금지 어미 (문어체): ~한다, ~된다, ~이다, ~것이다, ~부른다, ~있다, ~없다, ~않는다, ~인 셈이다, ~뿐이다
  ▸ "~다."로 끝나는 모든 서술문 금지 (예외 없음). 마침표 앞 글자가 "다"면 규칙 위반.
  ▸ 허용 어미 (이것만 사용): ~야, ~해, ~지, ~거야, ~인 거야, ~셈이야, ~뿐이야, ~잖아, ~는데, ~더라, ~일 뿐이야, ~인 셈이지
- 위로 금지: "잘 될 거야", "좋은 관계를 유지할 수 있어", "괜찮아", "가능성이 있어" 금지.
- 조언 금지: "~해야 해", "~맞춰줘야", "~인정해야", "~해주면 좋겠어" 금지. 판정만 하고 처방은 하지 마.
- 격려 금지: "화이팅", "노력하면", "잘 조절하면", "서로 배려하면" 금지.
- 희망적 마무리 금지. 모든 문단을 팩트로 끝내라.
- 추측 표현 전역 금지 — 모든 섹션(detail, analysis, reasoning, relationship 등)에서:
  ▸ "가능성이 높아/커/있어" → "~야" 단정으로 교체
  ▸ "~할 수 있어" → "~해" 단정으로 교체
  ▸ "~할 것 같아" → "~거야" 단정으로 교체
  ▸ "~하는 경향이 있어" → "~해" 단정으로 교체
  ▸ "~할 수도 있어" → 삭제하거나 단정으로
  ▸ 심판관은 추측하지 않아. 판정만 해. 모든 문장을 단정형으로 끝내.
- 패자 위로 금지. 승자 축하 금지. 승자에게도 약점을 반드시 짚어라.
- 2인칭 호칭 금지: "~씨", "너" 대신 이름으로 호칭.
- 이름 규칙: 두 사람의 이름은 반드시 프롬프트에 제공된 nameA, nameB 값을 글자 그대로 사용.
  ▸ 이름의 마지막 글자를 변형하지 마 (예: "하윤"→"하냐"/"하잖" 금지). 한 글자라도 다르면 규칙 위반.
  ▸ 이름을 줄여 부르거나 별명을 만들지 마.
  ▸ 이름 외의 호칭("씨", "님", "선수", "대표") 붙이지 마.
- "궁합" 단어 금지 → "상성"만 사용.
- "~해봐" 금지 → "~안 하면 ~된다".
- "스스로" 단어 자체를 절대 사용하지 마. 대체 표현: "본인이", "자기가", "자기 힘으로", "혼자서". 문맥에 맞는 표현을 골라라.
- 이모지 사용 금지.
- 마크다운 금지(#, *, -, 코드블록, 표, 불릿, 번호 리스트 금지). 문장으로만 구성.
- 과장/단정 금지: "무조건/반드시/확실/100%/절대/영원히/정답/운명" 금지.
- 명리 용어 사용 시 즉시 번역: 겁재(남의 돈 뺏는 기운), 편관(위에서 누르는 힘).

────────────────────────────────
[비유 규칙]
- "마치 ~처럼" 패턴 2회 이상 금지.
- 같은 비유 2회 이상 사용 금지.
- 비유는 오행 관계에서 자연스럽게 나와야 해.
- 진부한 비유("댐에 구멍", "불난 집에 부채질") 피해.

────────────────────────────────
[섹션 독립성 — 반드시 준수]
- 각 섹션(categoryResults, chemistry, simulations, futureOutlook, finalVerdict)은 고유한 인사이트를 가져야 해.
- killingLine 5개가 서로 겹치면 안 돼.
- 같은 사주 요소(예: 겁재, 묘(墓), 편관 대운)를 2개 이상 killingLine의 메인 근거로 사용 금지.
- detail과 killingLine이 같은 내용 반복 금지.
- heroQuip과 finalVerdict는 절대 같은 내용이면 안 돼.
- 섹션 간 내용 복붙/반복 절대 금지.

[전역 반복 금지 — 가장 중요한 규칙]
★ 규칙 1: 하나의 사주 요소를 전체 응답에서 메인 근거로 최대 3회까지만. 4회 이상 = 절대 금지.
  - "편관/정관 혼잡" 같은 복합 표현도 1개로 취급.
★ 규칙 2: 묘(墓) 특별 제한 — ⚠️ 이 규칙 위반 시 전체 응답 재생성됨.
  - "묘(墓)", "12운성 묘", "묘지에 앉아", "묘에 앉은" 등 묘 관련 표현은 전체 응답에서 최대 2회까지만. 3회 이상 = 즉시 재생성.
  - 묘(墓)를 언급할 때 반드시 한자 병기해. '묘'만 단독 사용 금지. 항상 '묘(墓)'로 써.
  - 묘 대신 사용할 수 있는 12운성: 장생, 목욕, 관대, 건록, 제왕, 쇠, 병, 사, 절, 태, 양. 이 11가지 중에서 골라 써.
  - 작성 완료 후 직접 "묘" 글자를 세어봐. 2회 넘으면 가장 약한 언급부터 다른 12운성으로 교체해.
★ 규칙 3: "A는 X에 Y, B는 Z에 W" 같은 대구 템플릿이 3회 이상 반복되면 금지. 문장 구조를 섞어.
★ 규칙 4: 한 관계 패턴("A가 참고 B가 통제")이 전체를 지배하면 안 돼. 최소 3가지 다른 역학을 보여줘.

────────────────────────────────
[카테고리별 결과 규칙]

killingLine:
- 캡처용 한줄. 12~30자. 두 사람의 이름을 사용 (A/B 아님).
- 승자가 명확히 드러나야 함. 1점 차이라도 승자는 승자.
- 좋은 예: "민수가 번 돈, 서연이가 관리해야 살아남아"
- 나쁜 예: "재물운에서는 B가 좀 더 유리한 편이야" (밋밋, A/B 사용)
- killingLine 톤: 읽었을 때 "ㅋㅋ" 또는 "아 찔린다" 반응이 나와야 함. 무난한 서술 금지. 약간의 과장, 반전, 장난기가 있어야 해.
- 금지 패턴: "X점 차이로 이겼지만" 같은 점수 언급 금지. 점수는 UI가 보여주니까 killingLine에서 숫자를 쓰지 마.
- 금지 패턴: "이겼지만/졌지만"으로 시작하는 결과 보고 금지. killingLine은 장면이지 스코어보드가 아니야.

detail:
- 왜 이 승패가 나왔는지 사주 데이터로 설명. 3~4문장, 150~250자.
  1문장: 승자 사주 근거 (왜 강한지)
  2문장: 패자 사주 근거 (왜 약한지)
  3문장: 대운/세운 영향 (시기적 요인)
  (선택) 4문장: 역전 가능성 한 줄
- 십성/오행/대운 중 가장 관련 있는 근거 1~2개만.
- "마치 ~처럼" 비유 금지 (killingLine이 이미 비유 역할).
- 카테고리별 필수 메인 근거 (다른 요소는 보조로만):
  재물운: 재성(편재/정재) 또는 식상생재가 반드시 메인. 묘(墓)/편관은 보조만 가능.
  연애운: 관성 또는 합충 관계 또는 도화살/홍염살이 반드시 메인. 다른 카테고리의 메인 근거 재사용 금지.
  직장운: 관성(편관/정관) 또는 인성이 반드시 메인. 재물운과 같은 근거 사용 금지.
  건강운: 오행 과다/부족 또는 조후용신이 반드시 메인. 십성 기반 근거 금지.
  대인운: 비겁/식상 균형 또는 신살(역마/화개)이 반드시 메인. 다른 4개 카테고리와 메인 근거 겹침 금지.

────────────────────────────────
[상성 분석 규칙]
이 섹션은 "두 사람이 만나면 어떤 관계가 되는지"를 분석해.

- punchline: 25~60자. 관계 역학을 일상 장면 하나로 보여줘.
  규칙:
  - 누구나 겪어본 일상 장면으로 "누가 주도하고 누가 따르는지" 보여줘
  - 장면 자체가 관계 구조를 말해야 해. 추가 설명 필요 없이 바로 읽히는 장면
  - 두 사람 이름 최소 1명 포함
  - 사물 비유(리모컨, 거울, 통장, 저울 등) 금지 — 해석이 한 단계 더 필요해서 느려
  - 역할 비유는 OK (형/동생, 감독/선수 등) — 단, 바로 이해되는 것만
  ✅ "찰떡이긴 한데, 김채현이 메뉴 고르고 신건주는 '나도 그거' 하는 사이야"
  ✅ "서로 편한 건 맞는데, 신건주만 맞춰주고 있다는 걸 둘 다 몰라"
  ✅ "코드 잘 맞아서 싸울 일이 없는데, 그게 신건주가 참고 있는 거야"
  ❌ "김채현 통장 앱에 신건주 편의점 결제 내역까지 찍혀" — 본문과 단절
  ❌ "리모컨 잡고 소파에 눌러앉아" — 뜬금없음

- analysis: 6~8문장, 소제목 없이 자연스러운 문단 흐름. 아래 4가지를 순서대로 자연스럽게 연결:

  (1) 기본 케미 — 두 사람이 처음 만나면 어떤 느낌인지. 오행/일간 관계 기반.
      "둘 다 수(水) 일간이라 처음 만나면 '이 사람 나랑 비슷하다' 느낌이 바로 와"

  (2) 이 관계에서의 역학 — 선택한 관계 유형(연인/친구/동료/가족) 맥락에서 누가 주도하고 누가 따르는지.
      구체적 일상 장면 1개 필수.
      "3개월쯤 지나면 김채현은 '왜 맨날 나만 정하냐'고 짜증 내고, 신건주는 '네가 맨날 정하잖아'라고 터뜨려"

  (3) 장기전 — 1~2년 후 이 관계가 어떻게 변하는지. 대운/세운 데이터 활용.
      "김채현이 '나만 주고 있다'는 감각이 쌓이면 위기가 와"

  (4) 지뢰 — 이 관계에서 가장 위험한 포인트 1가지.
      "신건주가 속마음을 안 꺼내는 게 최대 리스크야"

  이 4가지를 소제목/번호 없이 하나의 문단으로 써. "형이 옆에서 얘기해주는" 느낌.
  분석 근거(오행, 십성, 합충)는 자연스럽게 녹여. "토 과다라서 주도적이야" 정도로.
  사주 한자 병기는 최소화 (전체에서 2~3개 이내).
  조언/처방 절대 금지. 다음 표현이 하나라도 있으면 규칙 위반:
  "~하려면", "~해야 해", "~해주고", "~해주면", "~하는 연습", "~을 존중", "~을 인정"
  → 있는 그대로의 관계 역학만 묘사. 처방 없이 끝내.

- label 필드 제거됨. emoji, title, description 생성하지 마.
- mainScenario 필드 제거됨. analysis에 통합.

bonusScenarios:
- 반드시 2개 생성 (비워두지 마). 다른 관계 유형이었다면의 분석. 각 4~5문장.
- label: "~였다면?" 형태, 5~10자. 예: "친구였다면?", "직장동료였다면?"
- punchline: 접힌 아코디언 상태에서 보이는 hook. 열어보고 싶게 만드는 한 줄. label과 내용이 겹치면 안 돼.
- ★ 양쪽 균형: 2개의 bonusScenarios 중 최소 1개는 B(乙)가 불리하거나 당하는 상황이어야 해. 2개 모두 같은 사람만 깎으면 규칙 위반.
- 조언/처방 금지. "~하면 좋겠어", "~해야 해" 쓰지 마. 상황 묘사만.

────────────────────────────────
[사주 용어 → 일상 행동 매핑 사전]

시뮬레이션 답변 작성 시 반드시 이 사전을 참고하여 사주 용어를 일상 행동으로 연결할 것.
사전에 없는 임의 매핑 금지.

십성 → 행동 패턴:
비견(比肩): 자존심 강함, 양보 안 함, 동등한 관계 추구, 본인 방식 고수
겁재(劫財): 경쟁 본능, 뺏기기 싫어함, 소유욕, 승부욕, 과감한 행동
식신(食神): 자유 추구, 느긋함, 먹는 것/즐기는 것 좋아함, 정리정돈 귀찮아함
상관(傷官): 직설적 표현, 잔소리, 불만 표출, 틀 깨려는 성향, 반항
정재(正財): 알뜰, 관리욕, 계획적, 절약, 안정 추구
편재(偏財): 큰 돈에 관심, 투자/도박 성향, 통 큰 씀씀이, 유흥
정관(正官): 규율 준수, 책임감, 간섭, 체면 중시, 안정적 직장 선호
편관(偏官): 통제, 압박감, 스트레스, 권위적, 승진욕, 조직 내 긴장
정인(正印): 보호 본능, 걱정 많음, 학습욕, 의존적 경향, 어머니 같은 면
편인(偏印): 독창성, 외로움, 편식, 변덕, 깊은 사고, 비주류 관심사

오행 과다 → 행동 경향:
목(木) 과다: 고집, 독선, 추진력 과잉, "내가 맞아" 고수, 유연성 부족
화(火) 과다: 감정 기복, 충동, 열정 과잉, 화 잘 냄, 금방 후회
토(土) 과다: 고민 과다, 우유부단, 남 걱정, 간섭, 속으로 삭힘
금(金) 과다: 결단력, 차가움, 판단 명확, 감정 표현 부족, 칼같은 성격
수(水) 과다: 감정 억압, 불안, 눈치 많음, 속마음 안 보임, 생각 과다

신강/신약 → 관계 역학:
신강: 주도적, 본인 중심, 양보 어려움, 밀어붙이는 힘
신약: 수동적, 눈치 많음, 맞춰주다 폭발, 스트레스 누적

합/충/형 → 관계 패턴:
합: 끌림, 의존, 익숙함, 풀기 어려운 관계
충: 정면충돌, 갈등, 긴장감, 변화의 계기
형: 스트레스 누적, 내면 갈등, 돌발 상황, 배신감

────────────────────────────────
[punchline(대표한줄) 공통 톤 규칙]

모든 섹션의 punchline에 적용되는 규칙.

너의 정체:
너는 분석가가 아니라 "직설적인 친한 형"이야.
팩트를 말하되, 장난스럽게. 찔리지만 웃기게. 독설이 아니라 장난.

필수:
- 25~50자
- 구체적 일상 장면 or 구체적 시간/행동이 보이는 판정
- 두 사람 이름 최소 1명 포함
- 반말 + 단정형 ("~해", "~야", "~지", "~거야")
- 한자, 대운 정보, 사주 용어 금지. 100% 일상 언어로만.

톤 밸런스 — "찔리지만 웃기는" 선:
✅ 장난스러운 팩폭: 사실인데 표현이 재밌어서 웃김
✅ 구체적 장면: 읽으면 머릿속에 그림이 그려짐
✅ 의외의 반전: "이겼는데 축하할 건 아니야" 식
❌ 인신공격/모욕: "넌 답이 없어" 같은 건 절대 금지
❌ 비관적 단정: "평생 안 돼" "절대 못 해" 같은 극단 금지
❌ 한쪽만 깎아내리기: 양쪽 다 한 대씩 맞아야 함

좋은 예시 (다양한 패턴):
"김채현이 가계부 앱 깔아놓고 신건주 편의점 결제까지 추적해." (일상 장면 — 한쪽이 관리)
"신건주가 회식 자리에서 웃다가 화장실에서 혼자 한숨 쉬어." (내면 묘사 — 반전)
"둘이 여행 가면 신건주는 짐 싸고, 김채현은 짐 풀어." (대비 장면 — 양쪽 특성)
"지금은 김채현이 웃고 있는데, 2029년엔 신건주 차례야." (시간축 반전)
"김채현이 이겼는데 정작 더 피곤한 건 김채현이야." (승패 역설)

나쁜 예시:
"서로 보완적인 관계가 될 수 있어." (추상적, 장면 없음, 추측)
"갈등의 소지가 있는 구조야." (분석 용어, 장면 없음)
"김채현이 신건주를 통제하는 경향이 있어." (분석 요약, 재미 없음)
"재물운에서는 B가 좀 더 유리한 편이야." (밋밋, A/B 사용, 장면 없음)

금지 표현:
"~하는 구조야", "~경향이 있어", "~패턴이야" (분석 용어)
"~할 가능성이 있어/높아/크지만" (추측)
"~할 수 있어" (가능성)
"유통기한", "역학", "메커니즘", "시너지" (딱딱한 단어)

────────────────────────────────
[시뮬레이션 규칙]

서버가 선택한 question을 그대로 복사하고, punchline과 reasoning을 작성.
- 각 질문의 "판정"은 서버가 결정한 결과야. 너는 "왜 그런지"만 설명해. 판정을 뒤집거나 무시하면 안 돼.

punchline (결론 한 줄):
- 25~50자
- 구체적 일상 장면으로 결론을 보여줘. 추상적 서술 금지.
- "~할 가능성이 있어" 같은 추측 표현 금지 → "~해" 단정
- 두 사람 이름을 반드시 사용
- 좋은 예:
  "김채현이 3일 참다가 4일째 대청소 시작하면서 전쟁 선포해."
  "김채현이 통장 앱 깔아서 매일 확인하는 동안, 신건주는 용돈제 당해."
- 나쁜 예:
  "김채현이 주도권을 잡는 구조가 되어." (추상적, 장면 없음)
  "둘 다 본심을 터뜨릴 수 있어." (추측, 구체성 없음)
- 한자, 대운 정보, 사주 용어를 punchline에 넣지 마. punchline은 100% 일상 언어로만. 사주 근거는 reasoning에서만.

reasoning (근거 3~4문장):
- 150~250자
- 반드시 위 '사주 용어 → 일상 행동 매핑 사전'을 참고하여 연결
- 구조:
  1문장: A의 사주 근거 → 행동 패턴 (사전 매핑 활용)
  2문장: B의 사주 근거 → 행동 패턴 (사전 매핑 활용)
  3문장: 둘이 부딪히면 벌어지는 구체적 상황
  4문장: (선택) 시간이 지나면 / 반전 / 의외의 결과
- 사전에 없는 임의 매핑 금지 (예: "토 과다 → 깔끔함" 금지)
- "~해 보이지만" "~할 수 있어" 추측 표현 금지 → 단정형 사용
- 교과서 해설 톤 금지. 심판이 판정하는 톤으로.
  나쁜 예: "신건주는 일주 癸未(계미)에 묘(墓)가 있고, 현재 대운 己卯(기묘)는 편관 운이야."
  좋은 예: "신건주는 묘(墓)에 앉은 일주라 감정을 속으로 삭이다가 한 번에 터뜨려. 편관 대운이 압박을 더하니까 폭발 주기가 짧아져."

basis:
- 사주 키워드만, 20자 이내. 예: "수 과다 + 식신", "겁재 + 정재"

★ 핵심 규칙: 5개 시뮬레이션 전체에서 같은 사주 요소(예: 묘(墓), 편관 대운, 인신충(寅申沖), 재성 발달)를 메인 근거로 최대 2회까지만 사용. 3회 이상 반복되면 규칙 위반 — 반드시 다른 요소(신살, 합충형, 12운성, 오행 과다 등)로 교체.
★ 5개 시뮬레이션의 reasoning 마지막 문장 어미가 전부 같으면 안 돼. ~거야, ~지, ~해, ~야 등 최소 3종류 이상 섞어 써.
★ 양쪽 균형: 5개 시뮬레이션 전체에서 A가 당하는(불리한) 결론과 B가 당하는 결론이 최소 2:3 또는 3:2 비율이어야 해. 4:1 이상 편향은 절대 금지. 점수에서 진 쪽이라도 시뮬레이션에서는 이기는 장면이 있어야 해.

────────────────────────────────
[미래 예측 규칙]
배틀의 미래 예측은 "각자 운세"가 아니야. 두 사람의 이벤트가 관계에 어떤 영향을 주는지가 핵심이야.

- punchline: 1년→3년→5년을 관통하는 시간 반전 한 줄. 구체적 연도 포함. 25~50자.
  ✅ 좋은 예: "2026년 김채현이 앞서가지만, 2030년엔 신건주가 뒤집어"
  ❌ 나쁜 예: "시간이 지나면 상황이 바뀔 거야"

- timeline: 3개 시점 (1년 후 / 3년 후 / 5년 후). 각 시점마다:
  - eventA: A에게 일어날 구체적 생활 이벤트 1문장.
    ✅ "이직 성공해서 연봉 점프"
    ❌ "재물운이 상승해" (추상적)
  - eventB: B에게 일어날 구체적 생활 이벤트 1문장.
  - relationship: 이 두 이벤트가 관계에 미치는 영향. 1~2문장.
    ✅ "김채현의 이직이 신건주에게 위기감을 줘서 갈등이 심화돼"
    ❌ "두 사람의 관계가 변화할 거야"
  - mood: 관계가 좋아지면 "up", 나빠지면 "down", 큰 변화 없으면 "neutral"

- 생활 이벤트 예시: 이직, 승진, 이사, 결혼 압박, 건강 악화, 재테크 성공, 번아웃, 독립, 해외 기회
- 대운/세운 데이터를 근거로 하되, "편관운" 같은 용어 대신 "직장에서 압박이 커져" 같은 일상 언어로.
- 3개 시점이 하나의 서사 흐름을 만들어야 해. 1년 후의 사건이 3년 후에 영향을 주고, 5년 후에 결론이 나는 구조.
- 희망/위로 금지. 냉정하게.
- 최소 1개 시점은 mood: "up", 최소 1개는 mood: "down"이어야 해 (전부 같은 방향 금지).
- eventA/eventB/relationship에서 간지(甲乙丙丁戊己庚辛壬癸/子丑寅卯辰巳午未申酉戌亥), 한자 병기, "~운(X)" 표현 금지. 일상 언어만.
  ❌ "정인운(乙卯)으로 심리적 안정 찾아"
  ✅ "멘토를 만나면서 커리어 방향이 잡혀"
  ❌ "편재운(己酉)으로 투자 성공"
  ✅ "부동산 투자로 목돈 만들어"
- 동사는 구체적 행동/사건: 이직, 승진, 이사, 투자, 휴직, 결혼 압박, 번아웃, 전직, 해외 파견, 독립, 창업

────────────────────────────────
[최종 심판 규칙]
- punchline: 전체 배틀의 최종 한 줄 판정. 승자를 축하하지 말고, 승패의 의미를 비틀어. "이겼는데 ~" 반전 구조 권장.
- verdict: 2~3문장. 승패 요약 + 핵심 원인 + 역설 (이기고도 편하지 않은 등)
- 새로운 인사이트 1개 필수 (다른 섹션에서 안 나온 것)
- heroQuip과 절대 겹치지 않게.
- 조언/격려 금지. "~노력이 필요해", "~하면 좋겠어", "~해야 해" 금지. 판정만. 냉정하게 끝내.

────────────────────────────────
[heroQuip 규칙]
- 배틀 결과 카드 최상단에 가장 크게 표시되는 한 줄. 캡처/공유 대상.
- 승자 이름으로 시작. 승자가 "뭘 해냈는지"를 간결하게.
- 톤: 친구한테 결과 자랑하는 느낌. 간결한데 반전 or 여유가 있어야 해.
- 15~30자

재미 패턴 (반드시 하나 이상 사용):
  ✅ 여유/인심: "임하늘이 4판 먹고 1판은 인심으로 줬어"
  ✅ 과장 한 방: "한소희 올킬, 이건 대결이 아니라 수업이었어"
  ✅ 간결 감탄: "김채연, 돈복 하나로 끝판 뒤집었어"
  ✅ 찐 인정 (무승부): "사주도 이 둘은 못 가려, 찐 라이벌이야"

금지 패턴:
  ❌ 팩트 나열: "재물운에서 갈렸네", "재물운, 건강운에서 갈렸네"
  ❌ 뉴스 자막: "4판을 가져갔어", "3개 카테고리에서 승리"
  ❌ 패자 깎기: "이긴 카테고리가 하나도 없어", "완전히 밀렸어"
  ❌ "갈렸네/갈렸어" 표현 금지

승패 강도별 톤 가이드:
- 신승(3:2): 역전/한끗 차이 강조. "돈복 하나로 뒤집었어", "마지막에 뒤집었어"
- 압승(4:1): 승자의 여유. "4판 먹고 1판은 줬어", "이 정도면 접수야"
- 완전압살(5:0): 과장+유머. "대결이 아니라 수업", "혼자 다 해먹었어"
- 무승부: 사주/운이 주어. "사주도 못 가려", "운도 결판을 못 내"

반드시 이긴 카테고리 이름을 1개 이상 자연스럽게 포함해 (재물운, 연애운, 직장운, 건강운, 대인운).

────────────────────────────────
[한자 표기 규칙]
- 천간/지지/충/합 언급 시 반드시 한자 병기: "甲己합(갑기합)", "편관(偏官)"

────────────────────────────────
[★ 최종 확인 — 이 규칙을 반드시 지켜]

■ 표현 반복 금지 (가장 중요)
- 같은 표현을 전체 결과에서 최대 2회까지만 사용
- 특히 아래 패턴이 3회 이상 나오면 실패:
  · "묘(墓)에 앉아/앉은/지에 앉아" — 전체에서 최대 2회
  · "토 과다와 정관, 편관이 ~을 제압/압도/누르는 구조" — 최대 1회
  · 동일한 비유/은유 — 최대 1회
  · "~하는 구조야/~인 구조야/~는 구조야" — 최대 1회. 2회 이상 금지. "구조" 단어 자체를 최소화해.
- punchline/killingLine끼리 같은 표현 금지
- 시뮬레이션 reasoning끼리 같은 문장 복붙 금지

■ 카테고리 detail 다양성
- 5개 카테고리의 detail이 동일한 문장 구조를 쓰면 안 됨
- 매 카테고리마다 다른 시작 패턴, 다른 분석 각도, 다른 근거
- ❌ 전부 "김채연의 X가 신건주의 Y를 압도/제압하는 구조야" 패턴
- ✅ 재물: 세운 기반, 연애: 합충 기반, 직장: 십성 기반, 건강: 오행 기반, 대인: 신살 기반

■ 시뮬레이션 섹션 독립성
- 각 시뮬레이션의 reasoning은 해당 질문에 고유한 내용이어야 함
- 다른 시뮬레이션의 reasoning을 복붙하면 안 됨
- 특히 마지막 문장이 다른 시뮬레이션과 같으면 안 됨
- ❌ "이별 후" reasoning에 "술기운과 만나 폭발하는 모습이야" (술 시뮬레이션 복붙)

■ 사주학 근거 정확성
- 형(刑), 충(沖) 언급 시 반드시 양쪽 원국 지지에서 성립하는지 확인
- 원국에 없는 글자로 형/충을 만들지 마 (예: 인(寅)이 없는데 인신충 언급 금지)
- 세운 연도와 십성 정확히 매칭 (2026=정재, 2027=편재 등)

■ 톤 통일 — ⚠️ 가장 빈번한 위반 항목
- 모든 문장을 반말로. 마지막 글자가 "다"인 서술문이 하나라도 있으면 실패.
- 금지 어미 재확인: ~한다, ~된다, ~이다, ~것이다, ~부른다, ~있다, ~없다, ~뿐이다, ~셈이다, ~않는다
- 허용 어미 재확인: ~야, ~해, ~지, ~거야, ~잖아, ~는데, ~더라, ~뿐이야, ~셈이야, ~셈이지
- 작성 후 모든 마침표(.) 앞 글자를 확인해. "다"로 끝나면 허용 어미로 교체해.

■ 기존 필수 규칙
1. 묘(墓) — 전체 응답에서 2회 초과면 다른 12운성으로 교체
2. 하나의 사주 요소가 메인 근거로 4회 이상 등장하면 교체
3. killingLine에 점수 숫자 금지
4. punchline/killingLine은 구체적 일상 장면 ("구조"/"경향"/"패턴"/"가능성" 금지)
5. 조언/처방 표현 금지
6. "스스로" 금지 (본인이/자기가/혼자서)
7. "~해봐" 금지, "궁합" 금지, 존댓말 금지
8. heroQuip은 승자 이름으로 시작 (무승부 제외)
9. chemistry에 label/mainScenario 필드 생성 금지
10. simulations[].question은 서버값 그대로 복사
11. killingLine 5개가 서로 다른 메인 근거 사용
12. bonusScenarios 2개 중 같은 사람만 깎으면 1개 반대로
13. simulations 5개에서 A만 당하는 결론 4개 이상이면 최소 1개를 B로

[★ 생성 전 셀프체크 — JSON 작성 직전에 반드시 확인]
아래 체크리스트를 하나라도 위반하면 해당 부분을 즉시 수정한 후 JSON을 출력해:
□ "다."로 끝나는 문장이 0개인가? (하나라도 있으면 허용 어미로 교체)
□ "묘" 글자가 전체에서 2회 이하인가? (넘으면 다른 12운성으로 교체)
□ "구조야"가 1회 이하인가?
□ "가능성"/"~할 수 있어"/"~것 같아" 가 0개인가?
□ nameA, nameB 이름 철자가 정확한가? (한 글자도 변형 없이)
□ 5개 killingLine이 서로 다른 내용인가?
□ 모든 punchline이 구체적 일상 장면인가? ("경향"/"패턴" 없는가?)

────────────────────────────────
## 출력 JSON 스키마
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만.
{
  "heroQuip": "15~30자, 승자 이름으로 시작, 이긴 카테고리 1개 이상 포함",
  "categoryResults": {
    "wealth": { "killingLine": "12~30자, 이름 사용", "detail": "150~250자, 사주 근거 3~4문장" },
    "love": { "killingLine": "...", "detail": "..." },
    "career": { "killingLine": "...", "detail": "..." },
    "health": { "killingLine": "...", "detail": "..." },
    "social": { "killingLine": "...", "detail": "..." }
  },
  "chemistry": {
    "punchline": "25~60자, 일상 장면으로 관계 역학",
    "analysis": "6~8문장, 소제목 없는 자연스러운 문단",
    "bonusScenarios": [
      { "type": "관계유형", "label": "~였다면?", "punchline": "25~50자 hook", "analysis": "4~5문장" },
      { "type": "관계유형", "label": "~였다면?", "punchline": "25~50자 hook", "analysis": "4~5문장" }
    ]
  },
  "simulations": [
    { "question": "서버가 준 질문 그대로", "punchline": "25~50자 구체적 장면", "reasoning": "150~250자 근거 3~4문장", "basis": "20자 이내 키워드" }
  ],
  "futureOutlook": {
    "punchline": "25~50자, 시간 반전 한 줄",
    "timeline": [
      { "year": 2026, "label": "1년 후", "eventA": "A 생활 이벤트 1문장", "eventB": "B 생활 이벤트 1문장", "relationship": "관계 영향 1~2문장", "mood": "up | down | neutral" },
      { "year": 2028, "label": "3년 후", "eventA": "...", "eventB": "...", "relationship": "...", "mood": "..." },
      { "year": 2030, "label": "5년 후", "eventA": "...", "eventB": "...", "relationship": "...", "mood": "..." }
    ]
  },
  "finalVerdict": {
    "punchline": "25~50자, 최종 판정 한 줄",
    "verdict": "2~3문장"
  }
}`;

/* ── LLM 입력 빌더 ── */

export function buildBattleUserInfo(opts: {
  nameA: string;
  nameB: string;
  scoresA: ServerScores;
  scoresB: ServerScores;
  tierA: TierResult;
  tierB: TierResult;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
  sajuTextA?: string | null;
  sajuTextB?: string | null;
  interaction?: BattleInteraction;
  fortuneBlockA?: string;
  fortuneBlockB?: string;
  simulationQuestions?: SelectedSimulation[];
}): string {
  const {
    nameA, nameB,
    scoresA, scoresB,
    tierA, tierB,
    comparison,
    relationshipType,
    sajuTextA, sajuTextB,
    interaction,
    fortuneBlockA, fortuneBlockB,
    simulationQuestions,
  } = opts;

  const fmtScores = (scores: ServerScores) =>
    `재물운: ${scores.재물운}(${scoreToGrade(scores.재물운)}) / 연애운: ${scores.연애운}(${scoreToGrade(scores.연애운)}) / 직장운: ${scores.직장운}(${scoreToGrade(scores.직장운)}) / 건강운: ${scores.건강운}(${scoreToGrade(scores.건강운)}) / 대인운: ${scores.대인운}(${scoreToGrade(scores.대인운)})`;

  const matchLines = comparison.matches.map((m) => {
    const winnerLabel = m.winner === "A" ? nameA : m.winner === "B" ? nameB : "무승부";
    return `${m.category}: ${nameA} ${m.scoreA} vs ${nameB} ${m.scoreB} → ${winnerLabel} (${m.intensity}, 차이 ${m.diff})`;
  });

  const overallLabel = comparison.overallWinner === "A" ? nameA
    : comparison.overallWinner === "B" ? nameB
    : "무승부";

  const tone = RELATIONSHIP_TONE[relationshipType];
  const compatFocus = RELATIONSHIP_COMPAT_FOCUS[relationshipType];
  const bonusScenarios = selectBonusScenarios(relationshipType);

  // 결정타: 전체 승자가 이긴 카테고리 중 점수차 최대
  const highlight = comparison.overallWinner === "draw"
    ? undefined
    : [...comparison.matches]
        .filter((m) => m.winner === comparison.overallWinner)
        .sort((a, b) => b.diff - a.diff)[0];
  const highlightInstruction = highlight
    ? `\n[결정타 카테고리]\n"${highlight.category}"가 점수차(${highlight.diff}점)가 가장 큰 결정적 항목이다. killingLine에서 이 카테고리를 특히 날카롭게 작성하라.`
    : "";

  // Interaction block
  let interactionBlock = "";
  if (interaction) {
    const lines: string[] = ["\n[두 사주 상호작용 분석]"];
    lines.push(`일간 관계: ${interaction.dayStemRelation.type} — ${interaction.dayStemRelation.detail}`);
    lines.push(`용신 상보성: ${interaction.yongshinCompat.summary}`);
    if (interaction.yongshinCompat.aHelpsB) lines.push(`  - ${nameA}의 강한 오행이 ${nameB}의 용신을 보강`);
    if (interaction.yongshinCompat.bHelpsA) lines.push(`  - ${nameB}의 강한 오행이 ${nameA}의 용신을 보강`);
    if (interaction.yongshinCompat.aHurtsB) lines.push(`  - ${nameA}의 강한 오행이 ${nameB}의 기신을 자극`);
    if (interaction.yongshinCompat.bHurtsA) lines.push(`  - ${nameB}의 강한 오행이 ${nameA}의 기신을 자극`);
    lines.push(`오행 상보율: ${interaction.elementCoverage.percent}% (5행 중 ${Math.round(interaction.elementCoverage.percent / 20)}개 충족)`);
    if (interaction.elementCoverage.coveredByOther.a.length > 0) {
      lines.push(`  - ${nameA}에게 부족한 [${interaction.elementCoverage.coveredByOther.a.join(",")}]을 ${nameB}가 채워줌`);
    }
    if (interaction.elementCoverage.coveredByOther.b.length > 0) {
      lines.push(`  - ${nameB}에게 부족한 [${interaction.elementCoverage.coveredByOther.b.join(",")}]을 ${nameA}가 채워줌`);
    }
    if (interaction.fortuneSync) {
      lines.push(`대운 동기화: ${interaction.fortuneSync.synced ? "동기화됨" : "비동기"}`);
      lines.push(`  - ${nameA} 현재 대운: ${interaction.fortuneSync.currentDaeunA}`);
      lines.push(`  - ${nameB} 현재 대운: ${interaction.fortuneSync.currentDaeunB}`);
      lines.push(`  - ${interaction.fortuneSync.summary}`);
    }
    interactionBlock = lines.join("\n");
  }

  // Chemistry label removed — no longer sent to LLM

  // Simulation questions block — subject 판정 포함
  let simulationBlock = "";
  if (simulationQuestions && simulationQuestions.length > 0) {
    const simLines = simulationQuestions.map((sq, i) => {
      const subjectName = sq.subject === "A" ? nameA : nameB;
      return `${i + 1}. ${sq.icon} ${sq.question} → 판정: ${subjectName}가 ${sq.subjectLabel}`;
    });
    simulationBlock = `
[시뮬레이션 질문 — 서버 선택 + 주어 판정]
${simLines.join("\n")}
★ 위 판정은 서버의 사주 분석 결과야. 절대 뒤집지 마. punchline과 reasoning 모두 이 판정을 전제로 작성해.
→ 각 질문에 대해 punchline(결론 장면 1줄)과 reasoning(근거 3~4문장)을 생성. question 필드에 질문 그대로 복사.`;
  }

  // Bonus scenario instruction
  const bonusInstruction = bonusScenarios.map((b, i) =>
    `${i + 1}. type: "${b.type}", label: "${b.label}" — 4~5문장`
  ).join("\n");

  return `
[甲] ${nameA}
종합: ${tierA.grade}등급 (composite: ${tierA.composite}, 상위 ${tierA.topPercent}%)
${fmtScores(scoresA)}
${sajuTextA ? `사주: ${sajuTextA}` : ""}
${fortuneBlockA || ""}

[乙] ${nameB}
종합: ${tierB.grade}등급 (composite: ${tierB.composite}, 상위 ${tierB.topPercent}%)
${fmtScores(scoresB)}
${sajuTextB ? `사주: ${sajuTextB}` : ""}
${fortuneBlockB || ""}
${interactionBlock}

[카테고리별 대결 결과 (서버 확정)]
${matchLines.join("\n")}

[종합 판정 (서버 확정)]
${nameA} ${comparison.winsA}승 / ${nameB} ${comparison.winsB}승 / 무승부 ${comparison.draws}
최종 승자: ${overallLabel} (${comparison.overallIntensity})
${highlightInstruction}
${simulationBlock}

[미래 예측 연도 기준]
현재: ${new Date().getFullYear()}년
1년 후: ${new Date().getFullYear() + 1}년
3년 후: ${new Date().getFullYear() + 3}년
5년 후: ${new Date().getFullYear() + 5}년

[메인 관계 유형: ${RELATIONSHIP_LABELS[relationshipType]}]
${tone}

[상성 진단 초점]
${compatFocus}

[보너스 시나리오]
다음 관계에 대해서도 짧은 시나리오를 작성해:
${bonusInstruction}

위 서버 확정 결과를 바탕으로 배틀 판정 텍스트를 JSON으로 생성하라.
`.trim();
}

/* ── LLM 분석 실행 ── */

type BattleAnalysisOpts = {
  nameA: string;
  nameB: string;
  scoresA: ServerScores;
  scoresB: ServerScores;
  tierA: TierResult;
  tierB: TierResult;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
  sajuTextA?: string | null;
  sajuTextB?: string | null;
  interaction?: BattleInteraction;
  fortuneBlockA?: string;
  fortuneBlockB?: string;
  simulationQuestions?: SelectedSimulation[];
};

export async function runBattleAnalysis(opts: BattleAnalysisOpts): Promise<BattleLlmAnalysis> {
  return runBattleAnalysisInner(opts, false);
}

async function runBattleAnalysisInner(opts: BattleAnalysisOpts, isRetry: boolean): Promise<BattleLlmAnalysis> {
  const userInfo = buildBattleUserInfo(opts);

  // 재시도 시 경고 문구 추가
  const finalUserInfo = isRetry
    ? userInfo + "\n\n[⚠️ 재생성 주의] 이전 응답이 품질 기준 미달이었어. 특히: 묘(墓) 관련 표현을 전체 응답에서 2회 이내로 제한해. 시뮬레이션에서 한쪽만 당하지 않게 균형 맞춰. 이 규칙을 어기면 또 재생성해야 하니까 반드시 지켜."
    : userInfo;

  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;

  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, finalUserInfo, BATTLE_SYSTEM_PROMPT, { temperature: 0.65 });
    if (res.ok) {
      try {
        const raw = parseJson5Loose<any>(res.text);
        // DEBUG: Gemini raw futureOutlook 형식 확인
        if (raw?.futureOutlook) {
          const fo = raw.futureOutlook;
          const format = Array.isArray(fo.timeline) ? `timeline[${fo.timeline.length}]` : fo.nextYear ? "legacy(nextYear/threeYears)" : "unknown";
          console.info("[BATTLE_LLM_RAW] futureOutlook format:", format, JSON.stringify(fo).slice(0, 500));
        }
        const validated = validateAndNormalize(raw, opts.relationshipType, opts.simulationQuestions);

        // Subject verification 파라미터 구성
        const subjectVerification: SubjectVerification | undefined =
          opts.simulationQuestions && opts.simulationQuestions.length > 0
            ? {
                nameA: opts.nameA,
                nameB: opts.nameB,
                expectedSubjects: opts.simulationQuestions.map((sq) => sq.subject),
              }
            : undefined;

        const { result: postprocessed, warnings, shouldRetry, myoExcessTargets } = postprocessBattleResult(
          validated,
          subjectVerification,
          { nameA: opts.nameA, nameB: opts.nameB },
        );

        if (shouldRetry && !isRetry) {
          console.warn("[BATTLE_LLM] 품질 기준 미달 — 1회 재시도");
          return runBattleAnalysisInner(opts, true);
        }

        // Surgical rewrite: 반복 감지 → 해당 필드만 리라이트
        const rewritten = await surgicalRewriteBattle(postprocessed, warnings, {
          nameA: opts.nameA,
          nameB: opts.nameB,
          relationshipType: opts.relationshipType,
        }, myoExcessTargets);

        if (warnings.length > 0) {
          for (const w of warnings) {
            console.warn(`[배틀 후처리] ${w}`);
          }
        }

        return rewritten;
      } catch (parseErr) {
        console.warn("[BATTLE_LLM] 응답 파싱 실패:", model, parseErr);
        lastError = { message: "LLM 응답 파싱 실패" };
        continue;
      }
    }
    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) break;
  }

  return buildFallback(opts);
}

/* ── 파싱 검증 & 정규화 ── */

function validateAndNormalize(
  raw: any,
  relationshipType: RelationshipType,
  simulationQuestions?: SelectedSimulation[],
): BattleLlmAnalysis {
  // categoryResults
  const cr = raw.categoryResults;
  const categoryResults: BattleLlmAnalysis["categoryResults"] = {
    wealth: { killingLine: "", detail: "" },
    love: { killingLine: "", detail: "" },
    career: { killingLine: "", detail: "" },
    health: { killingLine: "", detail: "" },
    social: { killingLine: "", detail: "" },
  };

  if (cr && typeof cr === "object" && !Array.isArray(cr)) {
    for (const key of ["wealth", "love", "career", "health", "social"] as const) {
      if (cr[key]) {
        categoryResults[key] = {
          killingLine: cr[key].killingLine || "",
          detail: cr[key].detail || "",
        };
      }
    }
  }

  // chemistry — new schema (label/mainScenario removed)
  const chem = raw.chemistry;
  const chemistry: BattleLlmAnalysis["chemistry"] = {
    punchline: "",
    analysis: "",
    bonusScenarios: [],
  };

  if (chem && typeof chem === "object") {
    chemistry.punchline = chem.punchline || "";
    chemistry.analysis = chem.analysis || "";

    // 레거시 호환: mainScenario.analysis가 있으면 analysis에 합침
    if (chem.mainScenario?.analysis && !chemistry.analysis.includes(chem.mainScenario.analysis)) {
      chemistry.analysis = chemistry.analysis
        ? chemistry.analysis + " " + chem.mainScenario.analysis
        : chem.mainScenario.analysis;
    }

    // 레거시 호환: loveAnalysis가 있으면 analysis에 합침
    if (chem.loveAnalysis && !chemistry.analysis.includes(chem.loveAnalysis)) {
      chemistry.analysis = chemistry.analysis
        ? chemistry.analysis + " " + chem.loveAnalysis
        : chem.loveAnalysis;
    }

    if (Array.isArray(chem.bonusScenarios)) {
      chemistry.bonusScenarios = chem.bonusScenarios.map((s: any) => {
        // punchline fallback: analysis 첫 문장
        let punchline = s?.punchline || "";
        if (!punchline && s?.analysis) {
          const dotIdx = s.analysis.indexOf(".");
          if (dotIdx > 0) punchline = s.analysis.slice(0, dotIdx + 1).trim();
        }
        return {
          type: s?.type || "",
          label: s?.label || "",
          punchline,
          analysis: s?.analysis || "",
        };
      });
    }

    console.info("[BATTLE_BONUS_SCENARIOS]", {
      rawType: chem.bonusScenarios === undefined ? "undefined"
        : chem.bonusScenarios === null ? "null"
        : Array.isArray(chem.bonusScenarios) ? `array[${chem.bonusScenarios.length}]`
        : typeof chem.bonusScenarios,
      rawData: JSON.stringify(chem.bonusScenarios)?.slice(0, 500),
      parsedCount: chemistry.bonusScenarios.length,
      parsedAnalysisLengths: chemistry.bonusScenarios.map((s: { analysis: string }) => s.analysis.length),
    });

    if (chemistry.bonusScenarios.length === 0) {
      console.warn("[BATTLE_BONUS_MISSING] bonusScenarios가 빈 배열. LLM이 생성하지 않음.");
    }
  }

  // simulations — force server questions, punchline/reasoning with answer fallback
  let simulations: BattleLlmAnalysis["simulations"] = [];
  if (Array.isArray(raw.simulations)) {
    simulations = raw.simulations.map((s: any, i: number) => {
      let punchline = s?.punchline || "";
      let reasoning = s?.reasoning || "";

      // Fallback: answer 필드만 있으면 첫 문장을 punchline, 나머지를 reasoning으로 분리
      if (!punchline && !reasoning && s?.answer) {
        const dotIdx = s.answer.indexOf(".");
        if (dotIdx > 0 && dotIdx < s.answer.length - 1) {
          punchline = s.answer.slice(0, dotIdx + 1).trim();
          reasoning = s.answer.slice(dotIdx + 1).trim();
        } else {
          punchline = s.answer;
        }
      }

      return {
        question: simulationQuestions?.[i]?.question || s?.question || "",
        punchline,
        reasoning,
        basis: s?.basis || "",
      };
    });
  }

  // Fill missing simulations with server questions
  if (simulationQuestions) {
    while (simulations.length < simulationQuestions.length) {
      const idx = simulations.length;
      simulations.push({
        question: simulationQuestions[idx].question,
        punchline: "",
        reasoning: "",
        basis: "",
      });
    }
  }

  // futureOutlook
  const fo = raw.futureOutlook;
  const currentYear = new Date().getFullYear();
  const defaultTimeline: FutureTimelineEntry[] = [
    { year: currentYear + 1, label: "1년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
    { year: currentYear + 3, label: "3년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
    { year: currentYear + 5, label: "5년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
  ];

  const futureOutlook: BattleLlmAnalysis["futureOutlook"] = {
    punchline: "",
    timeline: defaultTimeline,
  };

  if (fo && typeof fo === "object") {
    futureOutlook.punchline = fo.punchline || "";

    // 새 스키마 (timeline 배열)
    if (Array.isArray(fo.timeline) && fo.timeline.length > 0) {
      futureOutlook.timeline = fo.timeline.map((entry: any, i: number) => ({
        year: entry.year || defaultTimeline[i]?.year || currentYear + (i + 1) * 2,
        label: entry.label || defaultTimeline[i]?.label || `${(i + 1) * 2}년 후`,
        eventA: entry.eventA || "",
        eventB: entry.eventB || "",
        relationship: entry.relationship || "",
        mood: (["up", "down", "neutral"].includes(entry.mood) ? entry.mood : "neutral") as "up" | "down" | "neutral",
      })).slice(0, 3);
    }
    // 레거시 호환 (nextYear/threeYears가 있으면 변환)
    else if (fo.nextYear || fo.threeYears) {
      futureOutlook.timeline = [
        { year: currentYear + 1, label: "1년 후", eventA: fo.nextYear || "", eventB: "", relationship: "", mood: "neutral" as const },
        { year: currentYear + 3, label: "3년 후", eventA: fo.threeYears || "", eventB: "", relationship: "", mood: "neutral" as const },
        { year: currentYear + 5, label: "5년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
      ];
    }
  }

  // finalVerdict — string fallback for old data
  let finalVerdict: BattleLlmAnalysis["finalVerdict"];
  if (raw.finalVerdict && typeof raw.finalVerdict === "object") {
    finalVerdict = {
      punchline: raw.finalVerdict.punchline || "",
      verdict: raw.finalVerdict.verdict || "",
    };
  } else {
    finalVerdict = {
      punchline: "",
      verdict: typeof raw.finalVerdict === "string" ? raw.finalVerdict : "",
    };
  }

  return {
    heroQuip: raw.heroQuip || "심판의 말이 필요 없는 결과야.",
    categoryResults,
    chemistry,
    simulations,
    futureOutlook,
    finalVerdict,
  };
}

/* ── Fallback (LLM 실패 시) ── */

function buildFallback(opts: {
  nameA: string;
  nameB: string;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
  simulationQuestions?: SelectedSimulation[];
}): BattleLlmAnalysis {
  const winner = opts.comparison.overallWinner === "A" ? opts.nameA
    : opts.comparison.overallWinner === "B" ? opts.nameB
    : null;

  const emptyCat = { killingLine: "", detail: "" };

  return {
    heroQuip: "심판의 말이 필요 없는 결과야.",
    categoryResults: {
      wealth: emptyCat, love: emptyCat, career: emptyCat, health: emptyCat, social: emptyCat,
    },
    chemistry: {
      punchline: "",
      analysis: "",
      bonusScenarios: [],
    },
    simulations: (opts.simulationQuestions || []).map((sq) => ({
      question: sq.question,
      punchline: "",
      reasoning: "",
      basis: "",
    })),
    futureOutlook: {
      punchline: "",
      timeline: [
        { year: new Date().getFullYear() + 1, label: "1년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
        { year: new Date().getFullYear() + 3, label: "3년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
        { year: new Date().getFullYear() + 5, label: "5년 후", eventA: "", eventB: "", relationship: "", mood: "neutral" as const },
      ],
    },
    finalVerdict: {
      punchline: "",
      verdict: winner
        ? `종합적으로 ${winner}의 사주가 더 강한 기운을 갖고 있어.`
        : "두 사람 다 비슷한 수준의 사주 기운이야.",
    },
  };
}
