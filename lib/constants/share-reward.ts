// 공유 보상 v2 상수 — 카카오톡 전송 확인 지급, 결과지 종류당 1회 5알
//
// kind는 이 유니언과 DB CHECK 제약 양쪽에 고정한다(이중 고정).
// 'today'가 집합에 없는 것은 의도다 — 5알짜리 상품에 5알을 주면 실질 무료화가 된다.

export const SHARE_REWARD_KINDS = [
  "result",
  "battle",
  "yearly",
  "pet",
  "wealth",
  "marriage",
  "career",
] as const;

export type ShareRewardKind = (typeof SHARE_REWARD_KINDS)[number];

export const SHARE_REWARD_AMOUNT = 5;

export function isShareRewardKind(v: unknown): v is ShareRewardKind {
  return typeof v === "string" && (SHARE_REWARD_KINDS as readonly string[]).includes(v);
}

/** 공유된 링크가 향하는 공개 결과 페이지 경로 */
export const SHARE_PATH_BY_KIND: Record<ShareRewardKind, (id: string) => string> = {
  result: (id) => `/result/share/${id}`,
  battle: (id) => `/battle/result/share/${id}`,
  yearly: (id) => `/yearly/result/share/${id}`,
  pet: (id) => `/pet/result/share/${id}`,
  // Phase 2b에서 공개 share 라우트가 신설되며 연결됐다
  wealth: (id) => `/wealth/result/share/${id}`,
  marriage: (id) => `/marriage/result/share/${id}`,
  career: (id) => `/career/result/share/${id}`,
};
