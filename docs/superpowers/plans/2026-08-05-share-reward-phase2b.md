# 공유 보상 Phase 2b — 결혼운·재물운·커리어운 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결혼운·재물운·커리어운 결과지에도 카카오톡 공유 버튼과 5알 보상을 붙여, 홈 배너가 약속한 "결과마다 공유하면 5알"을 실제 동작과 일치시킨다.

**Architecture:** 기존 4종(개인사주·배틀·신년운세·반려동물궁합)이 쓰는 파이프라인을 그대로 확장한다 — ① 지급 관문(`prepare` 라우트의 kind→테이블 매핑)에 3종을 등록하고, ② 비로그인이 열람하는 공개 share 라우트를 3개 신설하며, ③ 결과 화면에 기존 공용 `KakaoShareButton`을 배치한다. 새 컴포넌트·새 테이블·새 RPC는 만들지 않는다.

**Tech Stack:** Next.js 15 App Router (server component + "use client"), TypeScript, Supabase(service_role), node:test (`tsx --test`)

## Global Constraints

- **브랜치**: 반드시 `main`에서 새로 딴다 — `git checkout main && git pull && git checkout -b feat/share-reward-phase2b`. 다른 브랜치 위에 쌓지 않는다.
- **DB 마이그레이션 없음**: `supabase/migrations/20260728_share_kakao_reward.sql`의 `share_reward_grants`·`share_kakao_nonces` CHECK 제약이 이미 `('result','battle','yearly','pet','wealth','marriage','career')` 7종을 허용한다. 새 마이그레이션을 쓰지 말 것.
- **결제 게이팅 판정 기준**: `marriage_results`·`wealth_results`·`career_results` 세 테이블 모두 **`full_json IS NULL` = 결제 전 티저**, **NOT NULL = 결제 완료**다. (`app/api/{marriage,wealth,career}/results/route.ts`의 status 분기와 동일 기준.) 공짜 티저 row에 보상이 나가면 정책이 무너지므로 이 검사를 반드시 건다.
- **`SCORING_VERSION`을 건드리지 않는다.** 이 작업은 점수·등급 산식과 무관하다.
- **API 에러 응답에 `error.message`를 노출하지 않는다.** 일반 한국어 메시지만 반환하고 상세는 `console.error`.
- **공개 share 페이지는 전부 `robots: { index: false, follow: false }`.** 남의 결제 결과가 검색에 뜨면 안 된다.
- **`npx next build` 성공이 배포 전 필수.** dev 서버가 떠 있으면 `.next` 청크가 충돌하므로 반드시 dev를 끄고 빌드한다.
- **커밋 메시지에 "왜 바꿨는지"를 반드시 포함한다.**
- **main 머지·배포는 운영자 명시 허용 전까지 하지 않는다.** PR 생성까지만.
- 사이트 URL 상수는 `https://www.durumisaju.com` (하드코딩 — `app/layout.tsx:12`와 동일).

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `lib/share-reward-kinds.ts` | kind → 테이블/결제검증 컬럼 매핑. 지급 정책의 단일 출처 | 신규 |
| `lib/share-reward-kinds.test.ts` | 위 매핑의 단위 테스트 | 신규 |
| `app/api/coins/share-reward/prepare/route.ts` | 인라인 `KIND_CHECKS` 제거 → 위 모듈 import | 수정 |
| `lib/share-marriage.ts` / `lib/share-wealth.ts` / `lib/share-career.ts` | share 페이지용 비로그인 SSR 조회 | **기존(dead code) — select 축소 후 배선** |
| `app/{marriage,wealth,career}/result/share/[id]/page.tsx` | 공개 share 페이지 (metadata + notFound 가드) | 신규 |
| `app/{marriage,wealth,career}/result/share/[id]/Share*Client.tsx` | Body를 `shareMode`로 렌더하는 얇은 클라이언트 | 신규 |
| `app/{marriage,wealth,career}/result/*ResultClient.tsx` | `shareMode` prop 추가 + 공유 버튼 배치 + Blocks 타입 export | 수정 |

---

### Task 1: 지급 관문에 3종 등록

**Files:**
- Create: `lib/share-reward-kinds.ts`
- Create: `lib/share-reward-kinds.test.ts`
- Modify: `app/api/coins/share-reward/prepare/route.ts:18-32, 53`

**Interfaces:**
- Consumes: `ShareRewardKind`, `SHARE_REWARD_KINDS` (기존 `lib/constants/share-reward.ts`)
- Produces: `SHARE_REWARD_KIND_CHECKS: Partial<Record<ShareRewardKind, KindCheck>>`, `type KindCheck = { table: string; requireNonNull?: string }` — Task 2~4는 이 등록이 끝나 있어야 보상이 나간다.

- [ ] **Step 1: 브랜치 생성**

```bash
cd ~/projects/durumi-saju
git checkout main && git pull --ff-only
git checkout -b feat/share-reward-phase2b
```

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/share-reward-kinds.test.ts` 를 새로 만든다. `@/` 별칭이 `tsx --test`에서 항상 풀린다는 보장이 없으므로 **상대 경로로만** import한다.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHARE_REWARD_KIND_CHECKS } from "./share-reward-kinds";
import { SHARE_REWARD_KINDS } from "./constants/share-reward";

test("SHARE_REWARD_KINDS 7종이 전부 지급 관문에 등록돼 있다", () => {
  for (const kind of SHARE_REWARD_KINDS) {
    assert.ok(SHARE_REWARD_KIND_CHECKS[kind], `${kind} 미등록`);
  }
});

test("결제 게이팅 라인(marriage/wealth/career)은 full_json NOT NULL을 요구한다", () => {
  for (const kind of ["marriage", "wealth", "career"] as const) {
    assert.equal(
      SHARE_REWARD_KIND_CHECKS[kind]?.requireNonNull,
      "full_json",
      `${kind}에 결제 검증이 없다 — 공짜 티저 row로 5알이 나간다`
    );
  }
});

test("기존 4종에는 requireNonNull을 새로 붙이지 않는다(회귀 방지)", () => {
  for (const kind of ["result", "battle", "yearly", "pet"] as const) {
    assert.equal(SHARE_REWARD_KIND_CHECKS[kind]?.requireNonNull, undefined);
  }
});

test("kind별 테이블 매핑이 정확하다", () => {
  assert.equal(SHARE_REWARD_KIND_CHECKS.result?.table, "saju_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.battle?.table, "saju_battles");
  assert.equal(SHARE_REWARD_KIND_CHECKS.yearly?.table, "yearly_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.pet?.table, "pet_compat_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.marriage?.table, "marriage_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.wealth?.table, "wealth_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.career?.table, "career_results");
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
npx tsx --test lib/share-reward-kinds.test.ts
```
Expected: FAIL — `Cannot find module './share-reward-kinds'`

- [ ] **Step 4: 구현**

`lib/share-reward-kinds.ts` 를 새로 만든다.

```ts
// 공유 보상 지급 관문 — kind → "본인 소유의 실물 결과 row" 확인 규칙.
//
// prepare 라우트에 인라인이던 KIND_CHECKS를 여기로 뺐다. 이유는 둘이다.
// ① 라우트 파일은 next 런타임 없이 import가 어려워 단위 테스트가 안 붙는다.
// ② 라인이 7종으로 늘면서 "어떤 라인이 결제 검증을 거치는가"가 정책 그 자체가 됐다.
//
// requireNonNull은 "결제 완료" 판정 컬럼이다. marriage/wealth/career는 start 단계에서
// teaser_json만 채운 무료 row가 먼저 생기고, analyze(결제) 이후에만 full_json이 채워진다
// (app/api/{marriage,wealth,career}/results/route.ts의 teaser/completed 분기와 동일 기준).
// 이 검사가 빠지면 결제하지 않은 티저 row로 5알을 받아가므로 반드시 함께 간다.

import type { ShareRewardKind } from "./constants/share-reward";

export type KindCheck = {
  table: string;
  /** 결제/분석 완료를 확인하는 추가 조건(해당 컬럼이 NOT NULL이어야 통과) */
  requireNonNull?: string;
};

export const SHARE_REWARD_KIND_CHECKS: Partial<Record<ShareRewardKind, KindCheck>> = {
  result: { table: "saju_results" },
  battle: { table: "saju_battles" },
  yearly: { table: "yearly_results" },
  pet: { table: "pet_compat_results" },
  marriage: { table: "marriage_results", requireNonNull: "full_json" },
  wealth: { table: "wealth_results", requireNonNull: "full_json" },
  career: { table: "career_results", requireNonNull: "full_json" },
};
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx tsx --test lib/share-reward-kinds.test.ts
```
Expected: PASS — 4 tests

- [ ] **Step 6: prepare 라우트를 새 모듈로 교체**

`app/api/coins/share-reward/prepare/route.ts` 에서 아래 두 블록(18~32행)을 **삭제**한다.

```ts
type KindCheck = {
  table: string;
  /** 결제/분석 완료를 확인하는 추가 조건. 미검증 라인은 등록하지 않는다. */
  requireNonNull?: string;
};

// Phase 1~2a 대상만 등록한다.
// wealth/marriage/career는 결제 게이팅 구조를 아직 실측하지 않았다.
// 공짜 티저 row에 보상이 나가면 정책이 무너지므로, 검증 전까지는 기본 거부로 둔다.
const KIND_CHECKS: Partial<Record<ShareRewardKind, KindCheck>> = {
  result: { table: "saju_results" },
  battle: { table: "saju_battles" },
  yearly: { table: "yearly_results" },
  pet: { table: "pet_compat_results" },
};
```

그리고 import 블록 끝(`import { isShareRewardKind, type ShareRewardKind } from "@/lib/constants/share-reward";` 다음 줄)에 아래를 추가한다.

```ts
import { SHARE_REWARD_KIND_CHECKS } from "@/lib/share-reward-kinds";
```

마지막으로 53행의 참조를 바꾼다.

```ts
    const check = SHARE_REWARD_KIND_CHECKS[resultKind];
```

> `requireNonNull`을 실제로 거는 코드(65행 `if (check.requireNonNull) query = query.not(check.requireNonNull, "is", null);`)는 **이미 존재한다.** 건드리지 말 것.

- [ ] **Step 7: 타입 체크**

```bash
npx tsc --noEmit
```
Expected: 에러 0건. (`ShareRewardKind` import가 라우트에서 여전히 쓰이는지 확인 — `isShareRewardKind`만 남고 타입이 미사용이면 `type ShareRewardKind` import를 지운다.)

- [ ] **Step 8: 커밋**

```bash
git add lib/share-reward-kinds.ts lib/share-reward-kinds.test.ts app/api/coins/share-reward/prepare/route.ts
git commit -m "feat(share-reward): 결혼운·재물운·커리어운을 지급 관문에 등록

세 라인 모두 full_json IS NULL이 '결제 전 티저'라는 게 results 라우트의
status 분기로 확인됐다. requireNonNull=full_json을 걸어 공짜 티저 row에
보상이 나가는 구멍을 막고 등록했다. 정책이 라우트 안에 숨어 있으면
테스트가 못 붙어서 lib/share-reward-kinds.ts로 분리했다."
```

---

### Task 2: 결혼운 — 공개 share 페이지 + 결과 화면 공유 버튼

**Files:**
- Modify (기존 dead code): `lib/share-marriage.ts` — select 축소 후 배선
- Create: `app/marriage/result/share/[id]/page.tsx`
- Create: `app/marriage/result/share/[id]/ShareMarriageClient.tsx`
- Modify: `app/marriage/result/MarriageResultClient.tsx:52, 330-338, 353, 499-510, 512-534`

**Interfaces:**
- Consumes: Task 1의 `SHARE_REWARD_KIND_CHECKS`(런타임 의존 — 이 태스크에서 직접 import하지는 않음), 기존 `components/share/KakaoShareButton`(props: `kind, resultId, shareUrl, title, description, imageUrl, isAuthenticated, onNotice, className?`)
- Produces: `export interface MarriageBlocks`, `MarriageResultBody`에 `shareMode?: boolean` prop 추가. Task 3·4는 동일 구조를 각자 파일에 재현한다(공유 컴포넌트를 새로 만들지 않는 게 이 코드베이스 원칙).

- [ ] **Step 1: Blocks 타입을 export로 연다**

`app/marriage/result/MarriageResultClient.tsx` 52행:

```ts
export interface MarriageBlocks {
```

(기존 `interface MarriageBlocks {` 앞에 `export `만 붙인다. share 페이지가 이 타입을 import해야 한다.)

- [ ] **Step 2: 기존 share 조회 함수의 select를 축소한다**

⚠️ `lib/share-marriage.ts`는 **이미 존재하는 dead code**다. 새로 만들지 말고 아래로 **전체 교체**한다.

기존 파일 상단에는 이전 리뷰가 남긴 경고가 있다 — "게이트 없이 그대로 공개 라우트에 물리면 유료 리포트 전문이 id 추측만으로 새어나간다". 이 태스크가 바로 그 배선을 하는 태스크이므로, **경고가 지적한 노출면을 먼저 줄이고 배선한다**: `name`·`birth_date`·`birth_time`·`gender`·`saju_text`·`source_result_id`(개인 식별정보)를 select에서 전부 뺀다. share 페이지 렌더에 필요 없는 필드다. 대신 Body가 요구하는 `spouse_palace_stability`·`teaser_json`·`created_at`을 추가한다.

```ts
// 결혼운 share 페이지용 — 비로그인 SSR 조회.
//
// user_id로 스코프하지 않는다: 공유 링크는 받은 사람이 열어야 하므로 의도적이다.
// 접근 통제는 "id가 추측 불가능한 UUID"에 기댄다(share-yearly·share-pet-compat와 동일 모델).
//
// ★select 화이트리스트: 결과 화면 렌더에 실제로 쓰이는 컬럼만 뽑는다. name/birth_date/
//  birth_time/gender/saju_text/source_result_id는 링크를 받은 제3자에게 보여줄 이유가 없어
//  의도적으로 제외했다 — 이전 리뷰가 남긴 "유료 리포트 전문이 새어나간다" 경고에 대한 대응이다.
// 결제 전(teaser만 있는) row는 full_json이 null이라 여기서 null로 떨어진다.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedMarriageResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("marriage_results")
    .select(
      "id, marital_status, marriage_grade, spouse_star_type, gwansal_honjap, spouse_star_absent, spouse_palace_stability, teaser_json, full_json, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  if (!(data as any).full_json) return null;
  return data;
});
```

- [ ] **Step 3: `shareMode` prop을 Body에 추가**

`app/marriage/result/MarriageResultClient.tsx` 330~338행의 시그니처를 아래로 교체한다.

```tsx
export function MarriageResultBody({
  data,
  result,
  router,
  shareMode,
}: {
  data: ApiResponse;
  result: MarriageBlocks;
  router: ReturnType<typeof useRouter>;
  /** 공개 share 페이지에서 렌더할 때 — 로그인 전용 동선과 공유 버튼을 감춘다 */
  shareMode?: boolean;
}) {
```

- [ ] **Step 4: 헤더 뒤로가기를 shareMode에서 감춘다**

같은 파일 353행 근처:

```tsx
      <Header showBack={!shareMode} sticky onBack={() => router.push("/menu")} />
```

- [ ] **Step 5: 공유 버튼 컴포넌트를 파일 인라인으로 추가**

파일 맨 아래(`parseAdviceTag` 함수 정의 뒤)에 아래를 추가한다. 이 파일은 이미 `useSession`을 import하고 있으므로 추가 import는 `useCallback`과 `KakaoShareButton` 둘뿐이다.

먼저 1행의 react import에 `useCallback`을 넣는다:

```ts
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
```

그리고 import 블록 끝에 추가:

```ts
import KakaoShareButton from "@/components/share/KakaoShareButton";
```

파일 하단에 컴포넌트 추가:

```tsx
// ────────────────────────────────────────────────────────
// 카카오톡 공유 + 5알 보상. 지급 근거는 "버튼 클릭"이 아니라 카카오 전송 성공 웹훅이라,
// 문구는 KakaoShareButton이 폴링 결과로 넘겨준다 — 여기서는 띄우기만 한다
// (app/result/ResultClient.tsx의 notify 패턴 동일). 공유 컴포넌트 신설 금지 원칙에 따라
// 파일 인라인으로 둔다.
// ────────────────────────────────────────────────────────

function MarriageShareAction({
  resultId,
  marriageGrade,
}: {
  resultId: string;
  marriageGrade: MarriageGrade;
}) {
  const { status } = useSession();
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2600);
  }, []);

  return (
    <div className="px-6 pt-12">
      <KakaoShareButton
        kind="marriage"
        resultId={resultId}
        shareUrl={`https://www.durumisaju.com/marriage/result/share/${resultId}`}
        title={`내 결혼운은 ${marriageGrade}등급`}
        description="두루미가 본 결혼운 심층 검사 결과."
        imageUrl="https://www.durumisaju.com/og-image.png"
        isAuthenticated={status === "authenticated"}
        onNotice={notify}
      />
      {showToast && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-5 py-3 text-[13.5px] font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Body 안에 공유 버튼과 shareMode 분기를 배치**

같은 파일에서 `{/* 재열람 안내 — ... */}` 블록(499행 근처)을 찾아, **그 앞에 공유 버튼을 넣고 재열람 안내를 shareMode에서 감춘다.** 아래 블록으로 통째로 교체한다.

```tsx
        {/* 공유 — 보상 지급은 카카오 전송 성공 웹훅 기준(Phase 2b) */}
        {!shareMode && <MarriageShareAction resultId={data.resultId} marriageGrade={marriageGrade} />}

        {/* 재열람 안내 — 결과는 "내 결과"에 저장돼 언제든 다시 볼 수 있다 */}
        {!shareMode && (
          <div className="px-6 pt-5 text-center">
            <p className="text-[13px] text-text-tertiary">이 결과는 내 결과에서 다시 볼 수 있어</p>
            <button
              type="button"
              onClick={() => router.push("/my/results")}
              className="mt-2 text-[14px] font-semibold text-primary underline underline-offset-4 active:opacity-80"
            >
              내 결과 보러가기
            </button>
          </div>
        )}
```

- [ ] **Step 7: 하단 sticky 액션 바를 shareMode에서 유입 CTA로 바꾼다**

`{/* 하단 sticky 액션 바 */}` 주석으로 시작하는 `<footer>` 블록(512~534행)을 아래로 교체한다.

```tsx
      {/* 하단 sticky 액션 바 — share 페이지에서는 로그인 동선 대신 유입 CTA 하나로
          (yearly share의 FooterSection shareMode 분기와 동일 결) */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          {shareMode ? (
            <a
              href="/marriage"
              className="btn-primary flex-1 h-[54px] rounded-xl text-[15px] font-semibold flex items-center justify-center"
            >
              나도 결혼운 보기
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/marriage/input")}
                className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
              >
                다른 상태로 다시 보기
              </button>
              <button
                type="button"
                onClick={() => router.push("/battle")}
                className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
              >
                궁합 보기
              </button>
            </>
          )}
        </div>
      </footer>
```

- [ ] **Step 8: share 클라이언트 작성**

`app/marriage/result/share/[id]/ShareMarriageClient.tsx` 신규:

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  MarriageResultBody,
  type ApiResponse,
  type MarriageBlocks,
} from "../../MarriageResultClient";

export default function ShareMarriageClient({
  data,
  result,
}: {
  data: ApiResponse;
  result: MarriageBlocks;
}) {
  const router = useRouter();
  return <MarriageResultBody data={data} result={result} router={router} shareMode />;
}
```

- [ ] **Step 9: share 페이지 작성**

`app/marriage/result/share/[id]/page.tsx` 신규:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedMarriageResult } from "@/lib/share-marriage";
import ShareMarriageClient from "./ShareMarriageClient";
import type { ApiResponse, MarriageBlocks } from "../../MarriageResultClient";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await getSharedMarriageResult(id);
  // 없는 id·미결제 티저도 절대 색인되면 안 된다 — 조기 반환에도 robots를 단다
  if (!row) return { title: `결혼운 | ${SITE_NAME}`, robots: { index: false, follow: false } };

  const title = `결혼운 ${row.marriage_grade}등급 — ${row.marital_status}`;
  const description = "두루미가 본 결혼운 심층 검사 결과.";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/marriage/result/share/${id}`,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function ShareMarriagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSharedMarriageResult(id);
  // 결제 전 티저(full_json null)는 공유 링크로도 열리면 안 된다
  if (!row?.full_json) notFound();

  const data: ApiResponse = {
    status: "completed",
    resultId: row.id,
    maritalStatus: row.marital_status,
    marriageGrade: row.marriage_grade,
    spouseStarType: row.spouse_star_type ?? undefined,
    gwansalHonjap: row.gwansal_honjap ?? undefined,
    spouseStarAbsent: row.spouse_star_absent ?? undefined,
    spousePalaceStability: row.spouse_palace_stability ?? undefined,
    result: row.full_json as MarriageBlocks,
    teaser: row.teaser_json ?? null,
    createdAt: row.created_at,
  };

  return <ShareMarriageClient data={data} result={row.full_json as MarriageBlocks} />;
}
```

- [ ] **Step 10: 타입 체크 + 빌드**

```bash
pkill -f "next dev" || true
npx tsc --noEmit && npx next build
```
Expected: 타입 에러 0건, 빌드 성공. 라우트 목록에 `/marriage/result/share/[id]`가 나타난다.

- [ ] **Step 11: 커밋**

```bash
git add lib/share-marriage.ts "app/marriage/result/share" app/marriage/result/MarriageResultClient.tsx
git commit -m "feat(marriage): 결혼운 공유 버튼 + 공개 share 페이지

홈 배너가 '결과마다 공유하면 5알'이라고 약속하는데 결혼운에는 공유 버튼
자체가 없었다. yearly share의 shareMode 분기와 같은 결로 Body를 재사용하고,
결제 전 티저(full_json null)는 share 링크에서도 notFound로 떨군다."
```

---

### Task 3: 재물운 — 공개 share 페이지 + 결과 화면 공유 버튼

**Files:**
- Modify (기존 dead code): `lib/share-wealth.ts` — select 축소 후 배선
- Create: `app/wealth/result/share/[id]/page.tsx`
- Create: `app/wealth/result/share/[id]/ShareWealthClient.tsx`
- Modify: `app/wealth/result/WealthResultClient.tsx:63, 334-342, 357, 510-521, 523-545`

**Interfaces:**
- Consumes: Task 1의 지급 관문 등록(런타임 의존), `components/share/KakaoShareButton`
- Produces: `export interface WealthBlocks`, `WealthResultBody`에 `shareMode?: boolean`

- [ ] **Step 1: Blocks 타입을 export로 연다**

`app/wealth/result/WealthResultClient.tsx` 63행:

```ts
export interface WealthBlocks {
```

- [ ] **Step 2: 기존 share 조회 함수의 select를 축소한다**

⚠️ `lib/share-wealth.ts`는 **이미 존재하는 dead code**다. 새로 만들지 말고 아래로 **전체 교체**한다. `name`·`birth_date`·`gender`·`saju_text`·`source_result_id`(개인 식별정보)를 select에서 빼고, Body가 요구하는 `teaser_json`·`created_at`을 추가한다.

```ts
// 재물운 share 페이지용 — 비로그인 SSR 조회.
//
// user_id로 스코프하지 않는다: 공유 링크는 받은 사람이 열어야 하므로 의도적이다.
// 접근 통제는 "id가 추측 불가능한 UUID"에 기댄다(share-yearly·share-pet-compat와 동일 모델).
//
// ★select 화이트리스트: 결과 화면 렌더에 실제로 쓰이는 컬럼만 뽑는다. name/birth_date/
//  gender/saju_text/source_result_id는 링크를 받은 제3자에게 보여줄 이유가 없어 제외했다.
// 결제 전(teaser만 있는) row는 full_json이 null이라 여기서 null로 떨어진다.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedWealthResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("wealth_results")
    .select(
      "id, interest, wealth_grade, jaeseong_type, jaeda_shinyak, sikssang_saengjae, gunggeob_jaengjae, jae_grip, teaser_json, full_json, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  if (!(data as any).full_json) return null;
  return data;
});
```

- [ ] **Step 3: `shareMode` prop을 Body에 추가**

`app/wealth/result/WealthResultClient.tsx` 334행부터의 시그니처를 교체한다.

```tsx
export function WealthResultBody({
  data,
  result,
  router,
  shareMode,
}: {
  data: ApiResponse;
  result: WealthBlocks;
  router: ReturnType<typeof useRouter>;
  /** 공개 share 페이지에서 렌더할 때 — 로그인 전용 동선과 공유 버튼을 감춘다 */
  shareMode?: boolean;
}) {
```

- [ ] **Step 4: 헤더 뒤로가기를 shareMode에서 감춘다**

같은 파일에서 `<Header showBack sticky onBack={() => router.push("/menu")} />` 를 찾아 교체:

```tsx
      <Header showBack={!shareMode} sticky onBack={() => router.push("/menu")} />
```

- [ ] **Step 5: 공유 버튼 컴포넌트를 파일 인라인으로 추가**

1행 react import에 `useCallback`을 넣는다:

```ts
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
```

import 블록 끝에 추가:

```ts
import KakaoShareButton from "@/components/share/KakaoShareButton";
```

파일 맨 아래에 추가:

```tsx
// ────────────────────────────────────────────────────────
// 카카오톡 공유 + 5알 보상. 지급 근거는 "버튼 클릭"이 아니라 카카오 전송 성공 웹훅이라,
// 문구는 KakaoShareButton이 폴링 결과로 넘겨준다 — 여기서는 띄우기만 한다
// (app/result/ResultClient.tsx의 notify 패턴 동일). 공유 컴포넌트 신설 금지 원칙에 따라
// 파일 인라인으로 둔다.
// ────────────────────────────────────────────────────────

function WealthShareAction({
  resultId,
  wealthGrade,
}: {
  resultId: string;
  wealthGrade: WealthGrade;
}) {
  const { status } = useSession();
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2600);
  }, []);

  return (
    <div className="px-6 pt-12">
      <KakaoShareButton
        kind="wealth"
        resultId={resultId}
        shareUrl={`https://www.durumisaju.com/wealth/result/share/${resultId}`}
        title={`내 재물운은 ${wealthGrade}등급`}
        description="두루미가 본 재물운 심층 검사 결과."
        imageUrl="https://www.durumisaju.com/og-image.png"
        isAuthenticated={status === "authenticated"}
        onNotice={notify}
      />
      {showToast && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-5 py-3 text-[13.5px] font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Body 안에 공유 버튼과 shareMode 분기를 배치**

`{/* 재열람 안내 — ... */}` 블록(510행 근처)을 아래로 통째 교체한다.

```tsx
        {/* 공유 — 보상 지급은 카카오 전송 성공 웹훅 기준(Phase 2b) */}
        {!shareMode && <WealthShareAction resultId={data.resultId} wealthGrade={wealthGrade} />}

        {/* 재열람 안내 — 결과는 "내 결과"에 저장돼 언제든 다시 볼 수 있다 */}
        {!shareMode && (
          <div className="px-6 pt-5 text-center">
            <p className="text-[13px] text-text-tertiary">이 결과는 내 결과에서 다시 볼 수 있어</p>
            <button
              type="button"
              onClick={() => router.push("/my/results")}
              className="mt-2 text-[14px] font-semibold text-primary underline underline-offset-4 active:opacity-80"
            >
              내 결과 보러가기
            </button>
          </div>
        )}
```

- [ ] **Step 7: 하단 sticky 액션 바를 shareMode에서 유입 CTA로 바꾼다**

`{/* 하단 sticky 액션 바 */}` 주석으로 시작하는 `<footer>` 블록(523행 근처)을 아래로 통째 교체한다.

```tsx
      {/* 하단 sticky 액션 바 — share 페이지에서는 로그인 동선 대신 유입 CTA 하나로
          (yearly share의 FooterSection shareMode 분기와 동일 결) */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          {shareMode ? (
            <a
              href="/wealth"
              className="btn-primary flex-1 h-[54px] rounded-xl text-[15px] font-semibold flex items-center justify-center"
            >
              나도 재물운 보기
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/wealth/input")}
                className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
              >
                다른 관심사로 다시 보기
              </button>
              <button
                type="button"
                onClick={() => router.push("/yearly")}
                className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
              >
                올해 재물 흐름 보기
              </button>
            </>
          )}
        </div>
      </footer>
```

- [ ] **Step 8: share 클라이언트 작성**

`app/wealth/result/share/[id]/ShareWealthClient.tsx` 신규:

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  WealthResultBody,
  type ApiResponse,
  type WealthBlocks,
} from "../../WealthResultClient";

export default function ShareWealthClient({
  data,
  result,
}: {
  data: ApiResponse;
  result: WealthBlocks;
}) {
  const router = useRouter();
  return <WealthResultBody data={data} result={result} router={router} shareMode />;
}
```

- [ ] **Step 9: share 페이지 작성**

`app/wealth/result/share/[id]/page.tsx` 신규:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedWealthResult } from "@/lib/share-wealth";
import ShareWealthClient from "./ShareWealthClient";
import type { ApiResponse, WealthBlocks } from "../../WealthResultClient";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await getSharedWealthResult(id);
  // 없는 id·미결제 티저도 절대 색인되면 안 된다 — 조기 반환에도 robots를 단다
  if (!row) return { title: `재물운 | ${SITE_NAME}`, robots: { index: false, follow: false } };

  const title = `재물운 ${row.wealth_grade}등급`;
  const description = "두루미가 본 재물운 심층 검사 결과.";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/wealth/result/share/${id}`,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function ShareWealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSharedWealthResult(id);
  // 결제 전 티저(full_json null)는 공유 링크로도 열리면 안 된다
  if (!row?.full_json) notFound();

  const data: ApiResponse = {
    status: "completed",
    resultId: row.id,
    interest: row.interest,
    wealthGrade: row.wealth_grade,
    jaeseongType: row.jaeseong_type ?? undefined,
    jaedaShinyak: row.jaeda_shinyak ?? undefined,
    sikssangSaengjae: row.sikssang_saengjae ?? undefined,
    gunggeobJaengjae: row.gunggeob_jaengjae ?? undefined,
    jaeGrip: row.jae_grip ?? undefined,
    result: row.full_json as WealthBlocks,
    teaser: row.teaser_json ?? null,
    createdAt: row.created_at,
  };

  return <ShareWealthClient data={data} result={row.full_json as WealthBlocks} />;
}
```

- [ ] **Step 10: 타입 체크 + 빌드**

```bash
pkill -f "next dev" || true
npx tsc --noEmit && npx next build
```
Expected: 타입 에러 0건, 라우트 목록에 `/wealth/result/share/[id]` 등장.

- [ ] **Step 11: 커밋**

```bash
git add lib/share-wealth.ts "app/wealth/result/share" app/wealth/result/WealthResultClient.tsx
git commit -m "feat(wealth): 재물운 공유 버튼 + 공개 share 페이지

결혼운과 같은 이유 — 배너가 약속한 5알이 재물운에서는 버튼조차 없었다.
marriage Phase 2b와 동일 구조(Body shareMode 재사용 + 티저 notFound)."
```

---

### Task 4: 커리어운 — 공개 share 페이지 + 결과 화면 공유 버튼

**Files:**
- Modify (기존 dead code): `lib/share-career.ts` — select 축소 후 배선
- Create: `app/career/result/share/[id]/page.tsx`
- Create: `app/career/result/share/[id]/ShareCareerClient.tsx`
- Modify: `app/career/result/CareerResultClient.tsx:62, 333-341, 356, 509-520, 522-544`

**Interfaces:**
- Consumes: Task 1의 지급 관문 등록(런타임 의존), `components/share/KakaoShareButton`
- Produces: `export interface CareerBlocks`, `CareerResultBody`에 `shareMode?: boolean`

- [ ] **Step 1: Blocks 타입을 export로 연다**

`app/career/result/CareerResultClient.tsx` 62행:

```ts
export interface CareerBlocks {
```

- [ ] **Step 2: 기존 share 조회 함수의 select를 축소한다**

⚠️ `lib/share-career.ts`는 **이미 존재하는 dead code**다. 새로 만들지 말고 아래로 **전체 교체**한다. `name`·`birth_date`·`gender`·`saju_text`·`source_result_id`(개인 식별정보)를 select에서 빼고, Body가 요구하는 `teaser_json`·`created_at`을 추가한다.

```ts
// 커리어운 share 페이지용 — 비로그인 SSR 조회.
//
// user_id로 스코프하지 않는다: 공유 링크는 받은 사람이 열어야 하므로 의도적이다.
// 접근 통제는 "id가 추측 불가능한 UUID"에 기댄다(share-yearly·share-pet-compat와 동일 모델).
//
// ★select 화이트리스트: 결과 화면 렌더에 실제로 쓰이는 컬럼만 뽑는다. name/birth_date/
//  gender/saju_text/source_result_id는 링크를 받은 제3자에게 보여줄 이유가 없어 제외했다.
// 결제 전(teaser만 있는) row는 full_json이 null이라 여기서 null로 떨어진다.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const getSharedCareerResult = cache(async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("career_results")
    .select(
      "id, situation, career_grade, gwanseong_type, gwanda_sinyak, gwanin_sangsaeng, sanggwan_gyeongwan, career_grip, teaser_json, full_json, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  if (!(data as any).full_json) return null;
  return data;
});
```

- [ ] **Step 3: `shareMode` prop을 Body에 추가**

`app/career/result/CareerResultClient.tsx` 333행부터의 시그니처를 교체한다.

```tsx
export function CareerResultBody({
  data,
  result,
  router,
  shareMode,
}: {
  data: ApiResponse;
  result: CareerBlocks;
  router: ReturnType<typeof useRouter>;
  /** 공개 share 페이지에서 렌더할 때 — 로그인 전용 동선과 공유 버튼을 감춘다 */
  shareMode?: boolean;
}) {
```

- [ ] **Step 4: 헤더 뒤로가기를 shareMode에서 감춘다**

```tsx
      <Header showBack={!shareMode} sticky onBack={() => router.push("/menu")} />
```

- [ ] **Step 5: 공유 버튼 컴포넌트를 파일 인라인으로 추가**

1행 react import에 `useCallback`을 넣는다:

```ts
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
```

import 블록 끝에 추가:

```ts
import KakaoShareButton from "@/components/share/KakaoShareButton";
```

파일 맨 아래에 추가:

```tsx
// ────────────────────────────────────────────────────────
// 카카오톡 공유 + 5알 보상. 지급 근거는 "버튼 클릭"이 아니라 카카오 전송 성공 웹훅이라,
// 문구는 KakaoShareButton이 폴링 결과로 넘겨준다 — 여기서는 띄우기만 한다
// (app/result/ResultClient.tsx의 notify 패턴 동일). 공유 컴포넌트 신설 금지 원칙에 따라
// 파일 인라인으로 둔다.
// ────────────────────────────────────────────────────────

function CareerShareAction({
  resultId,
  careerGrade,
}: {
  resultId: string;
  careerGrade: CareerGrade;
}) {
  const { status } = useSession();
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2600);
  }, []);

  return (
    <div className="px-6 pt-12">
      <KakaoShareButton
        kind="career"
        resultId={resultId}
        shareUrl={`https://www.durumisaju.com/career/result/share/${resultId}`}
        title={`내 커리어운은 ${careerGrade}등급`}
        description="두루미가 본 커리어운 심층 검사 결과."
        imageUrl="https://www.durumisaju.com/og-image.png"
        isAuthenticated={status === "authenticated"}
        onNotice={notify}
      />
      {showToast && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-5 py-3 text-[13.5px] font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Body 안에 공유 버튼과 shareMode 분기를 배치**

**먼저** `{/* ⑤ 올해의 운세(yearly) CTA */}` 주석으로 시작하는 `<Reveal>` 블록(472행 근처)을 `shareMode`로 감싼다. 공개 share 페이지에는 유입 CTA 하나만 남아야 하는데, 이 블록은 비로그인 방문자를 `/yearly`(로그인 벽이 있는 유료 상품)로 보낸다. `<Reveal>` 여는 태그 앞에 `{!shareMode && (` 를, 닫는 `</Reveal>` 뒤에 `)}` 를 넣어 블록 전체를 감싼다. 내부 JSX는 수정하지 않는다.

```tsx
        {/* ⑤ 올해의 운세(yearly) CTA — share 페이지에서는 감춘다(유입 CTA는 하단 하나만) */}
        {!shareMode && (
          <Reveal>
            {/* ↑ 기존 <Reveal>…</Reveal> 블록 내부는 그대로 둔다 */}
          </Reveal>
        )}
```

**그 다음** `{/* 재열람 안내 — ... */}` 블록(509행 근처)을 아래로 통째 교체한다.

```tsx
        {/* 공유 — 보상 지급은 카카오 전송 성공 웹훅 기준(Phase 2b) */}
        {!shareMode && <CareerShareAction resultId={data.resultId} careerGrade={careerGrade} />}

        {/* 재열람 안내 — 결과는 "내 결과"에 저장돼 언제든 다시 볼 수 있다 */}
        {!shareMode && (
          <div className="px-6 pt-5 text-center">
            <p className="text-[13px] text-text-tertiary">이 결과는 내 결과에서 다시 볼 수 있어</p>
            <button
              type="button"
              onClick={() => router.push("/my/results")}
              className="mt-2 text-[14px] font-semibold text-primary underline underline-offset-4 active:opacity-80"
            >
              내 결과 보러가기
            </button>
          </div>
        )}
```

- [ ] **Step 7: 하단 sticky 액션 바를 shareMode에서 유입 CTA로 바꾼다**

`{/* 하단 sticky 액션 바 */}` 주석으로 시작하는 `<footer>` 블록(522행 근처)을 아래로 통째 교체한다.

```tsx
      {/* 하단 sticky 액션 바 — share 페이지에서는 로그인 동선 대신 유입 CTA 하나로
          (yearly share의 FooterSection shareMode 분기와 동일 결) */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          {shareMode ? (
            <a
              href="/career"
              className="btn-primary flex-1 h-[54px] rounded-xl text-[15px] font-semibold flex items-center justify-center"
            >
              나도 커리어운 보기
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/career/input")}
                className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
              >
                다른 고민으로 다시 보기
              </button>
              <button
                type="button"
                onClick={() => router.push("/yearly")}
                className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
              >
                올해 일의 흐름 보기
              </button>
            </>
          )}
        </div>
      </footer>
```

- [ ] **Step 8: share 클라이언트 작성**

`app/career/result/share/[id]/ShareCareerClient.tsx` 신규:

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  CareerResultBody,
  type ApiResponse,
  type CareerBlocks,
} from "../../CareerResultClient";

export default function ShareCareerClient({
  data,
  result,
}: {
  data: ApiResponse;
  result: CareerBlocks;
}) {
  const router = useRouter();
  return <CareerResultBody data={data} result={result} router={router} shareMode />;
}
```

- [ ] **Step 9: share 페이지 작성**

`app/career/result/share/[id]/page.tsx` 신규:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedCareerResult } from "@/lib/share-career";
import ShareCareerClient from "./ShareCareerClient";
import type { ApiResponse, CareerBlocks } from "../../CareerResultClient";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await getSharedCareerResult(id);
  // 없는 id·미결제 티저도 절대 색인되면 안 된다 — 조기 반환에도 robots를 단다
  if (!row) return { title: `커리어운 | ${SITE_NAME}`, robots: { index: false, follow: false } };

  const title = `커리어운 ${row.career_grade}등급`;
  const description = "두루미가 본 커리어운 심층 검사 결과.";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/career/result/share/${id}`,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function ShareCareerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSharedCareerResult(id);
  // 결제 전 티저(full_json null)는 공유 링크로도 열리면 안 된다
  if (!row?.full_json) notFound();

  const data: ApiResponse = {
    status: "completed",
    resultId: row.id,
    situation: row.situation,
    careerGrade: row.career_grade,
    gwanseongType: row.gwanseong_type ?? undefined,
    gwandaSinyak: row.gwanda_sinyak ?? undefined,
    gwaninSangsaeng: row.gwanin_sangsaeng ?? undefined,
    sanggwanGyeongwan: row.sanggwan_gyeongwan ?? undefined,
    careerGrip: row.career_grip ?? undefined,
    result: row.full_json as CareerBlocks,
    teaser: row.teaser_json ?? null,
    createdAt: row.created_at,
  };

  return <ShareCareerClient data={data} result={row.full_json as CareerBlocks} />;
}
```

- [ ] **Step 10: 타입 체크 + 빌드**

```bash
pkill -f "next dev" || true
npx tsc --noEmit && npx next build
```
Expected: 타입 에러 0건, 라우트 목록에 `/career/result/share/[id]` 등장.

- [ ] **Step 11: 커밋**

```bash
git add lib/share-career.ts "app/career/result/share" app/career/result/CareerResultClient.tsx
git commit -m "feat(career): 커리어운 공유 버튼 + 공개 share 페이지

marriage/wealth Phase 2b와 동일 구조. 이걸로 SHARE_REWARD_KINDS 7종이
모두 실제 공유 동선을 갖춰 홈 배너의 '결과마다'가 사실이 된다."
```

---

### Task 5: 전수 검증 + PR

**Files:**
- Modify (조건부): `components/ShareRewardBanner.tsx:10`
- Test: 수동 QA (카카오 전송은 자동화 불가)

**Interfaces:**
- Consumes: Task 1~4 전부

- [ ] **Step 1: 전체 테스트 + 빌드**

```bash
cd ~/projects/durumi-saju
pkill -f "next dev" || true
npm test && npx tsc --noEmit && npx next build
```
Expected: 테스트 전부 PASS, 타입 에러 0, 빌드 성공.

- [ ] **Step 2: 7종 kind가 코드 전 구간에서 정합한지 대조**

```bash
grep -o "'[a-z]*'" supabase/migrations/20260728_share_kakao_reward.sql | sort -u | head -20
grep -n "SHARE_REWARD_KINDS" -A 10 lib/constants/share-reward.ts
grep -n "kind=\"" app/result/ResultClient.tsx app/yearly/result/\[id\]/YearlyResultClient.tsx app/pet/result/PetResultClient.tsx app/marriage/result/MarriageResultClient.tsx app/wealth/result/WealthResultClient.tsx app/career/result/CareerResultClient.tsx
```
Expected: DB CHECK 7종 = `SHARE_REWARD_KINDS` 7종 = `SHARE_REWARD_KIND_CHECKS` 7종. 결과 화면에 걸린 `kind=` 값이 각 라인과 일치(battle은 `components/battle/BattleResultView.tsx` 경유이므로 별도 확인).

- [ ] **Step 3: 배너 문구 확인**

`components/ShareRewardBanner.tsx:10` 이 "결과마다 카카오톡으로 공유하면 5알 선물"이다. Task 4까지 끝나면 `today`를 제외한 전 라인에 공유 버튼이 생기므로 이 문구는 참이 된다. `today` 결과 화면에 공유 버튼이 없는지 확인한다.

```bash
grep -rn "KakaoShareButton" app/today/ || echo "today에 공유 버튼 없음 — 문구 수정 불필요"
```
Expected: "today에 공유 버튼 없음". 만약 있다면 배너 문구를 "오늘의 운세 제외"가 드러나게 고친다.

- [ ] **Step 4: 수동 QA 체크리스트 (Vercel 프리뷰에서)**

PR을 열면 Vercel 프리뷰 URL이 생긴다. 아래를 직접 확인한다 — 카카오 전송 웹훅은 자동화할 수 없다.

1. 결혼운 결과 화면에 "카카오톡으로 공유하고 5알 받기" 버튼이 보인다
2. 공유 → 친구에게 전송 → 몇 초 뒤 "공유 완료! 5알이 들어왔어요 🎁" 토스트가 뜬다
3. `/coins` 내역에 `공유` 항목으로 +5알이 찍힌다
4. 같은 라인을 두 번째 공유하면 5알이 **다시 나가지 않고** 버튼 라벨이 "카카오톡으로 공유하기"로 바뀐다
5. 받은 공유 링크를 **로그아웃 상태**로 열면 결과가 보이고, 하단에 "나도 결혼운 보기" 버튼 하나만 있다(뒤로가기·내 결과 없음)
6. 결제 전 티저 결과의 id로 `/marriage/result/share/<id>` 를 열면 404
7. 재물운·커리어운도 1~6 동일하게 확인

- [ ] **Step 5: PR 생성**

```bash
git push -u origin feat/share-reward-phase2b
gh pr create --title "feat(share-reward): Phase 2b — 결혼운·재물운·커리어운 공유 보상" --body "$(cat <<'EOF'
## 왜

홈 배너(`ShareRewardBanner`)가 "결과마다 카카오톡으로 공유하면 5알"이라고 약속하는데,
결혼운·재물운·커리어운 세 라인은 공유 버튼조차 없었다. 유료로 산 사람이 배너를 보고
공유하려다 버튼을 못 찾는 상태였고, `prepare` 라우트의 `KIND_CHECKS`에도 미등록이라
설령 호출해도 400이 났다.

## 무엇

- `KIND_CHECKS`를 `lib/share-reward-kinds.ts`로 분리(라우트 안에 있으면 테스트가 안 붙는다) + 3종 등록
- 세 라인 모두 `requireNonNull: "full_json"` — 결제 전 티저 row로 5알이 나가는 구멍 차단
- 공개 share 라우트 3개 신설. `*ResultBody`에 `shareMode`를 추가해 yearly share와 같은 결로 재사용
- 결과 화면에 기존 공용 `KakaoShareButton` 배치

## 안 한 것

- DB 마이그레이션 없음 — `share_reward_grants`/`share_kakao_nonces`의 CHECK가 이미 7종을 허용
- `SCORING_VERSION` 무변경

## 검증

- `npm test` / `npx tsc --noEmit` / `npx next build` 통과
- 수동 QA 7항목은 플랜 Task 5 Step 4 참조

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: 머지 대기**

main 머지·배포는 운영자 명시 허용 전까지 하지 않는다. PR 링크를 보고하고 멈춘다.
