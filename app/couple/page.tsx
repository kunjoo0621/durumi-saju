import CoupleEntryClient from "./CoupleEntryClient";

// couple 진입 — marriage 와 같이 requireSession 게이트를 두지 않는다.
// 비로그인도 들어와 설명을 보고, 로그인은 사주 입력 제출 시점에만 요구한다.
export default function CouplePage() {
  return <CoupleEntryClient />;
}
