/**
 * 매거진 태그 = 브라우징·클러스터·관련글·개인화의 주춧돌.
 *
 * 단일 소스: slug → 태그. (113개 데이터 파일에 흩뿌리지 않고 여기 한 곳에서 관리)
 * registry가 getAllStories() 시점에 story.tags로 주입한다.
 *
 * 설계 핵심 — 천간 일간 태그(갑목~계수)가 "연예인 일주"와 "일간 가이드"를
 * 한 클러스터로 묶는 다리다. 예: 임영웅(정사일주) → '정화' → 정화일간 남/녀 가이드.
 * /dict 검색 유입(일주·일간)과 매거진을 잇는 SEO cluster page가 자동 생성된다.
 */

export type TagGroup = "일간" | "주제" | "인물" | "꿈";

export type TagMeta = {
  /** 칩·페이지 제목용 표시 라벨 */
  label: string;
  group: TagGroup;
  /** 태그 페이지 상단 한 줄 소개 + meta description */
  desc: string;
};

/** 태그 정의 + 노출 순서. 여기 없는 태그가 STORY_TAGS에 쓰이면 빌드 검증에서 걸린다. */
export const TAG_META: Record<string, TagMeta> = {
  // ── 일간(천간) — 연예인 일주와 일간 가이드를 잇는 다리 ──
  갑목: { label: "갑목 일간", group: "일간", desc: "곧게 뻗는 큰 나무, 갑목 일간으로 태어난 사람들의 결과 그 일주를 가진 인물들." },
  을목: { label: "을목 일간", group: "일간", desc: "휘어도 꺾이지 않는 을목 일간의 성정과 그 일주를 가진 인물들." },
  병화: { label: "병화 일간", group: "일간", desc: "한낮의 태양 같은 병화 일간의 성정과 그 일주를 가진 인물들." },
  정화: { label: "정화 일간", group: "일간", desc: "은은히 멀리 번지는 등불, 정화 일간의 결과 그 일주를 가진 인물들." },
  무토: { label: "무토 일간", group: "일간", desc: "큰 산 같은 무토 일간의 묵직한 성정과 그 일주를 가진 인물들." },
  기토: { label: "기토 일간", group: "일간", desc: "다 키워내는 옥토, 기토 일간의 결과 그 일주를 가진 인물들." },
  경금: { label: "경금 일간", group: "일간", desc: "칼처럼 분명한 경금 일간의 성정과 그 일주를 가진 인물들." },
  신금: { label: "신금 일간", group: "일간", desc: "보석처럼 단단한 신금 일간의 결과 그 일주를 가진 인물들." },
  임수: { label: "임수 일간", group: "일간", desc: "바다처럼 깊은 임수 일간의 성정과 그 일주를 가진 인물들." },
  계수: { label: "계수 일간", group: "일간", desc: "이슬처럼 섬세한 계수 일간의 결과 그 일주를 가진 인물들." },

  // ── 주제 ──
  재물운: { label: "재물운", group: "주제", desc: "돈복·재물·통장이 차고 새는 결을 다룬 글 모음." },
  연애운: { label: "연애운", group: "주제", desc: "끌림·짝사랑·연애 패턴을 사주로 풀어낸 글 모음." },
  궁합: { label: "궁합", group: "주제", desc: "두 사람의 합·충·일지로 보는 궁합 이야기 모음." },
  결혼운: { label: "결혼운", group: "주제", desc: "결혼 시기·배우자복·이혼수 등 결혼을 둘러싼 결." },
  직업운: { label: "직업운", group: "주제", desc: "적성·직장운을 사주로 보는 글 모음." },
  신살: { label: "신살", group: "주제", desc: "도화살·홍염살·원진살 등 끌림과 인연을 좌우하는 신살." },
  "2026운세": { label: "2026 운세", group: "주제", desc: "병오년 2026, 재물과 흐름이 좋은 사주의 결." },

  // ── 인물 ──
  연예인: { label: "연예인 사주", group: "인물", desc: "공개된 생년월일로 본 연예인의 사주 원국과 풀이." },
  트로트: { label: "트로트 가수", group: "인물", desc: "트로트 가수들의 사주 원국과 일주 풀이." },
  아이돌: { label: "아이돌", group: "인물", desc: "아이돌 멤버들의 사주 원국과 일주 풀이." },
  배우: { label: "배우", group: "인물", desc: "배우들의 사주 원국과 일주 풀이." },

  // ── 꿈 ──
  꿈해몽: { label: "꿈해몽", group: "꿈", desc: "꿈에 나온 그 장면, 사주와 함께 보는 진짜 의미." },
  태몽: { label: "태몽", group: "꿈", desc: "상징물에 따라 달라지는 태몽의 결." },
  동물꿈: { label: "동물 꿈", group: "꿈", desc: "고양이·뱀·호랑이 등 동물이 나온 꿈의 의미." },
};

/** 브라우징 칩 노출 순서 (그룹 순서대로) */
export const TAG_ORDER: string[] = [
  "연예인", "트로트", "아이돌", "배우",
  "재물운", "연애운", "궁합", "결혼운", "직업운", "신살", "2026운세",
  "꿈해몽", "동물꿈", "태몽",
  "갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수",
];

/**
 * slug → 태그 배열. 단일 소스.
 * 연예인: 연예인 + (트로트|아이돌|배우) + 천간일간(일주 첫 글자 기준).
 * 일간 가이드: 해당 천간일간.
 * 꿈/궁합/재물: 주제 태그.
 */
export const STORY_TAGS: Record<string, string[]> = {
  // ── 연예인 (천간 = 일주 첫 글자) ──
  anseonghun: ["연예인", "트로트", "기토"],
  anton: ["연예인", "아이돌", "기토"],
  byeonwooseok: ["연예인", "배우", "갑목"],
  chaeunwoo: ["연예인", "아이돌", "배우", "신금"],
  hansohee: ["연예인", "배우", "계수"],
  hongja: ["연예인", "트로트", "신금"],
  imyoungwoong: ["연예인", "트로트", "정화"],
  iu: ["연예인", "배우", "정화"],
  jangminho: ["연예인", "트로트", "신금"],
  jangyunjeong: ["연예인", "트로트", "기토"],
  jennie: ["연예인", "아이돌", "임수"],
  jinhaeseong: ["연예인", "트로트", "경금"],
  jinseong: ["연예인", "트로트", "병화"],
  jungdongwon: ["연예인", "트로트", "임수"],
  jungmiae: ["연예인", "트로트", "정화"],
  jungkook: ["연예인", "아이돌", "병화"],
  jungwon: ["연예인", "아이돌", "무토"],
  karina: ["연예인", "아이돌", "기토"],
  kimheejae: ["연예인", "트로트", "신금"],
  kimsoohyun: ["연예인", "배우", "신금"],
  kimsuchan: ["연예인", "트로트", "무토"],
  kimtaeri: ["연예인", "배우", "기토"],
  kimyongbin: ["연예인", "트로트", "정화"],
  leechanwon: ["연예인", "트로트", "임수"],
  leesona: ["연예인", "트로트", "임수"],
  minji: ["연예인", "아이돌", "병화"],
  nataeju: ["연예인", "트로트", "경금"],
  parkjihyeon: ["연예인", "트로트", "정화"],
  parkseojin: ["연예인", "트로트", "갑목"],
  seonghanbin: ["연예인", "아이돌", "정화"],
  songgain: ["연예인", "트로트", "갑목"],
  sontaejin: ["연예인", "트로트", "무토"],
  sungchan: ["연예인", "아이돌", "기토"],
  wonyoung: ["연예인", "아이돌", "임수"],
  yangjieun: ["연예인", "트로트", "갑목"],
  youngtak: ["연예인", "트로트", "신금"],
  zhanghao: ["연예인", "아이돌", "갑목"],

  // ── 일간 가이드 (남/여) ──
  "gapmok-ilgan-man": ["갑목"],
  "gapmok-ilgan-woman": ["갑목"],
  "eulmok-ilgan-man": ["을목"],
  "eulmok-ilgan-woman": ["을목"],
  "byeonghwa-ilgan-man": ["병화"],
  "byeonghwa-ilgan-woman": ["병화"],
  "jeonghwa-ilgan-man": ["정화"],
  "jeonghwa-ilgan-woman": ["정화"],
  "muto-ilgan-man": ["무토"],
  "muto-ilgan-woman": ["무토"],
  "gito-ilgan-man": ["기토"],
  "gito-ilgan-woman": ["기토"],
  "gyeonggeum-ilgan-man": ["경금"],
  "gyeonggeum-ilgan-woman": ["경금"],
  "singeum-ilgan-man": ["신금"],
  "singeum-ilgan-woman": ["신금"],
  "imsu-ilgan-man": ["임수"],
  "imsu-ilgan-woman": ["임수"],
  "gyesu-ilgan-man": ["계수"],
  "gyesu-ilgan-woman": ["계수"],

  // ── 사주 주제 ──
  "career-saju": ["직업운"],
  "dombok-saju": ["재물운"],
  "savings-saju": ["재물운"],
  "rich-2026-saju": ["재물운", "2026운세"],

  // ── 연애·궁합 ──
  "baeujabok-saju": ["결혼운", "궁합"],
  "baramgi-saju": ["연애운", "신살"],
  "cheotsarang-saju": ["연애운"],
  "dohwa-yeonae": ["연애운", "신살"],
  "geu-saram-maeum": ["연애운"],
  "goonghap-hap-chung": ["궁합"],
  "goonghap-jalsanun": ["궁합"],
  "gyeolhon-sigi": ["결혼운"],
  "hongryeom-maeryeok": ["연애운", "신살"],
  "ihonsu-saju": ["결혼운"],
  "ilji-chung-goonghap": ["궁합"],
  "ilji-spouse": ["궁합", "결혼운"],
  "jaehoe-goonghap": ["연애운", "궁합"],
  "lasting-couple": ["궁합", "결혼운"],
  "marriage-caution": ["결혼운", "궁합"],
  "naicha-goonghap": ["궁합"],
  "wonjin-goonghap": ["궁합", "신살"],
  "yeonae-pattern": ["연애운"],
  "zodiac-vs-myeongni": ["궁합"],

  // ── 꿈해몽 ──
  "baby-dream": ["꿈해몽", "태몽"],
  "blood-dream": ["꿈해몽", "재물운"],
  "bug-dream": ["꿈해몽", "재물운"],
  "cat-dream": ["꿈해몽", "동물꿈"],
  "chased-dream": ["꿈해몽"],
  "dead-person-dream": ["꿈해몽"],
  "death-dream": ["꿈해몽"],
  "dog-dream": ["꿈해몽", "동물꿈"],
  "dragon-dream": ["꿈해몽", "동물꿈"],
  "ex-lover-dream": ["꿈해몽", "연애운"],
  "exam-dream": ["꿈해몽"],
  "falling-dream": ["꿈해몽"],
  "fight-dream": ["꿈해몽"],
  "fire-dream": ["꿈해몽"],
  "fish-dream": ["꿈해몽", "동물꿈", "태몽"],
  "flying-dream": ["꿈해몽"],
  "ghost-dream": ["꿈해몽"],
  "hair-dream": ["꿈해몽"],
  "house-dream": ["꿈해몽"],
  "money-dream": ["꿈해몽", "재물운"],
  "pig-dream": ["꿈해몽", "동물꿈", "재물운"],
  "poop-dream": ["꿈해몽", "재물운"],
  "pregnancy-dream": ["꿈해몽", "태몽"],
  "rat-dream": ["꿈해몽", "동물꿈", "재물운"],
  "sea-dream": ["꿈해몽"],
  "snake-dream": ["꿈해몽", "동물꿈"],
  "spider-dream": ["꿈해몽", "동물꿈", "재물운"],
  "theft-dream": ["꿈해몽", "재물운"],
  "tiger-dream": ["꿈해몽", "동물꿈"],
  "tooth-dream": ["꿈해몽"],
  "water-dream": ["꿈해몽"],
  "wedding-dream": ["꿈해몽", "결혼운"],
};
