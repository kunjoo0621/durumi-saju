import posthog from "posthog-js";

type SpendType = "analysis" | "battle";

export type FormName = "start" | "battle" | "yearly" | "today" | "marriage";

/** 폼 스텝 진행 */
export function trackFormStep(form: FormName, step: number, stepName: string) {
  posthog.capture("form_step", { form, step, step_name: stepName });
}

/** 폼 완료 (제출) */
export function trackFormComplete(form: FormName) {
  posthog.capture("form_complete", { form });
}

/** 결제 시도 */
export function trackPaymentAttempt(type: SpendType, cost: number) {
  posthog.capture("payment_attempt", { type, cost });
}

/** 결제 성공 */
export function trackPaymentSuccess(type: SpendType, cost: number) {
  posthog.capture("payment_success", { type, cost });
}

/** 결제 실패 */
export function trackPaymentFail(type: SpendType, reason: string) {
  posthog.capture("payment_fail", { type, reason });
}

/** 잔액 부족 → 충전 시트 노출 */
export function trackInsufficientBalance(type: SpendType, balance: number, required: number) {
  posthog.capture("insufficient_balance", { type, balance, required });
}

/** 로그인 트리거 (어디서 로그인으로 보내졌는지) */
export function trackLoginTrigger(from: string) {
  posthog.capture("login_trigger", { from });
}

/** 결과 공유 */
export function trackShare(type: SpendType, method: string) {
  posthog.capture("result_share", { type, method });
}
