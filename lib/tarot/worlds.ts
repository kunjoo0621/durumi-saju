// 브랜드 스위처가 다루는 "세계" 목록 — 순수 데이터(서버·클라 공용).
//
// 세계 구분은 accent 컬러와 두루미 복장만이다(§3.1). 배경 다크·Pretendard·카드 레이아웃 등
// 디자인 시스템은 공유한다. 사이트가 쪼개진 느낌 없이 "같은 두루미가 다른 걸 본다"가 되어야 한다.
// accent는 globals.css의 `[data-world="…"]`가 --primary를 덮어써서 바뀐다.

export type WorldId = "saju" | "tarot" | "zodiac";

export interface World {
  id: WorldId;
  brand: string;
  /** 시트에서 브랜드 아래 붙는 한 줄. 세계끼리 뭐가 다른지 */
  tagline: string;
  href: string;
  /** accent 미리보기 점. --primary 토큰과 같은 값을 하드코딩 — 시트는 세 세계를 한 화면에
   *  동시에 보여줘야 해서 현재 세계의 토큰 하나로는 표현할 수 없다 */
  dot: string;
  ready: boolean;
}

// 타로가 열리기 전에는 스위처를 아예 띄우지 않는다(브랜드가 평범한 제목으로 남는다).
// 운영 중인 사주 화면에 미완성 라우트 통로가 먼저 뚫리는 걸 막는다.
export const TAROT_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TAROT === "1";

export const WORLDS: readonly World[] = [
  {
    id: "saju",
    brand: "사주보는 두루미",
    tagline: "타고난 기질과 운의 흐름",
    href: "/",
    dot: "#F43F5E",
    ready: true,
  },
  {
    id: "tarot",
    brand: "타로보는 두루미",
    tagline: "지금 눈앞의 이 선택, 할까 말까",
    href: "/tarot",
    dot: "#A855F7",
    ready: true,
  },
  {
    id: "zodiac",
    brand: "별자리보는 두루미",
    tagline: "준비 중이에요",
    href: "",
    dot: "#60A5FA",
    ready: false,
  },
];

/** 경로로 현재 세계를 판별한다. `/tarot`·`/tarot/...` 만 타로, 나머지는 전부 사주. */
export function worldFromPath(pathname: string): WorldId {
  return pathname === "/tarot" || pathname.startsWith("/tarot/") ? "tarot" : "saju";
}

export function worldBrand(id: WorldId): string {
  return WORLDS.find((w) => w.id === id)?.brand ?? "사주보는 두루미";
}
