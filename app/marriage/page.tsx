import MarriageEntryClient from "./MarriageEntryClient";

// 결혼운 진입 — today와 달리 requireSession 게이트를 두지 않는다(로그인 강제 제거).
// 비로그인도 진입해 설명을 보고 자체입력(SajuInputFlow) 경로로 들어갈 수 있어야 하며,
// 로그인은 SajuInputFlow 제출 시점(개인사주와 동일)에만 요구한다.
export default function MarriagePage() {
  return <MarriageEntryClient />;
}
