// 타로 홈 — 사주 홈(app/page.tsx)의 셸을 미러하되 출시 시점엔 덜어낸다(§3.6).
//
// 사주 홈과 다른 것
//   · 히어로 캐러셀 없음 — 메뉴가 첫 화면이다
//   · 서비스 레일(가로 150px) 대신 14문항 2열 세로 그리드
//   · 연예인·사전·매거진 없음
//   · 스티키 CTA 없음 — 사주 홈의 CTA는 "메뉴로 보내기"가 일인데 여기선 메뉴가 이미 화면에 있다.
//     14칸 그리드 위에 고정 바를 얹으면 마지막 줄만 가린다
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import ShareRewardBanner from "@/components/ShareRewardBanner";
import HubFaq from "@/components/hub/HubFaq";
import HubSectionHeader from "@/components/hub/HubSectionHeader";
import Reveal from "@/components/hub/Reveal";
import TarotQuestionGrid from "@/components/tarot/TarotQuestionGrid";
import { TAROT_FAQ_ITEMS } from "@/lib/tarot/faq";

export default function TarotHomePage() {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[440px] bg-background-primary text-text-primary">
      {/* glow는 별도 래퍼에서 클리핑 — 메인 컨테이너에 overflow-hidden 두면 sticky 깨짐 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[100px]" />
      </div>

      <div className="sticky top-0 z-[100]">
        <Header />
        <ShareRewardBanner />
      </div>

      <main className="pb-10">
        <section className="pt-6">
          <Reveal>
            <HubSectionHeader
              eyebrow="할까 말까 싶을 때"
              title="무엇을 물어볼까?"
            />
          </Reveal>
          <TarotQuestionGrid />
        </section>

        <HubFaq items={TAROT_FAQ_ITEMS} />

        <div className="px-5 pt-10">
          <BusinessFooter />
        </div>
      </main>
    </div>
  );
}
