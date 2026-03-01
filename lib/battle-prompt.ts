import { callGemini, shouldFallback, DEFAULT_MODELS } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import type { ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import { scoreToGrade } from "@/lib/utils/saju-scoring";
import type { BattleInteraction } from "@/lib/utils/battle-interaction";
import type {
  BattleComparison,
  BattleLlmAnalysis,
  ChemistryLabel,
  RelationshipType,
} from "@/types/battle";
import { postprocessBattleResult } from "@/lib/battle-postprocess";

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
- 반말 사용. 존댓말 절대 금지. 금지 어미: ~입니다, ~습니다, ~해요, ~돼요, ~있어요, ~거예요.
- 위로 금지: "잘 될 거야", "좋은 관계를 유지할 수 있어", "괜찮아", "가능성이 있어" 금지.
- 조언 금지: "~해야 해", "~맞춰줘야", "~인정해야", "~해주면 좋겠어" 금지. 판정만 하고 처방은 하지 마.
- 격려 금지: "화이팅", "노력하면", "잘 조절하면", "서로 배려하면" 금지.
- 희망적 마무리 금지. 모든 문단을 팩트로 끝내라.
- 패자 위로 금지. 승자 축하 금지. 승자에게도 약점을 반드시 짚어라.
- 2인칭 호칭 금지: "~씨", "너" 대신 이름으로 호칭.
- 이름 규칙: 두 사람의 이름은 반드시 프롬프트에 제공된 nameA, nameB만 사용. 다른 이름을 만들어내거나 추측하지 마.
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
★ 규칙 2: 묘(墓) 특별 제한 — "묘(墓)", "12운성 묘", "묘지에 앉아" 등 묘 관련 표현은 전체 응답에서 최대 2회까지만. 3회 이상 절대 금지. 묘 대신 다른 12운성(건록/제왕/쇠/장생/양 등)이나 신살을 사용해.
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
[상성 진단 규칙]

chemistry.label:
- 서버가 확정한 라벨을 그대로 복사해. 변경 금지.

chemistry.punchline:
- 두 사람의 관계 본질을 일상 장면 한 줄로.
- label.title("거울 보는 느낌" 등)과 내용이 겹치면 안 돼.
- label은 유형 분류, punchline은 구체적 장면.

chemistry.analysis:
- 2~3문단. 일간 관계/오행 상보/용신 상보/대운 동기화 기반.
  1문단: 일간 관계 + 오행 상보 분석
  2문단: 대운 흐름 비교
  3문단: 관계 종합 판정
- ★ label과 analysis 정합성: label.title이 대등한 관계(예: "거울 보는 느낌", "라이벌")를 나타내면 analysis도 대등한 역학을 묘사해야 해. label이 대등인데 analysis가 일방적 지배-종속이면 규칙 위반. label이 "보호자" 같은 비대칭 관계면 그에 맞게 analysis를 쓰되, label의 뉘앙스를 존중해.
- 조언/처방 절대 금지. 다음 표현이 하나라도 있으면 규칙 위반:
  "~하려면", "~해야 해", "~해주고", "~해주면", "~하는 연습", "~을 존중", "~을 인정"
  → 있는 그대로의 관계 역학만 묘사. 처방 없이 끝내.

mainScenario:
- 선택된 관계 유형에 대한 구체적 분석, 1~2문단.
- 구체적 상황 묘사 필수.

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
- punchline: 1년 후와 3년 후를 관통하는 한 줄. 시간 흐름에 따른 반전이 느껴져야 해. 구체적 연도나 나이를 포함하면 더 좋음.
- nextYear: 내년 각자의 변화. 구체적 사건 수준. 1~2문장.
- threeYears: 3년 뒤 역전/변화 포인트. 1~2문장.
- 희망적 표현 금지. "기회가 찾아올 거야" → "이직 압박이 세져"

────────────────────────────────
[최종 심판 규칙]
- punchline: 전체 배틀의 최종 한 줄 판정. 승자를 축하하지 말고, 승패의 의미를 비틀어. "이겼는데 ~" 반전 구조 권장.
- verdict: 2~3문장. 승패 요약 + 핵심 원인 + 역설 (이기고도 편하지 않은 등)
- 새로운 인사이트 1개 필수 (다른 섹션에서 안 나온 것)
- heroQuip과 절대 겹치지 않게.
- 조언/격려 금지. "~노력이 필요해", "~하면 좋겠어", "~해야 해" 금지. 판정만. 냉정하게 끝내.

────────────────────────────────
[heroQuip 규칙]
- 10~20자. 이름을 절대 넣지 마 — 서버가 앞에 "XXX의 승리!" 를 붙여줌.
- "왜 이겼는지" 또는 "어디서 갈렸는지"만 짧게.
- 좋은 예: "건강에서 갈렸어", "재물 빼면 전부 졌어", "건강이 판을 뒤집었어"
- 나쁜 예: "운명의 주사위는 던져졌다" (정보 없음), "민수의 건강이 갈랐어" (이름 포함)

────────────────────────────────
[한자 표기 규칙]
- 천간/지지/충/합 언급 시 반드시 한자 병기: "甲己합(갑기합)", "편관(偏官)"

────────────────────────────────
[★ 최종 확인 — 출력 전 반드시 점검]

최우선 (위반 시 전체 재작성):
1. 묘(墓)/12운성 묘/묘지에 앉아 — 전체 응답에서 2회 초과면 초과분을 다른 12운성으로 교체
2. 하나의 사주 요소가 메인 근거로 4회 이상 등장하면 일부를 다른 요소로 교체
3. killingLine에 "X점 차이" 같은 점수 숫자 있으면 삭제하고 장면으로 교체
4. 모든 punchline/killingLine이 구체적 일상 장면인지 확인 ("구조"/"경향"/"패턴"/"가능성" 있으면 재작성)
5. 조언/처방 표현("~해야 해"/"~하려면"/"~존중"/"~연습") 있으면 삭제

필수:
6. "스스로" 사용 금지 (본인이/자기가/혼자서)
7. "~해봐" 금지
8. "궁합" 금지
9. 존댓말 금지
10. heroQuip에 이름 금지
11. chemistry.label은 서버값 그대로 복사
12. simulations[].question은 서버값 그대로 복사
13. killingLine 5개가 서로 다른 메인 근거 사용
14. bonusScenarios 2개 중 같은 사람만 깎고 있으면 1개를 반대로 수정
15. simulations 5개에서 A만 당하는 결론이 4개 이상이면 최소 1개를 B가 당하는 결론으로 수정

────────────────────────────────
## 출력 JSON 스키마
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만.
{
  "heroQuip": "10~20자, 이름 절대 금지",
  "categoryResults": {
    "wealth": { "killingLine": "12~30자, 이름 사용", "detail": "150~250자, 사주 근거 3~4문장" },
    "love": { "killingLine": "...", "detail": "..." },
    "career": { "killingLine": "...", "detail": "..." },
    "health": { "killingLine": "...", "detail": "..." },
    "social": { "killingLine": "...", "detail": "..." }
  },
  "chemistry": {
    "label": { "emoji": "서버값 복사", "title": "서버값 복사", "description": "서버값 복사" },
    "bonusScenarios": [
      { "type": "관계유형", "label": "~였다면?", "punchline": "25~50자 hook", "analysis": "4~5문장" },
      { "type": "관계유형", "label": "~였다면?", "punchline": "25~50자 hook", "analysis": "4~5문장" }
    ],
    "punchline": "25~50자, 관계 본질 장면",
    "analysis": "2~3문단",
    "mainScenario": { "type": "서버가 지정한 관계", "analysis": "1~2문단" }
  },
  "simulations": [
    { "question": "서버가 준 질문 그대로", "punchline": "25~50자 구체적 장면", "reasoning": "150~250자 근거 3~4문장", "basis": "20자 이내 키워드" }
  ],
  "futureOutlook": {
    "punchline": "25~50자, 시간 반전 한 줄",
    "nextYear": "1~2문장",
    "threeYears": "1~2문장"
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
  chemistryLabel?: ChemistryLabel;
  simulationQuestions?: { icon: string; question: string }[];
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
    chemistryLabel,
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

  // Chemistry label block
  let chemistryBlock = "";
  if (chemistryLabel) {
    chemistryBlock = `
[상성 유형 라벨 — 서버 확정]
emoji: ${chemistryLabel.emoji}
title: ${chemistryLabel.title}
description: ${chemistryLabel.description}
→ 이 라벨을 chemistry.label에 그대로 복사해. 변경 금지.`;
  }

  // Simulation questions block
  let simulationBlock = "";
  if (simulationQuestions && simulationQuestions.length > 0) {
    const simLines = simulationQuestions.map((sq, i) =>
      `${i + 1}. ${sq.icon} ${sq.question}`
    );
    simulationBlock = `
[시뮬레이션 질문 — 서버 선택]
${simLines.join("\n")}
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
${chemistryBlock}
${simulationBlock}

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
  chemistryLabel?: ChemistryLabel;
  simulationQuestions?: { icon: string; question: string }[];
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
    const res = await callGemini(model, finalUserInfo, BATTLE_SYSTEM_PROMPT);
    if (res.ok) {
      try {
        const raw = parseJson5Loose<any>(res.text);
        const validated = validateAndNormalize(raw, opts.relationshipType, opts.chemistryLabel, opts.simulationQuestions);
        const { result: postprocessed, warnings, shouldRetry } = postprocessBattleResult(validated);

        if (shouldRetry && !isRetry) {
          console.warn("[BATTLE_LLM] 품질 기준 미달 — 1회 재시도");
          return runBattleAnalysisInner(opts, true);
        }

        if (warnings.length > 0) {
          for (const w of warnings) {
            console.warn(`[배틀 후처리] ${w}`);
          }
        }

        return postprocessed;
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
  chemistryLabel?: ChemistryLabel,
  simulationQuestions?: { icon: string; question: string }[],
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

  // chemistry — force server label
  const chem = raw.chemistry;
  const chemistry: BattleLlmAnalysis["chemistry"] = {
    label: chemistryLabel || { emoji: "", title: "", description: "" },
    punchline: "",
    analysis: "",
    mainScenario: { type: relationshipType, analysis: "" },
    bonusScenarios: [],
  };

  if (chem && typeof chem === "object") {
    // punchline fallback: label.description
    chemistry.punchline = chem.punchline || chemistryLabel?.description || "";
    chemistry.analysis = chem.analysis || "";
    if (chem.mainScenario) {
      chemistry.mainScenario = {
        type: relationshipType,
        analysis: chem.mainScenario.analysis || "",
      };
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
  const futureOutlook: BattleLlmAnalysis["futureOutlook"] = {
    punchline: "",
    nextYear: "",
    threeYears: "",
  };
  if (fo && typeof fo === "object") {
    futureOutlook.punchline = fo.punchline || "";
    futureOutlook.nextYear = fo.nextYear || "";
    futureOutlook.threeYears = fo.threeYears || "";
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
  chemistryLabel?: ChemistryLabel;
  simulationQuestions?: { icon: string; question: string }[];
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
      label: opts.chemistryLabel || { emoji: "", title: "", description: "" },
      punchline: "",
      analysis: "",
      mainScenario: { type: opts.relationshipType, analysis: "" },
      bonusScenarios: [],
    },
    simulations: (opts.simulationQuestions || []).map((sq) => ({
      question: sq.question,
      punchline: "",
      reasoning: "",
      basis: "",
    })),
    futureOutlook: { punchline: "", nextYear: "", threeYears: "" },
    finalVerdict: {
      punchline: "",
      verdict: winner
        ? `종합적으로 ${winner}의 사주가 더 강한 기운을 갖고 있어.`
        : "두 사람 다 비슷한 수준의 사주 기운이야.",
    },
  };
}
