import FloatingSajuCTA from "@/components/dict/FloatingSajuCTA";

/**
 * 두루미 매거진 공통 레이아웃 — Floating CTA를 매거진 전 페이지에 강제 노출.
 *
 * 정책: stories의 목적은 트래픽이 아니라 사주 전환.
 * 사용자가 글 어느 위치에 있든 사주 보기 CTA가 항상 손에 닿게.
 * 목적지는 본문 CTA와 동일하게 `/menu`로 통일 (체크리스트 1번 가드 —
 * 메뉴에서 사주·궁합·올해운·오늘운 직접 선택). → docs/STORIES_CHECKLIST.md 참조.
 */
export default function StoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <FloatingSajuCTA href="/menu" />
    </>
  );
}
