// 공유 보상 지급 관문 — kind → "본인 소유의 실물 결과 row" 확인 규칙.
//
// prepare 라우트에 인라인이던 KIND_CHECKS를 여기로 뺐다. 이유는 둘이다.
// ① 라우트 파일은 next 런타임 없이 import가 어려워 단위 테스트가 안 붙는다.
// ② 라인이 7종으로 늘면서 "어떤 라인이 결제 검증을 거치는가"가 정책 그 자체가 됐다.
//
// requireNonNull은 "결제 완료" 판정 컬럼이다. marriage/wealth/career는 start 단계에서
// teaser_json만 채운 무료 row가 먼저 생기고, analyze(결제) 이후에만 full_json이 채워진다
// (app/api/{marriage,wealth,career}/results/route.ts의 teaser/completed 분기와 동일 기준).
// 이 검사가 빠지면 결제하지 않은 티저 row로 5알을 받아가므로 반드시 함께 간다.

import type { ShareRewardKind } from "./constants/share-reward";

export type KindCheck = {
  table: string;
  /** 결제/분석 완료를 확인하는 추가 조건(해당 컬럼이 NOT NULL이어야 통과) */
  requireNonNull?: string;
};

export const SHARE_REWARD_KIND_CHECKS: Partial<Record<ShareRewardKind, KindCheck>> = {
  result: { table: "saju_results" },
  battle: { table: "saju_battles" },
  yearly: { table: "yearly_results" },
  pet: { table: "pet_compat_results" },
  marriage: { table: "marriage_results", requireNonNull: "full_json" },
  wealth: { table: "wealth_results", requireNonNull: "full_json" },
  career: { table: "career_results", requireNonNull: "full_json" },
};
