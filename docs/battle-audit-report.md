# 배틀 기능 현재 상태 전수 조사 보고서

> 조사일: 2026-02-25

---

## 1. DB / Supabase

### saju_battles 테이블
✅ **존재하고 동작할 것으로 보임**

- 마이그레이션: `supabase/migrations/20260220_saju_battles.sql`
- 컬럼: `id`, `user_id`, `player_a_name`, `player_b_name`, `player_a_grade`, `player_b_grade`, `overall_winner`, `overall_intensity`, `wins_a`, `wins_b`, `draws`, `relationship_type`, `full_result(jsonb)`, `created_at`
- 인덱스: `saju_battles_user_idx` on `(user_id, created_at desc)`

### 배틀 관련 RPC 함수
❌ **존재하지 않음**

- 배틀 전용 RPC 없음. 모든 DB 작업은 `supabaseAdmin`으로 직접 쿼리.

### 배틀 관련 RLS 정책
❌ **존재하지 않음**

- 어떤 테이블에도 `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` 없음. 앱 레벨에서 NextAuth 세션 검증으로 대체.

### saju_results에 배틀 관련 컬럼
❌ **존재하지 않음**

- 배틀은 완전히 별도 테이블(`saju_battles`)에 저장.

### 📝 스키마 불일치 (Critical)
⚠️ API 코드(`app/api/battle/analyze/route.ts:225-226`, `app/api/battles/[id]/route.ts:42-43`)에서 `guest_token_hash`, `guest_token_expires_at` 컬럼을 읽고 쓰지만, **마이그레이션에 해당 컬럼이 없음**. 수동으로 추가했거나 누락된 마이그레이션이 있을 수 있음.

---

## 2. API 라우트

### app/api/battle/ 하위

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/api/battle/analyze/route.ts` | 262 | 핵심 분석 엔드포인트. 두 플레이어 입력 → 사주 enrich → 개별 스코어링 → 운세 계산 → 상호작용 분석 → 비교 → Gemini LLM 서사 생성 → DB 저장 |
| `app/api/battle/my-saju/route.ts` | 92 | 로그인 사용자의 기존 사주 프로필 조회. `primary_result_id` 우선, 없으면 최근 unlock 결과 반환 |

### app/api/battles/ 하위

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/api/battles/route.ts` | 48 | 로그인 사용자의 배틀 목록 조회. `created_at desc` 정렬 |
| `app/api/battles/[id]/route.ts` | 102 | GET: 개별 배틀 조회 (로그인 + 게스트 토큰 양쪽 지원). DELETE: 로그인 사용자만 삭제 |

### 다른 API 라우트의 배틀 분기

| 파일 | 위치 | 내용 |
|------|------|------|
| `app/api/payment/complete/route.ts` | L147, L206-228 | `body.type === "battle"` 분기. 배틀은 결제 확인만 하고 분석은 건너뜀 → 클라이언트가 별도로 `/api/battle/analyze` 호출 |
| `app/api/results/claim/route.ts` | L43-48 | 게스트→로그인 전환 시 `saju_battles` 테이블도 함께 마이그레이션 (`guest_token_hash` IN hashes, `user_id IS NULL` 조건) |
| `app/api/intake/session/route.ts` | — | 배틀 전용 분기 없음. 범용 세션 생성 |

---

## 3. 페이지 / 컴포넌트

### app/battle/ 하위

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/battle/page.tsx` | 6 | `/battle/input`으로 리다이렉트만 |
| `app/battle/input/page.tsx` | 651 | 7단계 입력 폼. Step 0: 내 사주 선택(기존/신규) → Step 1: 관계 유형 → Step 2-5: 상대방 정보 → Step 6: 확인 → checkout |
| `app/battle/result/page.tsx` | 19 | 서버 컴포넌트. `BattleResultClient`를 Suspense로 래핑 |
| `app/battle/result/BattleResultClient.tsx` | 500 | 결과 페이지. VS 카드, 카테고리 대결, 레이더 차트, 냉정한 판결, 상성 분석, 개인 요약, 공유, 게스트 claim 플로우 |

### components/battle/

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `components/battle/BattleVsCard.tsx` | 219 | 카테고리별 대결 시각화. 하이라이트 카드 + 나머지 컴팩트 카드. 수평 프로그레스 바, 승자 표시 |
| `components/battle/BattleRadarChart.tsx` | 284 | 5개 카테고리 레이더 차트. SVG 애니메이션, A=빨강(#FF6B6B), B=보라(#A855F7), `prefers-reduced-motion` 대응 |

### useBattleStore (store/useBattleStore.ts)

✅ **존재하고 동작할 것으로 보임**

**상태:**
- `playerA: BattlePlayerInput` — 내 사주 데이터
- `playerAMode: "new" | "existing" | ""` — 기존 사주 사용 여부
- `existingResultId: string | null` — 불러온 기존 결과 ID
- `playerB: BattlePlayerInput` — 상대방 사주 데이터
- `relationshipType: RelationshipType | ""` — 관계 유형
- `step: number` — 현재 입력 단계 (0-6)
- `battleResult: BattleResult | null` — 분석 결과

**액션:** `setPlayerA`, `setPlayerAMode`, `setExistingResultId`, `setPlayerB`, `setPlayerBField`, `setRelationshipType`, `setStep`, `setBattleResult`, `reset`

**셀렉터 훅:** `useBattlePlayerA`, `useBattlePlayerB`, `useBattleResult`, `useBattleStep`, `useBattleRelationship`, `useBattleActions`

**Persist:** `saju-battle-store`, localStorage

---

## 4. 스코어링

### saju-scoring.ts의 배틀 관련 함수
❌ **배틀 전용 함수 없음**

배틀은 개인 스코어링과 **100% 동일한 함수를 공유**:
- `calculateServerScoring(enriched)` → `{ scoringInput, scores, tier }`
- 내부적으로 `parseScoringInput()` → `calculateScores()` → `calculateTier()` 순서

`app/api/battle/analyze/route.ts`에서:
- L85: `calculateServerScoring(enrichedA)`
- L104: `calculateServerScoring(enrichedB)`
- 각 플레이어를 **개별적으로** 동일 알고리즘으로 스코어링.

### 배틀 전용 유틸리티 (스코어링 후처리)

| 파일 | 함수 | 시그니처 | 역할 |
|------|------|----------|------|
| `lib/utils/battle-compare.ts` | `compareBattle` | `(scoresA: ServerScores, scoresB: ServerScores, tierA: TierResult, tierB: TierResult, nameA: string, nameB: string) → BattleComparison` | 기 산출된 점수를 비교. 카테고리별 승패, 전체 승자 결정 (동점 시 composite로 타이브레이크). 점수 자체를 계산하지 않음. |
| `lib/utils/battle-interaction.ts` | `calculateBattleInteraction` | `(enrichedA, enrichedB, fortuneA?, fortuneB?, birthYearA?, birthYearB?) → BattleInteraction` | 두 사주 간 상호작용 분석: 용신 상보성, 일간 관계(합/충/생/극/비화), 오행 상보율, 대운 동기화. 점수에 영향 없음, LLM 프롬프트 재료용. |

---

## 5. LLM

### BATTLE_SYSTEM_PROMPT
✅ **존재하고 동작할 것으로 보임**

- 파일: `lib/battle-prompt.ts`
- 위치: L28-92 (65줄)
- 파일 전체: 264줄

### 배틀 전용 프롬프트 빌더

| 함수 | 위치 | 역할 |
|------|------|------|
| `buildBattleUserInfo(opts)` | L94-197 | 두 플레이어 프로필 + 대결 결과 + 상호작용 데이터 + 관계 톤을 포맷하여 LLM 입력 문자열 생성 |
| `runBattleAnalysis(opts)` | L199-264 | Gemini 호출 오케스트레이터. 모델 폴백 지원. 실패 시 기본 텍스트 생성 |

### buildFortunePromptBlock 사용 여부
✅ **배틀에서도 사용됨**

- `lib/analysis.ts:1979-2008`에서 정의
- `app/api/battle/analyze/route.ts:5`에서 import
- L155-156에서 양쪽 플레이어에 대해 호출 → `buildBattleUserInfo`에 전달

### 📝 백업 파일
- `lib/battle-prompt.ts.backup` (197줄) — 현재 버전(264줄) 대비 상호작용/운세 관련 섹션 추가 전 버전

---

## 6. 결제

### 배틀 결제 플로우
⚠️ **개인과 부분 공유, 부분 분리**

**공유하는 부분:**
- `app/checkout/page.tsx` — 동일 체크아웃 페이지, `?type=battle` 쿼리 파라미터로 분기
- `app/api/intake/session/route.ts` — 범용 세션 생성 (배틀 전용 로직 없음)

**분기 로직 (`app/checkout/page.tsx`):**

| 항목 | 개인 | 배틀 |
|------|------|------|
| 가격 | 1,000원 | 2,000원 |
| 상품명 | "사주 전체 결과" | "사주 배틀" |
| 결제 후 | `/api/payment/complete`가 분석까지 실행 | `/api/payment/complete`는 결제 확인만 → 클라이언트가 `/api/battle/analyze` 별도 호출 |
| 리다이렉트 | `/result` | `/battle/result?id={battleId}` |
| 입력 검증 | 전체 입력 필드 | `playerA`, `playerB`, `relationshipType` (battleStore에서) |
| 세션 생성 | 전체 inputs | `battleStore.playerA` 데이터만 |

**`app/api/payment/complete/route.ts`에서:**
- L147: `const isBattle = body.type === "battle"`
- L206-228: 배틀이면 결제 확인만 하고 `{ ok: true, type: "battle" }` 반환. 분석은 스킵.

---

## 7. Late Login (게스트 → 로그인 전환)

### 배틀 게스트 토큰 플로우
⚠️ **구현되어 있으나 마이그레이션 누락 의심**

**구현된 부분:**
- `app/api/battle/analyze/route.ts:61-68` — 게스트 토큰 추출, L225-226에서 `guest_token_hash`, `guest_token_expires_at` 저장
- `app/api/battles/[id]/route.ts:34-52` — 게스트 토큰으로 배틀 조회 (token hash IN + 만료 시간 GT now)
- `app/api/results/claim/route.ts:43-48` — 로그인 시 `saju_battles.user_id` 업데이트 + `guest_token_hash` null 처리
- `app/battle/result/BattleResultClient.tsx:46-62` — `?claim=true` 파라미터로 자동 claim 트리거

**⚠️ 문제:**
- `guest_token_hash`, `guest_token_expires_at` 컬럼이 `20260220_saju_battles.sql` 마이그레이션에 **정의되지 않음**
- 코드는 이 컬럼이 존재한다고 가정하고 읽고 쓰고 있음
- 수동으로 DB에 추가했거나, 별도 마이그레이션이 커밋되지 않았을 가능성

---

## 8. 공유

### 배틀 결과 공유
⚠️ **존재하지만 개인 결과와 방식이 다름**

**`app/battle/result/BattleResultClient.tsx:98-126`:**
- 공유 텍스트: `[사주배틀] PlayerA vs PlayerB - Winner의 Intensity! (A:B)`
- URL: `window.location.href` (현재 페이지 `/battle/result?id={battleId}`)
- 모바일: `navigator.share()` 사용 (개인 결과는 이미 클립보드 복사로 변경됨)
- 데스크탑: 클립보드 복사 + "복사됨!" 텍스트 변경 (개인 결과는 이미 토스트로 변경됨)

### 📝 개인 결과와의 차이

| 항목 | 개인 결과 | 배틀 결과 |
|------|-----------|-----------|
| 전용 공유 페이지 | ✅ `/result/share/[id]` | ❌ 없음 (직접 결과 페이지 URL 공유) |
| 공유 방식 | 클립보드 복사 + 토스트 | `navigator.share` + 클립보드 폴백 |
| 익명화 | `hidePersonalInfo: true` | 없음 (전체 데이터 노출) |
| 공유 텍스트 | URL만 | 텍스트 + URL |

---

## 전체 파일 목록 요약

| 구분 | 파일 |
|------|------|
| **DB** | `supabase/migrations/20260220_saju_battles.sql` |
| **타입** | `types/battle.ts` |
| **API** | `app/api/battle/analyze/route.ts`, `app/api/battle/my-saju/route.ts`, `app/api/battles/route.ts`, `app/api/battles/[id]/route.ts` |
| **페이지** | `app/battle/page.tsx`, `app/battle/input/page.tsx`, `app/battle/result/page.tsx`, `app/battle/result/BattleResultClient.tsx` |
| **컴포넌트** | `components/battle/BattleVsCard.tsx`, `components/battle/BattleRadarChart.tsx` |
| **스토어** | `store/useBattleStore.ts` |
| **유틸** | `lib/battle-prompt.ts`, `lib/utils/battle-compare.ts`, `lib/utils/battle-interaction.ts` |
| **백업** | `lib/battle-prompt.ts.backup` |
| **배틀 분기 있는 공유 파일** | `app/checkout/page.tsx`, `app/api/payment/complete/route.ts`, `app/api/results/claim/route.ts` |
