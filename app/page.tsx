// 통합 허브 홈 — 서버 컴포넌트 셸. 인기 캐러셀·서비스·연예인·사전·매거진·FAQ·스티키 CTA.
// (기존 "use client" 랜딩 전면 교체. FeatureCard/FAQ_ITEMS 등 로컬 코드는 외부 참조 없어 함께 제거)
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import HubHeroCarousel from "@/components/hub/HubHeroCarousel";
import ServiceRail from "@/components/hub/ServiceRail";
import CelebrityRail, { type HubCelebrity } from "@/components/hub/CelebrityRail";
import DictList from "@/components/hub/DictList";
import MagazineList from "@/components/hub/MagazineList";
import HubFaq from "@/components/hub/HubFaq";
import HubStickyCta from "@/components/hub/HubStickyCta";
import { getAllStories } from "@/lib/stories/registry";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 인기순(조회수) 정렬을 1시간 ISR로 갱신 — 정적 유지 + 주기적 최신화
export const revalidate = 3600;

// story_views 테이블에서 전체 조회수 맵. 실패 시 {} (레지스트리 순서로 폴백)
async function getViewMap(): Promise<Record<string, number>> {
  try {
    const { data } = await supabaseAdmin.from("story_views").select("slug, view_count");
    const map: Record<string, number> = {};
    for (const row of data ?? []) map[row.slug] = Number(row.view_count ?? 0);
    return map;
  } catch {
    return {};
  }
}

export default async function HomePage() {
  const views = await getViewMap();
  const byViews = (a: { slug: string }, b: { slug: string }) =>
    (views[b.slug] ?? 0) - (views[a.slug] ?? 0);

  // 연예인 카드 — 연예인 카테고리 조회수 상위 10 (초상·이름·직업 有), 가로 스크롤
  const celebrities: HubCelebrity[] = getAllStories()
    .filter((s) => s.category === "celebrity" && s.celebrity && s.heroImage)
    .sort(byViews)
    .slice(0, 10)
    .map((st) => ({
      slug: st.slug,
      name: st.celebrity!.name,
      occupation: st.celebrity!.occupation ?? "",
      src: st.heroImage!.src,
      alt: st.heroImage!.alt,
    }));

  // 매거진 — 조회수 상위 5 (인기순)
  const magazineStories = [...getAllStories()].sort(byViews).slice(0, 5);

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[440px] overflow-hidden bg-background-primary text-text-primary">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[100px]" />

      <Header sticky />

      <main className="pb-[120px]">
        <HubHeroCarousel />
        <ServiceRail />
        <CelebrityRail items={celebrities} />
        <DictList />
        <MagazineList stories={magazineStories} />
        <HubFaq />
        <div className="px-5 pt-10">
          <BusinessFooter />
        </div>
      </main>

      <Suspense fallback={null}>
        <HubStickyCta />
      </Suspense>
    </div>
  );
}
