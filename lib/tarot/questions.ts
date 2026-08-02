// 타로 질문 14문항 — 순수 데이터(서버·클라 공용). "use client" 없음.
//
// slug는 라우트(`/tarot/<slug>`)·포스터 파일명·재사용 가드 키(question_id)에 모두 쓰인다.
// 한 번 내보내면 바꿀 수 없다고 보고 다뤄야 한다. 이미 결제한 리딩이 슬러그로 묶여 있기 때문.

export type TarotTopic = "career" | "relationship" | "challenge";

export interface TarotQuestion {
  slug: string;
  topic: TarotTopic;
  /** 카드 제목. "~해도 될까?" 결정형으로 통일 */
  question: string;
  /** 카드 설명 한 줄 */
  desc: string;
}

export const TAROT_TOPIC_LABEL: Record<TarotTopic, string> = {
  career: "일·커리어",
  relationship: "관계·연애",
  challenge: "도전·선택",
};

// 주제군으로 묶지 않고 한 층에 평평하게 늘어놓는다(§3.2). 주제군은 카드 위 칩으로만.
export const TAROT_QUESTIONS: readonly TarotQuestion[] = [
  { slug: "ijik", topic: "career", question: "이직해도 될까?", desc: "지금 옮기는 게 맞는 때인지" },
  { slug: "toesa", topic: "career", question: "퇴사해도 될까?", desc: "버틸 자리인지 나올 자리인지" },
  { slug: "isa", topic: "career", question: "이 회사로 가도 될까?", desc: "들어가면 어떤 판이 열리는지" },
  { slug: "changup", topic: "career", question: "창업해도 될까?", desc: "혼자 세울 그릇인지" },
  { slug: "nama", topic: "career", question: "지금 자리에 남아도 될까?", desc: "머무는 게 손해인지 밑거름인지" },
  { slug: "gyesok", topic: "relationship", question: "이 사람 계속 만나도 될까?", desc: "이 인연을 이어야 할지" },
  { slug: "gobaek", topic: "relationship", question: "고백해도 될까?", desc: "말할 때인지 기다릴 때인지" },
  { slug: "ibyeol", topic: "relationship", question: "헤어져야 할까?", desc: "끝인지 고비인지" },
  { slug: "jaehoe", topic: "relationship", question: "재회해도 될까?", desc: "돌아갈 자리가 있는지" },
  { slug: "sonjeol", topic: "relationship", question: "이 관계 손절해야 할까?", desc: "놓아야 할 사람인지" },
  { slug: "dojeon", topic: "challenge", question: "다시 도전해도 될까?", desc: "한 번 더 갈 힘이 남았는지" },
  { slug: "sijak", topic: "challenge", question: "지금 시작해도 될까?", desc: "때가 왔는지 좀 더인지" },
  { slug: "tteona", topic: "challenge", question: "떠나도 될까?", desc: "자리를 옮겨야 풀리는지" },
  { slug: "duljung", topic: "challenge", question: "둘 중 뭘 고를까?", desc: "어느 쪽이 네 결에 맞는지" },
] as const;

const BY_SLUG = new Map(TAROT_QUESTIONS.map((q) => [q.slug, q]));

export function getTarotQuestion(slug: string): TarotQuestion | undefined {
  return BY_SLUG.get(slug);
}

export function tarotPosterSrc(slug: string): string {
  return `/images/tarot/${slug}-poster.webp`;
}

// 포스터는 Phase 0(운영자 GPT 제작)이 끝나는 대로 한 장씩 들어온다.
// 파일이 아직 없는 슬러그를 next/image로 그리면 깨진 이미지가 뜨므로,
// 여기 등록된 것만 실제 포스터를 쓰고 나머지는 자리표시자로 그린다.
// 그림이 도착할 때마다 슬러그를 추가할 것.
export const TAROT_POSTER_READY: ReadonlySet<string> = new Set<string>();
