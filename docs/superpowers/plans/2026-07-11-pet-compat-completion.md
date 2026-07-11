# 반려동물 궁합 완성·출시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 봉인 중인 반려동물 궁합 v0.9를 현재 main 구조(charge-orders 신결제·등급 SS 표기)에 맞춰 완성하고 출시 가능한 PR 상태로 만든다.

**Architecture:** `feat/pet-resume` 브랜치(v0.9 펫 코드가 구 main 위에 포팅됨)를 현재 main으로 리베이스 → 끊어진 결제 파이프라인(`/api/coins/spend`에 pet 타입 없음, checkout에 pet 분기 없음)을 배틀 패턴으로 복구 → 등급 컷을 사주 마스터 컷(85/80/70/52)에 동기화(★2026-05-24 운영자 결정) → 인프라(마이그레이션 3개·버킷 2개) 정리 → 메뉴 카드 활성화 → PR.

**Tech Stack:** Next.js 15 + React 18 + TypeScript, Gemini API(텍스트 + 이미지), Supabase(PostgreSQL + Storage), Zustand, Tailwind. **Claude API 아님.**

## Global Constraints

- 작업 위치: `~/projects/durumi-saju-pet` 워크트리, 브랜치 `feat/pet-resume` (본 repo `~/projects/durumi-saju`는 main — 건드리지 말 것)
- LLM은 Gemini API (`@google/generative-ai`) — Claude API로 착각 금지
- `PET_COMPAT_SCORING_VERSION` 2 → **3** (점수 로직 변경 시 반드시 bump — DB 캐시 무효화)
- 등급 DB 저장값은 `S/A/B/C/D` 유지, **화면 표기만** `displayGrade()`로 SS/S/A/B/C (사주와 동일 체계)
- 카피에 "무료" 주장 금지 (가입 보너스 2026-06-21 종료)
- API 에러 응답에 `error.message` 노출 금지 — 일반 한국어 메시지만, 상세는 `console.error`
- dev 서버 돌 때 `npx next build` 실행 금지 (.next 청크 충돌)
- 유료 생성(Gemini 이미지 일러스트 테스트)은 **운영자 승인 후 실행**
- main 머지·프로덕션 배포·프로덕션 DDL은 **운영자 명시 승인 후에만**
- 가격: 정상가 20알(배틀과 동일) / 출시 할인 10알. 표기 "🥚 ~~20알~~ 10알"

## 실측된 현재 상태 (2026-07-11, 이 계획의 전제)

| 항목 | 상태 |
|---|---|
| `feat/pet-resume` (d31f363) | 펫 파일 26개 전부 신규로 얹힘. base `ebd68a2` = origin/main보다 **61커밋 뒤** |
| `/api/coins/spend` | `"analysis" \| "battle"`만 지원 — **pet 타입 없음 (결제 끊김)** |
| `app/checkout/page.tsx` | pet 분기 없음. `/pet/input`은 `/checkout?type=pet`으로 push하지만 checkout이 모름 |
| 펫 등급 컷 | `lib/pet-compat-scoring.ts` 자체 컷 S80/A65/B45/C25 — 사주 컷(85/80/70/52)과 불일치 |
| 등급 표기 | `{data.label_grade}등급` 그대로 — 사주는 `displayGrade()`로 SS 표기 중 |
| Supabase Storage | 버킷 **0개** (`pet-uploads`, `pet-illustrations` 미생성) |
| DB 마이그레이션 | `pet_compat_results.loyalty_score` **없음(insert 실패 블로커)**, `pet_profiles.coat_color`·`neutered` 잔존 |
| middleware | pet 봉인 없음 (main에 pet 코드 자체가 없어 자연 봉인). 유일한 노출 = 메뉴 "준비중" 카드 |
| `/api/pet-compat/analyze` | sessionId(+optional orderId) 받아 status='consumed' 세션에서 분석. 일러스트는 실패해도 진행 |

---

### Task 1: 브랜치 최신화 (origin/main 리베이스)

**Files:**
- Modify: (없음 — git 작업)
- 신규 커밋: `scripts/check-pet-db-state.mts` (이미 working tree에 있음)

**Interfaces:**
- Produces: origin/main 최신 + 펫 커밋 1개가 얹힌 `feat/pet-resume`. 이후 모든 태스크의 베이스.

- [ ] **Step 1: 상태 확인 후 리베이스**

```bash
cd ~/projects/durumi-saju-pet
git status --short          # check-pet-db-state.mts만 untracked여야 함
git add scripts/check-pet-db-state.mts
git commit -m "chore(pet): DB·버킷 사전점검 스크립트 추가

재개 시 마이그레이션/버킷 상태를 실측하기 위함 (읽기 전용)"
git fetch origin
git rebase origin/main
```

Expected: 펫 파일은 전부 신규라 충돌 없이 완료. 충돌 시 pet 쪽 파일은 ours, 공용 파일(package.json 등)은 main 쪽 우선으로 해소.

- [ ] **Step 2: 빌드·타입 검증**

```bash
npx tsc --noEmit && npx next build
```

Expected: 둘 다 PASS. 실패 시 리베이스로 깨진 import를 이 태스크 안에서 수정 후 `git commit --amend` 아닌 별도 fixup 커밋.

---

### Task 2: 가격 상수 + `/api/coins/spend` pet 타입

**Files:**
- Modify: `lib/constants/coins.ts`
- Modify: `app/api/coins/spend/route.ts`

**Interfaces:**
- Consumes: `prepayment_sessions.payload = { pet, owner }` (pet intake가 저장하는 형태)
- Produces: `POST /api/coins/spend { sessionId, type: "pet" }` → `{ ok: true, type: "pet", orderId: string, balance: number }`. Task 3의 checkout이 이 `orderId`를 analyze에 전달.

- [ ] **Step 1: 가격 상수 추가** — `lib/constants/coins.ts` 끝에:

```ts
export const PET_COMPAT_COST = 20;        // 반려동물 궁합 정상가 (배틀과 동일 — 2 entity)
export const PET_COMPAT_LAUNCH_COST = 10; // 출시 할인가 (기간 미표기, 추후 조용히 정상가 복귀)
```

- [ ] **Step 2: spend 라우트에 pet 분기** — `app/api/coins/spend/route.ts`:

import 수정:
```ts
import { SAJU_COST, BATTLE_COST, PET_COMPAT_LAUNCH_COST } from "@/lib/constants/coins";
```

타입·cost 수정 (기존 `type: "analysis" | "battle"` / `const cost = isBattle ? ...` 대체):
```ts
type SpendBody = {
  sessionId: string;
  type: "analysis" | "battle" | "pet";
};
// ...
const isBattle = body.type === "battle";
const isPet = body.type === "pet";
const cost = isPet ? PET_COMPAT_LAUNCH_COST : isBattle ? BATTLE_COST : SAJU_COST;
```

입력 검증 — 기존 `if (isBattle) {...} else if (!hasRequiredInput(input))` 블록 앞에 pet 분기 추가:
```ts
if (isPet) {
  const petPayload = sessionRow.payload as {
    pet?: { name?: string; species?: string; birthTier?: number };
    owner?: { birthYear?: string; gender?: string };
  };
  if (
    !petPayload?.pet?.name || !petPayload?.pet?.species || !petPayload?.pet?.birthTier ||
    !petPayload?.owner?.birthYear || !petPayload?.owner?.gender
  ) {
    return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
  }
} else if (isBattle) {
  // (기존 배틀 검증 그대로)
```

차감 후 분기 — 기존 `if (isBattle) { ... }` 배틀 블록 **앞**에 (배틀과 동일 패턴, 차감만 하고 분석은 analyze가):
```ts
// ============ 펫 궁합: 알 차감만, 분석은 /api/pet-compat/analyze ============
if (isPet) {
  const orderId = `egg_pet_${Date.now()}_${userId.slice(0, 8)}`;
  await supabaseAdmin
    .from("payment_transactions")
    .upsert(
      { user_id: userId, order_id: orderId, method: "egg", amount: 0, status: "success" },
      { onConflict: "order_id", ignoreDuplicates: true }
    );
  await markSessionConsumed(body.sessionId, userId);
  return NextResponse.json({
    ok: true,
    type: "pet",
    orderId,
    balance: spendResult.new_balance,
  });
}
```

주의: `const input = sessionRow.payload as InputPayload;`는 pet일 때 사용되지 않지만 그대로 둔다 (사주/배틀 경로 공유).

- [ ] **Step 3: 타입 검증**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add lib/constants/coins.ts app/api/coins/spend/route.ts
git commit -m "feat(pet): coins/spend에 pet 타입 추가 — 배틀 패턴 차감-only 분기

포팅 과정에서 신결제 구조(spend)와 펫 플로우가 끊겨 있었음.
배틀과 동일하게 차감만 하고 분석은 /api/pet-compat/analyze가 수행.
출시가 10알(PET_COMPAT_LAUNCH_COST), 정상가 20알."
```

---

### Task 3: checkout 페이지 pet 분기

**Files:**
- Modify: `app/checkout/page.tsx` (742줄 — 아래 앵커 기준)

**Interfaces:**
- Consumes: `usePetCompatStore`의 `owner`/`pet`, `hasPetCompatHydrated()` (`store/usePetCompatStore.ts`), `POST /api/pet-compat/intake/session { pet, owner } → { sessionId }`, Task 2의 spend 응답 `orderId`
- Produces: `/checkout?type=pet` 완전 동작 → 성공 시 `router.replace("/pet/result?id=<resultId>")` (PetResultClient는 `?id=`로 fetch — 확인됨)

- [ ] **Step 1: 타입·상수·스토어 연결** (파일 상단 및 91~93행 앵커):

```ts
import { usePetCompatStore, hasPetCompatHydrated } from "@/store/usePetCompatStore";
import { SAJU_COST, BATTLE_COST, PET_COMPAT_COST, PET_COMPAT_LAUNCH_COST } from "@/lib/constants/coins";

type CheckoutType = "analysis" | "battle" | "pet";
// ...
const petStore = usePetCompatStore();
const checkoutType: CheckoutType = (searchParams?.get("type") as CheckoutType) || "analysis";
const isBattle = checkoutType === "battle";
const isPet = checkoutType === "pet";
const eggCost = isPet ? PET_COMPAT_LAUNCH_COST : isBattle ? BATTLE_COST : SAJU_COST;
```

- [ ] **Step 2: hasRequiredInput pet 분기** (useMemo 최상단에 추가):

```ts
if (isPet) {
  const { pet, owner } = petStore;
  if (!pet.name?.trim() || !pet.species || !pet.birthTier) return false;
  if (pet.birthTier === 1 && (!pet.birthDate || !pet.birthTime)) return false;
  if (pet.birthTier === 2 && !pet.birthDate) return false;
  if (pet.birthTier === 3 && !pet.birthYearEstimated) return false;
  if (pet.birthTier === 4 && !pet.adoptionDate) return false;
  if (!owner.name?.trim() || !owner.birthYear || !owner.birthMonth || !owner.birthDay || !owner.birthLocation || !owner.gender) return false;
  if (!owner.unknownBirthTime && (!owner.birthHour || owner.birthMinute === "")) return false;
  return true;
}
```
deps 배열에 `petStore.pet, petStore.owner, isPet` 추가.

- [ ] **Step 3: redirectBack·hydration**:

```ts
const redirectBack = isPet ? "/pet/input" : isBattle ? "/battle/input" : "/start";
```
hydration 체크 `checkBoth()`에 `hasPetCompatHydrated()` 추가, `usePetCompatStore.persist.onFinishHydration` 구독 추가.

- [ ] **Step 4: 세션 생성 pet 분기** (CheckoutForm의 createSession — `/api/intake/session` fetch를 조건 분기):

```ts
const endpoint = isPet ? "/api/pet-compat/intake/session" : "/api/intake/session";
const sessionBody = isPet
  ? { pet: petStore.pet, owner: petStore.owner }
  : isBattle
  ? { /* 기존 배틀 body 그대로 */ }
  : inputs;
const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sessionBody) });
```
CheckoutForm props에 `petStore`, `isPet` 전달 (기존 `battleStore`, `isBattle`과 동일하게).

- [ ] **Step 5: executeSpend pet 분기** (spend fetch의 `type`과 성공 후 처리):

```ts
body: JSON.stringify({ sessionId, type: isPet ? "pet" : isBattle ? "battle" : "analysis" }),
```

성공 후 — 배틀 블록 앞에:
```ts
if (isPet) {
  setConfirming(true);
  setPaying(false);
  const analyzeRes = await fetch("/api/pet-compat/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, orderId: data.orderId }),
  });
  if (!analyzeRes.ok) {
    const errData = await analyzeRes.json().catch(() => ({}));
    throw new Error(errData?.error || "궁합 분석이 안 됐어. 다시 해볼까?");
  }
  const analyzeData = await analyzeRes.json();
  router.replace(`/pet/result?id=${analyzeData.resultId}`);
  return;
}
```

- [ ] **Step 6: 결제 UI 표기** — 상품명/가격 영역에서 `isPet`이면 상품명 "반려동물 궁합", 가격 `🥚 ~~20알~~ 10알` (취소선 `line-through` + 강조는 기존 checkout 톤 그대로), 배틀 전용 사주 태그(`getQuickSajuTags`)는 `isBattle`일 때만 유지. **"무료" 문구 금지.**

- [ ] **Step 7: 검증 + 커밋**

```bash
npx tsc --noEmit && npx next build
git add app/checkout/page.tsx
git commit -m "feat(pet): checkout에 pet 타입 분기 — intake/spend/analyze 연결

/pet/input → /checkout?type=pet → spend(pet) → pet-compat/analyze → /pet/result?id=
배틀과 동일한 차감 후 분석 패턴. 출시가 10알 표기(정상가 20알 취소선)."
```

---

### Task 4: 등급 컷 사주 동기화 (composite remap, SCORING_VERSION 3)

**Files:**
- Modify: `lib/pet-compat-scoring.ts` (compositeToGrade 98~107행, computeComposite 293행 부근, SCORING_VERSION 13행)
- Create: `scripts/pet-compat-grade-dist.mts`

**Interfaces:**
- Consumes: `COMPOSITE_GRADE_CUTOFFS` (`lib/gradeSystem.ts` — S85/A80/B70/C52)
- Produces: composite가 사주 스케일로 remap된 점수. 등급 인구 분포는 검증된 v2와 동일하게 보존.

**설계 근거 (★2026-05-24 운영자 결정 이행):** 컷 숫자만 사주 것으로 바꾸면 펫 점수 분포가 눌려 S/A가 소멸한다. 대신 **경계 보존 piecewise 선형 remap**으로 v2에서 튜닝된 등급 인구를 그대로 유지하면서, 점수·컷의 *의미*를 사주와 통일한다 (구 경계 25/45/65/80 → 신 경계 52/70/80/85로 사상). fallback(tier 3·4) 최저 C 보장, D 면책 문장 등 기존 안전장치 유지.

- [ ] **Step 1: 검증 스크립트 먼저 작성** — `scripts/pet-compat-grade-dist.mts`:

```ts
// 등급 분포 검증: remap 전후로 등급 인구가 동일해야 한다 (경계 보존 확인)
// 실행: npx tsx scripts/pet-compat-grade-dist.mts
import { remapComposite } from "../lib/pet-compat-scoring";

const OLD_CUTS = [25, 45, 65, 80];
const NEW_CUTS = [52, 70, 80, 85];
let fail = 0;
for (let raw = 0; raw <= 100; raw++) {
  const mapped = remapComposite(raw);
  const oldGradeIdx = OLD_CUTS.filter((c) => raw >= c).length;   // 0=D..4=S
  const newGradeIdx = NEW_CUTS.filter((c) => mapped >= c).length;
  if (oldGradeIdx !== newGradeIdx) {
    console.error(`FAIL raw=${raw} mapped=${mapped} old=${oldGradeIdx} new=${newGradeIdx}`);
    fail++;
  }
}
console.log(fail === 0 ? "PASS: 0~100 전 구간 등급 보존" : `FAIL ${fail}건`);
```

- [ ] **Step 2: 실행해서 실패 확인**

```bash
npx tsx scripts/pet-compat-grade-dist.mts
```
Expected: FAIL — `remapComposite` export가 아직 없음 (import 에러).

- [ ] **Step 3: remap 구현** — `lib/pet-compat-scoring.ts`:

```ts
import { COMPOSITE_GRADE_CUTOFFS } from "@/lib/gradeSystem";

export const PET_COMPAT_SCORING_VERSION = 3; // v3: composite를 사주 컷 스케일로 remap (2026-05-24 등급 컷 동기화 결정)

// v2에서 튜닝·검증된 펫 composite 분포(경계 25/45/65/80)를
// 사주 마스터 컷(52/70/80/85) 스케일로 경계 보존 사상.
// 등급 인구는 v2와 동일하게 유지되고, 점수의 의미만 사주와 통일된다.
const REMAP_OLD = [0, 25, 45, 65, 80, 100];
const REMAP_NEW = [0, COMPOSITE_GRADE_CUTOFFS.C, COMPOSITE_GRADE_CUTOFFS.B, COMPOSITE_GRADE_CUTOFFS.A, COMPOSITE_GRADE_CUTOFFS.S, 100];

export function remapComposite(raw: number): number {
  const r = Math.max(0, Math.min(100, raw));
  for (let i = 1; i < REMAP_OLD.length; i++) {
    if (r <= REMAP_OLD[i]) {
      const t = (r - REMAP_OLD[i - 1]) / (REMAP_OLD[i] - REMAP_OLD[i - 1]);
      const mapped = REMAP_NEW[i - 1] + t * (REMAP_NEW[i] - REMAP_NEW[i - 1]);
      // 경계 보존: 구 경계 "미만"은 반올림 후에도 신 경계 미만이어야 한다
      // (예: raw 79 → 84.x가 85로 반올림되면 A가 S로 넘어가는 버그)
      return r < REMAP_OLD[i] ? Math.min(Math.round(mapped), REMAP_NEW[i] - 1) : Math.round(mapped);
    }
  }
  return 100;
}
```

`compositeToGrade`를 사주 컷으로 교체:
```ts
function compositeToGrade(composite: number, signals: PetCompatSignals): LabelGrade {
  // fallback (tier 3·4)이면 D 부여 금지 (최저 C까지)
  const minGrade = signals.petBirthTier >= 3 ? "C" : "D";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.S) return "S";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.A) return "A";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.B) return "B";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.C) return "C";
  return minGrade;
}
```

composite 산출부(358~361행 부근)에서 remap 적용:
```ts
const composite = remapComposite(computeComposite({ sync, ruler, lover, loyalty, conflict }));
```

주의: `pickLabelText`의 임계값(sync≥85 등)은 **지표 점수** 기반이라 remap 대상 아님 — 손대지 말 것. remap에서 경계 반올림으로 등급이 어긋나는 케이스가 Step 4에서 나오면 `Math.round` 대신 경계 구간별 `Math.floor`/`Math.ceil`로 보정.

- [ ] **Step 4: 검증 통과 확인**

```bash
npx tsx scripts/pet-compat-grade-dist.mts && npx tsx scripts/pet-compat-edge-cases.mts
```
Expected: `PASS: 0~100 전 구간 등급 보존` + 엣지 케이스 8개 라벨 정상 (edge-cases 스크립트가 구 컷을 하드코딩했다면 신 컷 기준으로 기대값 갱신).

- [ ] **Step 5: 커밋**

```bash
git add lib/pet-compat-scoring.ts scripts/pet-compat-grade-dist.mts scripts/pet-compat-edge-cases.mts
git commit -m "feat(pet): 등급 컷 사주 마스터 컷 동기화 — 경계 보존 remap (SCORING_VERSION 3)

2026-05-24 결정 이행: 펫 자체 컷(80/65/45/25) 폐기, 사주 컷(85/80/70/52) 단일 소스.
v2 등급 인구 분포는 piecewise 선형 remap으로 그대로 보존.
fallback 최저 C 보장 등 안전장치 유지."
```

---

### Task 5: 등급 표기 SS/S/A/B/C (displayGrade)

**Files:**
- Modify: `app/pet/result/PetResultClient.tsx` (126행 `{data.label_grade}등급`)
- Modify: `app/pet/result/share/[id]/SharePetCompatClient.tsx` (등급 뱃지 표기부, 41~76행 사이)

**Interfaces:**
- Consumes: `displayGrade(grade: GradeLabel): DisplayGradeLabel` (`lib/gradeSystem.ts:91`)
- Produces: 화면 표기만 SS/S/A/B/C. DB·API·`getGradeColor()` 키는 S/A/B/C/D 유지.

- [ ] **Step 1: 두 파일에 적용**

```ts
import { displayGrade } from "@/lib/gradeSystem";
// PetResultClient.tsx 126행:
{displayGrade(data.label_grade)}등급
// SharePetCompatClient.tsx의 등급 텍스트 노출부도 동일하게 displayGrade(labelGrade)
```
`getGradeColor(data.label_grade)`는 **원본 grade 그대로** 전달 (색상 키는 S/A/B/C/D).

- [ ] **Step 2: 검증 + 커밋**

```bash
npx tsc --noEmit
git add app/pet/result/PetResultClient.tsx "app/pet/result/share/[id]/SharePetCompatClient.tsx"
git commit -m "feat(pet): 등급 표기 SS/S/A/B/C 통일 — displayGrade 적용

사주 라인업과 동일 표기 체계. DB 저장값·색상 키는 S/A/B/C/D 유지."
```

---

### Task 6: 인프라 — Storage 버킷 2개 생성 + 마이그레이션 3개 (★출시 블로커)

**Files:**
- Create: `scripts/create-pet-buckets.mts`
- 적용 대상: `supabase/migrations/20260511_pet_drop_coat_color.sql`, `20260511_pet_drop_neutered.sql`, `20260512_pet_add_loyalty.sql`

**Interfaces:**
- Produces: `pet-uploads`(private, 5MB, jpg/png/webp), `pet-illustrations`(public, 5MB) 버킷 + `pet_compat_results.loyalty_score` 컬럼. **loyalty_score 없으면 analyze의 결과 insert가 실패한다 — E2E(Task 7) 전에 반드시 완료.**

- [ ] **Step 1: 버킷 생성 스크립트** — `scripts/create-pet-buckets.mts`:

```ts
// 펫 궁합 Storage 버킷 생성 (idempotent — 있으면 skip)
// 실행: npx tsx scripts/create-pet-buckets.mts
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const BUCKETS = [
  { name: "pet-uploads", public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  { name: "pet-illustrations", public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
];

const { data: existing } = await sb.storage.listBuckets();
const names = new Set((existing || []).map((b) => b.name));
for (const b of BUCKETS) {
  if (names.has(b.name)) { console.log(`skip: ${b.name} 이미 존재`); continue; }
  const { error } = await sb.storage.createBucket(b.name, {
    public: b.public, fileSizeLimit: b.fileSizeLimit, allowedMimeTypes: b.allowedMimeTypes,
  });
  console.log(error ? `FAIL ${b.name}: ${error.message}` : `created: ${b.name} (public=${b.public})`);
}
```

- [ ] **Step 2: 실행 + 검증**

```bash
npx tsx scripts/create-pet-buckets.mts
npx tsx scripts/check-pet-db-state.mts
```
Expected: `created: pet-uploads`, `created: pet-illustrations`, 재점검에서 `buckets: pet-uploads, pet-illustrations`.

- [ ] **Step 3: 마이그레이션 — 운영자 액션 (DDL은 service role REST로 불가)**

운영자가 Supabase 대시보드 SQL Editor에서 아래 합본 1회 실행 (전부 IF EXISTS/IF NOT EXISTS라 재실행 안전, 봉인 상태라 운영 데이터 없음):

```sql
ALTER TABLE public.pet_profiles DROP COLUMN IF EXISTS coat_color;
ALTER TABLE public.pet_profiles DROP COLUMN IF EXISTS neutered;
ALTER TABLE public.pet_compat_results
  ADD COLUMN IF NOT EXISTS loyalty_score INT CHECK (loyalty_score IS NULL OR (loyalty_score BETWEEN 0 AND 100));
```

- [ ] **Step 4: 적용 확인 + 커밋**

```bash
npx tsx scripts/check-pet-db-state.mts
```
Expected: `loyalty_score(pet_compat_results): EXISTS`, `coat_color: 없음`, `neutered: 없음`.

```bash
git add scripts/create-pet-buckets.mts
git commit -m "chore(pet): Storage 버킷 생성 스크립트 (pet-uploads private / pet-illustrations public)"
```

---

### Task 7: E2E 검증 — dev-test 3케이스 + 일러스트 (일러스트는 운영자 승인 후)

**Files:**
- 실행만: `app/api/pet-compat/dev-test/route.ts` (production 404, dev 전용)

**Interfaces:**
- Consumes: Task 4의 신규 등급 컷, Task 6의 loyalty_score 컬럼·버킷

- [ ] **Step 1: dev 서버 기동** (`npx next build` 동시 실행 금지)

```bash
npm run dev   # 포트 3000 또는 3001 — 기동 로그의 포트 사용
```

- [ ] **Step 2: 3케이스 호출** — 개 tier1 / 고양이 tier2 / 고양이 tier4(fallback):

```bash
curl -sS -X POST http://localhost:3000/api/pet-compat/dev-test \
  -H "Content-Type: application/json" \
  -d '{"pet":{"name":"콩이","species":"dog","birthTier":1,"birthDate":"2021-03-15","birthTime":"10:30"},"owner":{"name":"테스트","birthYear":"1995","birthMonth":"6","birthDay":"21","birthHour":"10","birthMinute":"0","unknownBirthTime":false,"birthLocation":"서울","gender":"female","calendarType":"solar"}}' --max-time 120
```
(고양이 tier2는 `"species":"cat","birthTier":2,"birthDate":"2020-08-01"`, tier4는 `"birthTier":4,"adoptionDate":"2023-05-05"`로 변형. dev-test body 스키마가 다르면 라우트 소스의 실제 스키마에 맞춘다.)

Expected 확인 항목:
- `composite`가 사주 스케일(대략 40~95 권역)로 나오고 `grade`가 컷과 정합
- tier4 케이스는 grade가 **C 밑으로 내려가지 않음**
- `loyalty` 점수 존재, 라벨 텍스트가 등급과 어울림, 금지 표현(의료 진단어·인격 비하) 없음

- [ ] **Step 3: 일러스트 E2E (★운영자 승인 후 실행 — Gemini 이미지 생성 = 유료)**

승인받으면: dev에서 `/pet/input` 진입 → 사진 1장 업로드 → 결제 mock으로 전체 플로우 1회 → `pet-illustrations` 버킷에 일러스트 생성·결과 화면 표시 확인. 승인 전이면 이 스텝만 SKIP 표기하고 진행 (일러스트는 실패해도 분석 진행되는 안전 설계 — analyze route 122행).

- [ ] **Step 4: 결과·공유 화면 시각 검수** — dev 브라우저에서 `/pet/result?id=<위 결과 id>`와 `/pet/result/share/<id>` 스크린샷 확인: SS 표기, 단색 톤(emerald 없음), 4지표 게이지, 카피 톤.

---

### Task 8: 메뉴 카드 활성화 (봉인 해제)

**Files:**
- Modify: `app/menu/page.tsx` (293~322행 준비중 카드 블록)

**Interfaces:**
- Consumes: `PET_COMPAT_COST`, `PET_COMPAT_LAUNCH_COST` (`lib/constants/coins.ts`)
- Produces: 메뉴에서 `/pet/input` 진입 가능. middleware에는 pet 봉인이 없으므로(실측 확인) 이 카드가 유일한 봉인 — 이 태스크가 곧 봉인 해제다.

- [ ] **Step 1: 카드 교체** — 기존 `<button type="button" disabled>` + "준비중" 블록을 사주/배틀 카드와 동일 패턴으로:

```tsx
import { PET_COMPAT_COST, PET_COMPAT_LAUNCH_COST } from "@/lib/constants/coins";
// 카드: 준비중 카드의 disabled/opacity-60/cursor-not-allowed 제거
<button type="button" onClick={() => router.push("/pet/input")} className="...(기존 활성 카드와 동일 클래스)">
  {/* 뱃지: "준비중" → "NEW" (기존 today/battle NEW 뱃지와 동일 스타일) */}
  <h3 className="text-xl font-bold text-white tracking-tight">반려동물 궁합 보기</h3>
  <p className="text-sm text-gray-400 leading-relaxed mt-2">우리 아이와 나의 사주<br/>궁합을 분석해줄게</p>
  <p className="mt-3 text-[15px] font-semibold">
    🥚 <span className="line-through text-gray-500">{PET_COMPAT_COST}알</span>{" "}
    <span className="text-white">{PET_COMPAT_LAUNCH_COST}알</span>
  </p>
</button>
```
구체 클래스는 같은 파일의 **배틀 카드 활성 스타일을 그대로 복제** (토스풍 톤앤매너 유지, 새 스타일 발명 금지).

- [ ] **Step 2: 검증 + 커밋**

```bash
npx tsc --noEmit
git add app/menu/page.tsx
git commit -m "feat(pet): 메뉴 카드 활성화 — 반려동물 궁합 출시 진입점

준비중 → NEW 뱃지 + 출시가 10알(정상가 20알 취소선) 표기.
middleware에 pet 봉인 없음(실측) — 이 카드가 유일한 봉인이었음."
```

---

### Task 9: 전수 QA + PR (머지·배포는 운영자 승인 대기)

**Files:**
- 검증만. PR 생성.

- [ ] **Step 1: 카피·룰 전수 grep**

```bash
grep -rn "무료" app/pet lib/pet-compat*.ts app/menu/page.tsx app/checkout/page.tsx | grep -v "무료함\|무료하" ; echo "exit=$?"
```
Expected: 매치 0건 (exit=1). 매치 시 해당 카피 수정.

- [ ] **Step 2: 2차 영향 전수 점검** (배포 전 2차 영향 검증 룰):
- pet 세션이 `type:"analysis"` spend로 들어오면 → `hasRequiredInput(payload)` false → 400 (안전) — 코드 리딩으로 확인
- 사주/배틀 spend 경로에 회귀 없음 — dev에서 사주 분석 1회 mock 결제로 확인
- `prepayment_sessions` 만료 로직이 pet 세션에도 동일 적용되는지 확인 (intake가 expires_at을 안 넣으면 만료 체크가 skip됨 — 실측 후 필요 시 intake에 expires_at 추가)

- [ ] **Step 3: 최종 빌드** (dev 서버 종료 후)

```bash
npx tsc --noEmit && npx next build
```
Expected: PASS

- [ ] **Step 4: PR 생성**

```bash
git push -u origin feat/pet-resume
gh pr create --title "feat: 반려동물 궁합 출시 — v0.9 완성 (결제 복구·등급 사주 동기화·봉인 해제)" --body "$(cat <<'EOF'
## 요약
- 봉인 중이던 반려동물 궁합 v0.9를 현재 main 구조로 완성
- coins/spend·checkout에 pet 타입 복구 (포팅 중 끊겼던 결제 파이프라인)
- 등급 컷 사주 마스터 컷 동기화 (2026-05-24 결정, SCORING_VERSION 3) + SS/S/A/B/C 표기
- Storage 버킷 2개 생성 완료, 마이그레이션 3개 적용 완료
- 메뉴 카드 활성화 (출시가 10알, 정상가 20알)

## 배포 전 운영자 확인
- [ ] 마이그레이션 3종 적용 확인 (`npx tsx scripts/check-pet-db-state.mts`)
- [ ] 버킷 2개 존재 확인
- [ ] 일러스트 E2E 1회 (Gemini 이미지 생성 비용 발생)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**머지·프로덕션 배포는 여기서 멈추고 운영자 승인 대기.** 배포 순서: 마이그레이션(이미 적용) → 버킷(이미 생성) → PR 머지 → Vercel 배포 → 프로덕션에서 메뉴 진입·결제 1회 스모크.

---

## 운영자 게이트 요약 (내가 못 하는 것 3개)

1. **DB 마이그레이션 DDL** — Supabase SQL Editor에서 Task 6 Step 3 합본 실행 (loyalty_score 없으면 분석 자체가 실패하는 출시 블로커)
2. **일러스트 E2E 승인** — Gemini 이미지 생성 유료 (1~2회, 저비용)
3. **PR 머지·프로덕션 배포 승인**
