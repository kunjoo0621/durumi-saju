# 동일 입력 재분석 이중 과금 수정 실행 계획서 (REUSE_CHARGE_FIX)

작성: 2026-07-29 · 상태: 승인 대기 · 대상: `/api/coins/spend` 재사용 과금 75건/54명

---

## 0. 코드 실측 결과 — 운영자 설명과의 대조

계획 수립 전 아래 파일을 전부 직접 읽고 검증했다.

### 0-1. 운영자 설명과 일치 (확인됨)

| 항목 | 검증 결과 |
|---|---|
| `app/api/coins/spend/route.ts:68` 선차감 | 정확. `spend_coins` RPC가 먼저 실행됨 |
| `route.ts:120~161` 후확인 → `reused: true` | 정확. 차감 후 `result_unlocks` 조회, 있으면 옛 결과 재노출, **환불 없음** |
| `rescoreIfStale` freeze | 정확. `app/api/results/full/route.ts:48~52` — 함수 본문이 `return;` 하나 (본문-점수 미스매치 방지 의도 주석 확인) |
| `buildInputHash` 구성 | 정확. `lib/analysis.ts:2211` — name/생년월일/calendarType/생시분/지역/성별/연애/직장/coreFearAxis. 원국이 아니라 입력 전체 해시 |
| 상품가·충전가 | 정확 (`lib/constants/coins.ts`) |

### 0-2. 운영자 설명과 다르거나, 설명에 없던 사실 (중요)

**(A) yearly/today/marriage/wealth에는 이 버그가 없다 — 오히려 정답 코드가 이미 있다.**

- `app/api/yearly/start/route.ts:84~145` — 재사용 확인을 **차감 전에** 한다. 재사용이면 spend 자체를 안 함.
- `app/api/today/start/route.ts:80~170` — 동일. 추가로 2탭 동시 재시도 원자적 reset 가드까지 있음.
- `app/api/marriage/analyze/route.ts:122~163` — 멱등 체크(2단계)가 차감(3단계)보다 앞. 동시 요청 loser는 23505 감지 후 환불.
- `app/api/wealth/analyze/route.ts:169~213` — marriage 미러 + orphan 유예 3분 + 멱등 환불 헬퍼(`refundWealthUnlock`)로 가장 견고.

→ **"선차감 후확인" 패턴은 `coins/spend` 하나뿐이다.** 이식이 아니라 saju spend가 yearly/today를 미러하면 된다 (yearly 주석에 "saju 핫픽스 6d4a822와 동일 패턴"이라고 스스로 적어놓고 순서만 saju가 거꾸로 남았다).

**(B) 프론트에 중복 안내 모달이 이미 구현돼 있는데, 결제 가능한 유저에겐 죽어 있다.**

- `app/checkout/page.tsx:483~490, 696~731` / `app/teaser/page.tsx:354~358, 636~` — "이미 같은 사주로 본 결과가 있어" 모달 + "결과 보러가기" 버튼이 이미 있다.
- 그런데 이 모달의 트리거인 `existingResultId`는 `/api/intake/session`(`app/api/intake/session/route.ts:61~90`)이 **`if (!userId)` 블록 안에서만** 계산한다. 즉 **게스트 전용**.
- spend는 로그인 필수(401)이므로, **돈을 낼 수 있는 유저는 이 모달을 한 번도 본 적이 없다.** 75건 전원 로그인 유저다.
- 게다가 모달의 보조 버튼이 "**새로 결제하기**"인데, 누르면 차감 후 `reused:true`로 **똑같은 옛 결과**가 나온다 — 살아 있었더라도 함정 버튼.

**(C) 추가 확정 버그: `result_unlocks` upsert 에러가 통째로 무시된다.**

`coins/spend/route.ts:205~219` — unlock upsert가 `Promise.all([...])` 안에 있고 **결과를 아무도 안 읽는다.** Supabase 클라이언트는 에러 시 throw하지 않고 error 객체를 반환하므로, unlock insert가 실패해도(동시 요청의 `result_unlocks_user_input_unique` 23505 포함) 조용히 넘어간다. 동시 중복 요청 시: 둘 다 차감 → 한쪽 unlock 실패 무시 → **환불 없는 이중 차감**. yearly/today는 plain insert + 23505 감지 + 환불로 이걸 막고 있다(주석 "today 패턴 미러 0a0517f").

**(D) 같은 sessionId 재전송이 재차감된다.**

- `coins/spend/route.ts:49~55` — 만료 검사가 `status === "pending"`일 때만 작동. `markSessionConsumed`로 `consumed`가 된 세션을 다시 POST해도 **거부하지 않는다.**
- `spend_coins` RPC(`supabase/migrations/20260317_coin_system.sql:124~166`)에는 **reference_id 멱등성이 없다.** advisory lock은 직렬화만 하지 중복을 막지 않는다. 같은 sessionId로 두 번 부르면 두 번 다 차감된다.
- 배틀도 동일 노출: 같은 세션 spend 2회 = 40알 차감 (배틀은 reuse 개념이 없어 본 건 75건과는 별개지만 같은 뿌리).

**(E) 로컬 저장소가 라이브보다 낡았다.**

- 로컬 `lib/utils/saju-scoring.ts:14` = `SCORING_VERSION = 17`, 현재 브랜치 `feat/wealth-luck-test`(+수정 파일 2개). 라이브는 v18(PR#85). **작업 시작 전 `origin/main` pull 후 새 브랜치 필수.** CLAUDE.md의 "현재 v17" 문단도 낡음.

### 0-3. "몇 분 안 중복 49건" 원인 규명

코드상 후보를 전수 점검한 결론: **단일 원인이 아니라, "재진입 = 무조건 과금" 구조가 원인이다.**

1. **버튼 중복 클릭 (기각 — 주범 아님)**: 결제 버튼은 `disabled={paying || confirming || ...}`(checkout:663) 이고 `executeSpend`가 즉시 `setPaying(true)`. 리렌더 전 ms 단위 race만 남는다. 1~10분 간격 37건을 설명 못 한다.
2. **클라이언트 자동 재시도 (기각)**: checkout/teaser/coins 어디에도 spend fetch retry 루프 없음. 실패 시 setError 후 종료.
3. **퍼널 재주파 (주범 — 37건+α)**: 결제 → `pending` 결과 페이지(Gemini 1~3분) → 유저가 조급해서 뒤로가기/새로고침/재진입 → teaser·checkout이 **매번 새 prepayment_session을 insert**(`intake/session:109~118`) → 새 sessionId로 spend → 서버가 차감 후에야 "이미 있네" → 조용히 10알 증발. 로그인 유저에겐 경고 모달이 안 뜨므로(위 B) 아무 저항 없이 통과. 1~10분 분포가 Gemini 분석 대기 시간과 정확히 겹친다.
4. **충전 후 자동 spend 경로 (재방문 4건 포함 설명)**: teaser에서 잔액 부족 → `ChargeBottomSheet`가 `sessionStorage.pendingSpend` 저장(teaser:620~633) → PortOne 리디렉트 → `/coins`가 복귀 시 **자동으로 spend 호출**(coins/page.tsx:124~168). 냥이(7b4581ce) 케이스와 정확히 일치: 44일 뒤 재방문 → 같은 입력으로 teaser 진입 → 잔액 0 → 1,000원 충전 → 자동 spend → 6/14 옛 결과 재노출, 잔고 0.
5. **1분 이내 12건**: 3의 최단 변형(즉시 뒤로가기/이중 제출) + (C)의 동시 요청 race 소량 혼합 추정. 어느 쪽이든 처방은 동일(서버 순서 교정 + race 가드)이라 추가 구분 조사는 불필요.

**처방 귀결**: 프론트 디바운스는 이미 있고(3·4를 못 막음), 원인이 "재진입"이므로 **서버에서 차감 전에 막는 순서 교정이 유일하게 전 경로를 덮는다.** 프론트 안내는 UX 보강.

---

## 1. 설계 판단 (운영자 안 검증)

### 1-1. 운영자 안 평가: 방향은 맞다. 그러나 프론트 우선이면 절반만 고쳐진다.

운영자 안(차감 전 감지 → 안내 화면)은 올바른 목표 상태다. 다만:

- 안내 화면만으로는 **경로 4(충전 후 자동 spend)** 를 못 막는다. `/coins`의 pendingSpend 자동 실행은 모달을 거치지 않는다.
- 감지 로직 자체가 서버(intake/session)에 있으므로 어차피 서버 수정이다. 그렇다면 **과금 불변식("같은 유저·같은 input_hash에 2번 차감 불가")은 spend 라우트가 직접 보장**하는 것이 맞다. UI는 우회당할 수 있지만(딥링크, 자동 spend, 이중 탭) 서버는 못 우회한다.
- 결론: **운영자 안을 Phase 2(UX)로 유지하되, Phase 1(서버 순서 교정)을 앞에 놓는다.** 이미 있는 죽은 모달을 살리는 것이므로 프론트 작업량도 예상보다 작다.

### 1-2. 트레이드오프 판단 3건

**① 재사용 무료 → 맞는 선택이다.**
- 이 "매출"의 정체: 3개월 75건 ≈ 월 25건 ≈ **월 2.5만원 상당**. 대가로 준 것은 저장된 옛 결과 재노출, 즉 원가 0·추가 가치 0.
- 결정적 근거: **유저는 이미 `/my`(내 결과)에서 같은 결과를 무료로 본다.** 결제 퍼널로 진입했을 때만 10알을 받는 건 가격 정책이 아니라 흐름의 사고다. "무엇에 돈을 받는가"의 정합성이 없다.
- 35~54세 여성 타겟 + 네이버 유입 50% 구조에서 "돈만 빼가고 똑같은 걸 보여줌"이 카페·블로그에 한 건이라도 박제되면 월 2.5만원과 비교가 안 되는 손실. 결제 전환율 46%는 신뢰 자산이다.
- 반론 검토: "무료로 열면 재결제 유도 기회가 사라진다" → 애초에 그 재결제는 유저가 오인해서 낸 돈이고, 하단 상품 추천(올해의 운세·오늘의 운세·결혼운·재물운)이 정당한 업셀 자리다. 재방문 4건이야말로 "새 상품 살 의지가 있는 유저"였다.

**② "새로 분석하기" 봉인 → 동의. 조건부 개방도 반대.**
- 산식·등급·만세력이 결정론이므로 "새로 분석"이 파는 것은 Gemini 문장 랜덤성뿐. 상품이 아니다.
- 조건부 개방(산식 버전업 시)의 함정: rescore freeze 정책과 정면 모순. 재분석하면 등급이 바뀔 수 있고(v17→v18에서 B→C 가능) 특히 **하락 시** "돈 내고 등급 떨어짐" 컴플레인이 이중과금보다 더 나쁘다. 상승 케이스만 열어주는 건 등급 인플레 조작이고, 문장 마음에 들 때까지 돌리는 regeneration farming도 열린다.
- 유일한 정당한 탈출구는 운영자 안 그대로 **"태어난 시간 고치기"**(입력이 실제로 달라짐 → 다른 해시 → 정당한 신규 10알). 이건 서버 관점에서도 자연스럽다.
- 예외 하나: 기존 결과가 `_error`(실패 row)면 재결제-재분석이 맞다. yearly/today의 확립된 정책("실패 row 재시도는 신규 결제")을 그대로 유지한다.

**③ 서버 vs 프론트 책임 경계 → 돈은 서버, 설명은 프론트.**
- 서버 책임(불변식): 같은 (user_id, input_hash)에 정상 결과가 있으면 **spend RPC를 호출하지 않는다.** 어떤 클라이언트 경로로 와도 성립해야 한다.
- 프론트 책임(UX): 결제 버튼을 누르기 **전에** "이미 본 결과가 있어"를 보여줘 유저가 놀라지 않게 한다. 프론트가 실패해도(모달 스킵, 자동 spend) 돈은 안 빠진다.
- 서버만 하고 프론트를 안 하면: 유저가 10알 나갈 줄 알고 눌렀는데 안 나가고 옛 결과가 뜸 — 손해는 없지만 어리둥절. 그래서 응답에 `charged: false`를 실어 프론트가 "이미 본 결과라 알은 쓰지 않았어" 토스트를 띄운다.

### 1-3. 운영자 안에 추가해야 할 것 (이번 실측에서 나온 것)

- (C) unlock upsert 에러 무시 → plain insert + 23505 환불 가드 (Phase 1에 포함, yearly 미러)
- (D) consumed 세션 재전송 멱등 처리 (Phase 1에 포함)
- `spend_coins` RPC 멱등성 (Phase 3, 배틀까지 보호)
- 반대 케이스(생시 바꿔도 같은 원국 — 주현 14회 결제) 경고 (Phase 4, v2)

---

## 2. 실행 계획

### Phase 0 — 준비 (30분)

1. `git checkout main && git pull origin main` — 로컬이 v17로 낡음(라이브 v18, PR#85). **이거 안 하면 낡은 코드 위에 패치하게 된다.**
2. `main`에서 `fix/reuse-charge` 브랜치 생성 (feedback_branch_strategy).
3. 현재 `feat/wealth-luck-test`의 수정 파일 2개(CLAUDE.md, STORIES_CHECKLIST.md)는 건드리지 않음.

### Phase 1 — 서버 순서 교정 (핵심 핫픽스)

**① 수정 파일·함수**: `app/api/coins/spend/route.ts` `POST` 단일 파일. 마이그레이션 없음.

**② 변경 내용** (`type === "analysis"` 경로, yearly/start 88~145행 구조를 미러):

```
[현재]  세션검증 → spend → unlock조회 → (있으면 reused, 없으면 row생성)
[변경]  세션검증
        → (신규) consumed 세션이면: unlock 조회 → 있으면 reused 응답 / 없으면 410
        → unlock 조회 (user_id + input_hash)                  ← 차감 전으로 이동
        → [있음 & full_json 정상] spend 없이 즉시 응답:
              { ok, reused: true, resultId, charged: false }
          + markSessionConsumed
        → [있음 & full_json._error] spend → reset(full_json 등 null) → pending 응답
          (yearly:105~137 정책 유지 — 실패 재시도는 재결제)
        → [없음] spend → saju_results upsert
          → result_unlocks를 Promise.all에서 꺼내 plain insert로 전환:
              에러 23505 → refundCoins + 기존 unlock의 result_id로 reused 응답
              그 외 에러 → refundCoins + 500 (refunded: true)
          → markSessionConsumed / autoSetPrimaryIfNeeded는 이후 병렬 유지
```

- 응답 스키마 추가: `charged: boolean` (reused 시 false). 기존 필드 유지로 구버전 클라이언트 하위호환.
- reused 응답의 `balance`는 생략(차감이 없으므로) — 프론트는 `typeof data.balance === "number"`일 때만 갱신하므로 안전(checkout:432, teaser:301 확인).
- 배틀 경로는 Phase 1에서 변경하지 않음(Phase 3에서 RPC 멱등성으로 커버).

**③ 검증 방법**
- `npx next build` 성공 (dev 서버 내리고 — feedback_nextjs_build_dev_conflict).
- 시나리오 스크립트 `scripts/check-reuse-spend.mts`(신규): dev 환경에서 (a) 신규 입력 spend → 10알 차감+row 생성, (b) 같은 입력 세션 재생성 후 spend → 차감 0·reused·charged:false, (c) 같은 sessionId 재POST → 차감 0, (d) `_error` row 세팅 후 spend → 차감 10·pending, (e) 동시 2요청(Promise.all) → 총 차감 10·환불 1회. 각 케이스 후 `coin_transactions` 원장으로 확인.
- 본인 계정(1995-06-21 계미)으로 프로덕션 수동 E2E: 기존 결과 입력으로 재결제 시도 → 잔액 불변 확인.
- 배포 후 24h: `coin_transactions`에서 spend인데 ±10분 내 신규 `saju_results` row 없는 건 카운트(운영자 감사 쿼리 재실행) → **0이어야 함**.

**④ 리스크**
- 낮음. 단일 라우트, 스키마 변경 없음. 최악 케이스는 로직 오류로 spend가 아예 안 되는 것 → 매출 중단이 아니라 "신규 분석이 pending 안 됨"으로 즉시 발견됨.
- `_error` 재시도 경로 회귀 주의: reset 후 pending 응답 흐름(클라이언트 `/api/results/analyze` 재트리거)을 기존과 동일하게 유지할 것.
- 주의: 유저가 결제 의사로 눌렀는데 0알 — Phase 2 전까지는 토스트 없이 옛 결과로 이동한다. 손해가 없는 방향의 혼란이므로 Phase 1 단독 선배포 허용.

### Phase 2 — 로그인 유저 중복 감지 + 안내 UI (운영자 안 구현)

**① 수정 파일·함수**
- `app/api/intake/session/route.ts` `POST` — 로그인 유저 existingResultId 계산 추가
- `app/checkout/page.tsx` — 중복 모달 버튼 구성 변경 + `charged:false` 토스트
- `app/teaser/page.tsx` — 동일

**② 변경 내용**
- intake/session: `if (!userId)` 게스트 블록과 별개로, **로그인 유저도** `result_unlocks`(user_id + input_hash) → `saju_results.full_json` 정상 여부 확인 후 `existingResultId` 반환. 세션은 그대로 생성(시간 고치기로 이어질 수 있으므로). 게스트 블록의 scoringVersion 비교는 로그인 경로에 넣지 않는다 — 서버 reuse가 버전 무관(freeze 정책)이므로 감지도 무관이어야 일관됨.
- 모달 개편 (운영자 안 그대로):
  - 주 버튼: **"그 결과 다시 보기"** → `/result?resultId=...` (0알)
  - 보조 링크: **"태어난 시간 고치기"** → 입력 화면 복귀
  - 하단: 다른 상품 추천 (올해의 운세 10알 · 오늘의 운세 5알 · 결혼운 · 재물운 — 기존 카드 컴포넌트 재활용, feedback_component_design)
  - **"새로 결제하기" 버튼 삭제** (checkout:718~728, teaser 동일 위치)
- spend 응답 `charged === false` 수신 시: "이미 본 결과라 알은 쓰지 않았어" 토스트 후 결과 이동 (모달을 뚫고 온 자동 spend 경로 대비).
- 카피는 토스풍·전문용어 금지(feedback_durumi_ui_style, feedback_durumi_saju_jargon). "input_hash" 같은 말 노출 금지.

**③ 검증 방법**
- 로그인 계정으로 기존 입력 → checkout 진입 → 모달 노출 확인 (지금은 안 뜸 → 떠야 함).
- 게스트 흐름 회귀 확인 (기존 게스트 감지 유지).
- 충전 후 자동 spend(pendingSpend) 경로에서 토스트 노출 확인.
- `npx next build`.

**④ 리스크**: 낮음. Phase 1이 이미 돈을 지키므로 UI 버그가 나도 금전 사고 없음. intake/session에 쿼리 1개 추가로 세션 생성이 ~수십 ms 느려지는 정도.

### Phase 3 — 세션·RPC 멱등성 (구조 보강, 배틀 포함)

**① 수정 파일**
- `supabase/migrations/2026XXXX_spend_coins_idempotent.sql` (신규)
- (선택) `lib/server/session-helpers.ts` `refundCoins` — 현행 유지 판단(아래)

**② 변경 내용** — `spend_coins`에 reference_id 멱등 가드:

```sql
-- 같은 reference로 이미 차감됐고 그 차감이 환불로 상쇄되지 않았으면 재차감 금지.
-- (yearly/today의 "_error 재시도 = 재결제"는 매번 새 sessionId라 영향 없음을 확인함)
CREATE OR REPLACE FUNCTION spend_coins(
  p_user_id UUID, p_amount INTEGER, p_reference_id TEXT DEFAULT NULL
) RETURNS TABLE(new_balance INTEGER, success BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_balance INTEGER;
  v_spent INTEGER;
  v_refunded INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  IF p_reference_id IS NOT NULL THEN
    SELECT COUNT(*) FILTER (WHERE type = 'spend'),
           COUNT(*) FILTER (WHERE type = 'refund')
      INTO v_spent, v_refunded
      FROM coin_transactions
     WHERE user_id = p_user_id AND reference_id = p_reference_id;
    IF v_spent > v_refunded THEN
      -- 이미 이 reference로 유효한 차감 존재 — 멱등 성공 반환(재차감 없음)
      SELECT coin_balance INTO v_balance FROM profiles WHERE user_id = p_user_id;
      RETURN QUERY SELECT COALESCE(v_balance, 0), TRUE;
      RETURN;
    END IF;
  END IF;

  SELECT coin_balance INTO v_balance FROM profiles
   WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN v_balance := 0; END IF;
  IF v_balance < p_amount THEN
    RETURN QUERY SELECT v_balance, FALSE; RETURN;
  END IF;

  UPDATE profiles SET coin_balance = coin_balance - p_amount
   WHERE user_id = p_user_id RETURNING coin_balance INTO v_balance;
  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'spend', -p_amount, v_balance, p_reference_id);
  RETURN QUERY SELECT v_balance, TRUE;
END; $$;
```

- 사전 전수 점검(feedback_shared_validator_audit): `spend_coins` 호출부 5곳(saju spend·battle spend·yearly retry·today retry·marriage·wealth)의 reference 의미를 표로 만들어 "같은 reference로 정당한 2회 차감" 케이스가 없는지 확정한 뒤 적용. 실측상 marriage/wealth는 orderId(호출마다 신규), yearly/today retry는 세션이 매번 신규라 충돌 없음 — 배포 전 재확인.
- `refundCoins`의 read-then-write race는 주석(session-helpers.ts:108~115)대로 의도된 수용(over-refund는 유저 손해 아님) — 이번 범위에서 변경하지 않음.

**③ 검증**: 스테이징 DB에 함수 적용 → `scripts/check-reuse-spend.mts` 케이스 (c) 재실행 → 같은 reference 2회 차감 불가 확인. 정상 분석·배틀·재시도 각 1회 회귀.

**④ 리스크**: 중간. DB 함수는 전 상품 공통 경로 — 잘못되면 전면 결제 중단. 그래서 **Phase 1·2와 분리 배포**하고, 롤백 SQL(기존 20260317 정의 재적용)을 마이그레이션 파일에 주석으로 동봉.

### Phase 4 — 반대 케이스: 생시 변경해도 원국 동일 경고 (v2, 선택)

주현(f54be2e9)형 케이스: 05:30↔06:00은 다른 해시지만 같은 卯시 → 점수·등급 동일, 결과 사실상 동일한데 14회 결제.

- **변경**: `input_hash` 의미는 절대 건드리지 않는다(전 테이블 공유 키 — 위험). 대신 intake/session에서 로그인 유저의 기존 결과들과 **사주 4주(pillars) + 나머지 입력 동일 여부**를 비교(`calculateSaju`는 이미 서버에 있음), 동일하면 `samePillarsResultId`를 내려 프론트가 "그 시간도 같은 시간대(묘시)라 결과가 달라지지 않아요" 경고 + 기존 결과 링크를 보여준다. 결제 차단은 하지 않는다(명시 경고 후 진행은 유저 선택 — 여기부터는 정당 과금).
- **리스크**: 세션 생성 시 사주 계산 비용 추가, 시니어 유저에게 개념 설명 난이도. 그래서 Phase 1~3·5 안정화 후 별도 판단. 이번 배포에 묶지 않는다.

### Phase 5 — 과거 75건 보상

**방침 제안: 75건 전액, 건당 10알, 54명 전원, 조용한 자동 지급 + 잔액 페이지에서 확인 가능한 원장 기록.**

- 근거: 전 건이 "대가 없는 차감"으로 성격이 같다. 몇 분 내 중복이든 44일 뒤 재결제든 유저가 받은 것은 0이다. 기준을 쪼개면(1분 이내만 보상 등) 기준 설명이 불가능해지고, 총액이 **750알 ≈ 7.5만원 상당(현금 아님, 코인)**이라 쪼갤 실익도 없다.
- 냥이(7b4581ce)는 이 75건에 포함 → 10알 지급으로 해소(현재 잔고 0 → 10).
- 주현(f54be2e9, 14회)은 **이 보상 대상이 아니다** — 매번 다른 해시로 새 결과 row가 생성됐으므로(생시가 실제로 달랐음) 현행 규칙상 정당 과금. Phase 4가 재발 방지책. 다만 선의 보상(예: 일부 알)을 원하면 별도 결정 사항으로 남긴다 — **운영자 판단 필요**.
- 능동 공지(카톡/문자)는 하지 않는 것을 제안: "과금 사고가 있었다"를 54명에게 먼저 알리는 것 자체가 리스크이고, 알 잔액 증가 + 원장 표기로 충분. 문의가 오면 정직하게 답한다. — 이견 있으면 운영자 결정.

**실행: `scripts/refund-reuse-charges.mts` (신규, dry-run 기본)**

1. 대상 확정: 운영자 실측 75건의 `coin_transactions.id` 리스트를 입력 파일로 사용 (스크립트가 재검증: 해당 spend tx의 세션 input_hash로 ±10분 내 신규 `saju_results` row 없음 확인). **조회는 페이지네이션 필수** (feedback_supabase_row_limit — 1000행 잘림).
2. `operator_grant_coins`(`supabase/migrations/20260518_operator_grant_coins.sql`)는 **멱등이 아니므로** 스크립트가 멱등성을 만든다:

```
ref = "operator:reuse-refund:" + spendTxId    // RPC가 'operator:'+reason으로 조립함
지급 전: coin_transactions에서 reference_id === ref 존재 확인 → 있으면 skip
없으면: rpc operator_grant_coins(user_id, 10, "reuse-refund:" + spendTxId)
```

   spend tx id가 reason에 박히므로 스크립트를 몇 번 돌려도 이중 지급이 없다.
3. 실행 순서: dry-run 출력(75건·54명·750알 확인) → 운영자 승인 → 실지급 → 지급 후 원장 대조 리포트(54명 잔액 diff).
4. **Phase 1 배포 이후에 실행** — 순서 바꾸면 보상받은 유저가 또 재결제 사고를 당할 수 있다.

**④ 리스크**: 낮음(스크립트 멱등 + dry-run). RPC 자체가 atomic(잔액+원장 단일 트랜잭션, advisory lock)임을 확인함.

---

## 3. 배포 순서 · 롤백

| 순서 | 내용 | PR | 롤백 |
|---|---|---|---|
| 1 | Phase 1 (spend 라우트 순서 교정) | 단독 PR, main 머지+배포는 운영자 승인 후 | `git revert` + 재배포. 스키마 변경 없어 즉시 가능 |
| 2 | Phase 2 (intake 감지 + 모달 개편) | 별도 PR | 동일 revert. Phase 1과 독립 동작 |
| 3 | Phase 5 (보상 스크립트 실행) | 코드 배포 아님, 운영 작업 | 지급 취소는 `operator_grant_coins` 음수 지급으로 가능하나 원칙적으로 안 함 |
| 4 | Phase 3 (RPC 멱등성 마이그레이션) | 별도 PR + SQL, 트래픽 한산 시간대 | 마이그레이션 파일에 동봉한 구버전 함수 정의 재적용 |
| 5 | Phase 4 (원국 동일 경고) | 안정화 후 별도 판단 | — |

배포 후 모니터링: `scripts/check-reuse-spend-daily.mts`(신규, check-today-errors.mts 패턴) — 최근 24h spend 중 "신규 row 없음" 건수 + `charged:false` reuse 로그 카운트. 1주일 0건 확인 후 종료.

---

## 4. 요약 체크리스트

- [ ] Phase 0: origin/main pull → `fix/reuse-charge`
- [ ] Phase 1: spend 라우트 — 확인-후-차감 + consumed 멱등 + unlock plain insert/23505 환불 + `charged:false`
- [ ] Phase 1 검증: build + check-reuse-spend.mts 5케이스 + 본인 계정 E2E
- [ ] 운영자 승인 → 배포 → 24h 감사 쿼리 0건 확인
- [ ] Phase 2: intake 로그인 감지 + 모달("다시 보기"/"시간 고치기"/상품 추천, "새로 결제" 삭제) + 토스트
- [ ] Phase 5: refund-reuse-charges.mts dry-run → 승인 → 750알 지급 → 원장 대조
- [ ] Phase 3: spend_coins 멱등 마이그레이션 (호출부 5곳 reference 표 검증 후)
- [ ] CLAUDE.md v17 표기 등 낡은 문서 정리(별건)
