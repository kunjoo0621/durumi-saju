// 결과 공유 보상 안내 배너 (랜딩 상단 바). 가입 보너스 종료 후 그 자리를 대체.
// 실제 지급은 카카오톡 전송이 성공했을 때만 — 결과 화면 공유 버튼 → 카카오 공유 웹훅
// → /api/share/kakao-callback (결과지 종류당 1회 5알).
// 문구와 실동작이 어긋나면 CS로 직행하므로, 동작 변경과 같은 배포에서 함께 바뀐다.
export default function ShareRewardBanner() {
  return (
    <div className="bg-[#17142a] border-b border-[#6d5cff]/35 px-4 py-2.5">
      <p className="flex items-center justify-center gap-1.5 text-center text-[13px] font-medium text-white">
        <span aria-hidden>🎁</span>
        <span>결과를 카카오톡으로 공유하면</span>
        <span className="rounded-full bg-[#6d5cff] px-2 py-0.5 text-[12px] font-bold text-white">
          5알 선물
        </span>
      </p>
    </div>
  );
}
