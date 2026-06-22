// 결과 공유 보상 안내 배너 (랜딩 상단 바). 가입 보너스 종료 후 그 자리를 대체.
// 실제 지급은 결과 화면 공유 버튼 → /api/coins/share-reward (최초 1회 5알).
export default function ShareRewardBanner() {
  return (
    <div className="bg-[#17142a] border-b border-[#6d5cff]/35 px-4 py-2.5">
      <p className="flex items-center justify-center gap-1.5 text-center text-[13px] font-medium text-white">
        <span aria-hidden>🎁</span>
        <span>결과를 친구에게 공유하면</span>
        <span className="rounded-full bg-[#6d5cff] px-2 py-0.5 text-[12px] font-bold text-white">
          5알 선물
        </span>
      </p>
    </div>
  );
}
