// 운영자(신건주) Supabase user_id.
// charge-success 결제 완료 페이지를 운영자 계정만 먼저 타게 하는 feature flag.
// 운영자 실결제 5종 검증 후 전체 전환 시 이 gate 제거 예정.
export const OPERATOR_SUPABASE_ID = "f39ccecb-fc39-4ef9-a262-d8ab2b85c317";

export function isOperator(supabaseId: string | null | undefined): boolean {
  return supabaseId === OPERATOR_SUPABASE_ID;
}
