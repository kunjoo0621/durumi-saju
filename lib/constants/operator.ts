// 운영자(신건주) Supabase user_id.
// charge_orders 신구조 1차 검증 단계에서 운영자만 신구조 결제 흐름 사용.
// 검증 후 전체 사용자 전환 시 이 상수는 제거 예정.
export const OPERATOR_SUPABASE_ID = "f39ccecb-fc39-4ef9-a262-d8ab2b85c317";

export function isOperator(supabaseId: string | null | undefined): boolean {
  return supabaseId === OPERATOR_SUPABASE_ID;
}
