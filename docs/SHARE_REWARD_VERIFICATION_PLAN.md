# 공유 보상 개편 계획서 (최종본 v5) — 카카오톡 공유 전송 확인 지급, 결과지 종류당 1회 5알

- 작성일: 2026-07-28 (v5 최종)
- 실측 기준: 워킹트리 `feat/wealth-luck-test` + **`origin/main`**(라인업·가격·테이블명 전수 실측은 origin/main)
- 상태: 계획 확정 — 코드 변경 없음. 미결정은 §11의 2건뿐

## 결정 로그

| # | 결정 | 상태 |
|---|------|------|
| 1 | "제3자가 링크를 열어야 지급"(방문 확인 방식) 기각 → **카카오톡으로 실제 전송이 일어나면 즉시 지급.** 확인 수단 = 카카오 공유 성공 웹훅(유일한 전송 확인 신호, §0) | **확정** |
| 2 | 차단 = **`CHAT_TYPE==='MemoChat'`(나와의 채팅) + `IS_SINGLE_CHATROOM===true`** 2가지만. 거부 시 nonce 미소모(재시도 가능), 관측 기록 | **확정** |
| 3 | **"링크 복사" 버튼 제거 → 카카오톡 공유 버튼으로 교체** (SDK 로드 실패 시 복사 강등 비상 경로만 유지) | **확정** |
| 4 | **오픈채팅(`OpenDirectChat`/`OpenMultiChat`) 허용** — 살포 가능성 인지하고 허용. 차단 로직 없음, 관측+env 토글 회귀만(§4.5) | **확정** |
| 5 | **보상 = 결과지 종류당 1회 5알.** `share_reward_grants(user_id, result_kind)` UNIQUE 테이블 + RPC kind 파라미터 + 기존 지급자 `'result'` 백필. **계정 총액 캡 없음**(근거 §6) | **확정** |
| 6 | **확장 대상 7종 = result / battle / yearly / pet / wealth / marriage / career** (career 포함). **today만 제외** | **확정** |
| — | Phase 0 결과 종속 PC 대응(§4.6) / today 파손 공유 버튼 처리(§10) | 미결정 2건(§11) |

---

## 0. 카카오 공식 문서 검증 결과 (2026-07-28 실확인)

| # | 질문 | 판정 | 근거 |
|---|------|------|------|
| 1 | 공유 성공 알림(웹훅) 제공 여부 | **제공됨.** 사용자가 선택한 친구/채팅방으로 메시지가 **성공적으로 전달된 경우** 발송(공유창 진입 시점 아님) | [웹훅](https://developers.kakao.com/docs/ko/kakaotalk-share/callback), [공통](https://developers.kakao.com/docs/ko/kakaotalk-share/common) |
| 2 | 동작 조건 | 콘솔 [앱] > [웹훅] > [카카오톡 공유 웹훅]에 URL 등록 + SDK 호출 시 **`serverCallbackArgs` 필수**(없으면 웹훅 미발송). 예약어 `CHAT_TYPE`/`HASH_CHAT_ID`/`TEMPLATE_ID`는 커스텀 키 불가. 검수 요구 언급 없음(단정 미확인 → Phase 0) | [웹훅](https://developers.kakao.com/docs/ko/kakaotalk-share/callback), [JS 가이드](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link) |
| 3 | JS SDK `Kakao.Share.send*` 클라이언트 성공 콜백 | **없음.** 클라이언트만으로 전송 완료 확인 불가 — **유일한 확인 수단 = 서버 웹훅** | [SDK 레퍼런스](https://developers.kakao.com/sdk/reference/js/release/index.html) |
| 4 | 커스텀 템플릿 | 불필요 — `sendDefault`에 `serverCallbackArgs` 있음 | 상동 |
| 5 | 도메인 등록 | **2곳 모두 필요** (2025-12 콘솔 개편으로 구 "플랫폼 Web 사이트 도메인"이 용도별 2곳으로 분리): ① **[앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]** — SDK API 호출 검증용. **여기 미등록이면 공유창에서 4019 "잘못된 요청으로 인증에 실패"** ② [앱] > [제품 링크 관리] > [웹 도메인] — 메시지 내 링크 검증용. 4019 에러 화면 문구는 ②만 안내하지만 실제 원인은 대부분 ① 누락(데브톡 공식 답변 3건 일치) | [JS 가이드](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link), [앱 키 개편 안내](https://developers.kakao.com/docs/ko/getting-started/app-key-migration), [데브톡 148809](https://devtalk.kakao.com/t/kakao-javascript-sdk/148809)·[149398](https://devtalk.kakao.com/t/api-4019/149398)·[150641](https://devtalk.kakao.com/t/topic/150641) |
| 6 | 웹훅 계약 | GET/POST. 헤더 `Authorization: KakaoAK {PRIMARY_ADMIN_KEY}` + `X-Kakao-Resource-ID` + `User-Agent: KakaoOpenAPI/1.0`. 바디 `CHAT_TYPE` 5종·`HASH_CHAT_ID`·`IS_SINGLE_CHATROOM`/`CHAT_MEMBER_COUNT_RANGE`(유료 설정 표기, 실수신 Phase 0 확인)·커스텀 키. **3초 내 2XX 필수. 재시도 정책 미문서화** | [웹훅](https://developers.kakao.com/docs/ko/kakaotalk-share/callback) |
| 7 | 위조 방어 | HMAC 서명 미제공 → 어드민 키 대조 + nonce 단일 소모 2중(§4.4) | 상동 |
| 8 | PC/미설치/인앱 동작 | **문서에 없음 — 미확인.** Phase 0 최우선 실측 | [SDK 레퍼런스](https://developers.kakao.com/sdk/reference/js/release/index.html) |

---

## 1. 현행 구조 실측 (파일:라인)

1. **지급 트리거**: `app/result/ResultClient.tsx:352-381` — 클립보드 복사(357) 성공 시 `POST /api/coins/share-reward`(368, origin/main 동일). 서버(`app/api/coins/share-reward/route.ts:8-30`)는 세션 확인만 하고 공유 증거 없이 RPC 호출.
2. **현행 멱등**: `supabase/migrations/20260621_share_reward.sql:20-60` — `profiles.share_reward_granted_at` + advisory lock + `FOR UPDATE`, 계정당 평생 1회 5알. **v5에서 종류당 1회로 대체(§4.2 마이그레이션)**.
3. **카카오 SDK**: OAuth 로그인뿐 — 공유용 JS SDK 신규 도입.
4. **미들웨어**: `middleware.ts:5` `/api/coins/*` 로그인 가드 → 웹훅 수신은 `/api/coins` 밖 필수.
5. **`lib/share-*.ts`는 클립보드 코드가 아니라 공개 share 페이지 데이터 로더** — 유지(카톡 메시지 링크 목적지).
6. **PC 비중 미확인**(Vercel Web Analytics 7/27 배포 직후). PortOne SDK 로드 실패 전례 → 방어 로딩(§4.1).

## 2. 가능/불가능/미확인

- 가능: 카톡 전송 완료 확인(웹훅) + 나와의 채팅/혼자 방 식별.
- 불가능: 수신자 열람 확인(요구사항 제외), 카톡 외 채널 전송 확인, 부계정·가족 계정 식별.
- 미확인(Phase 0): PC 동작·웹훅 발화, 인앱 동작, `IS_SINGLE_CHATROOM` 실수신, 재시도·지연, 검수 여부, PC 비중.

## 3. 확정안

**`Kakao.Share.sendDefault` + `serverCallbackArgs`에 1회용 nonce → 웹훅 수신 시 CHAT_TYPE 검증 → kind별 UNIQUE 관문으로 5알 지급.**

한계(운영자 인지 완료): 카톡 외 경로 무보상, PC/SDK 불가 환경 리스크(§4.6), `IS_SINGLE_CHATROOM` 미수신 시 MemoChat 차단만 동작, 웹훅 유실 시 미지급 CS(런북 §8).

---

## 4. 상세 설계

### 4.1 Kakao JS SDK

- 결과 화면에서만 지연 로드(전역 금지). `Kakao.init(NEXT_PUBLIC_KAKAO_JS_KEY)`.
- 로드 실패 시(PortOne 전례, CLAUDE.md "외부 SDK 로드 실패 에러 핸들링 필수") 해당 세션 한정 클립보드 복사 강등(보상 문구 없음) + 로그. 사용자 메시지는 한국어 일반 문구만.
- `sendDefault({ objectType:'feed', content:{라인별 소재+이미지(§5 표)}, buttons:[{title:'결과 보러 가기', link:{webUrl:'<라인별 share URL>'}}], serverCallbackArgs:{ n: nonce }, installTalk:true })`. 카톡 카드 이미지는 `content.imageUrl` 직접 지정 — OG 메타와 무관.

### 4.2 DB 스키마 (신규 마이그레이션 `2026XXXX_share_kakao_reward.sql` 초안)

```sql
-- ============================================================
-- 공유 보상 v2: 카카오 전송 확인 + 결과지 종류당 1회 5알
-- ============================================================

-- 1) kind별 지급 원장 (UNIQUE = 멱등의 최종 관문)
CREATE TABLE share_reward_grants (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_kind TEXT NOT NULL CHECK (result_kind IN
    ('result','battle','yearly','pet','wealth','marriage','career')),  -- §4.7 확정 집합 (today 없음)
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, result_kind)          -- 종류당 1회를 DB 제약으로 보장
);

-- 2) 기존 지급자 백필 (grandfather): 구 방식 지급은 전부 result 라인에서 발생
--    (실측 근거 §5 — 보상 연결된 공유 버튼이 result에만 있었음)
INSERT INTO share_reward_grants (user_id, result_kind, granted_at)
SELECT user_id, 'result', share_reward_granted_at
FROM profiles
WHERE share_reward_granted_at IS NOT NULL
ON CONFLICT (user_id, result_kind) DO NOTHING;
-- profiles.share_reward_granted_at 컬럼은 드랍하지 않고 유지(롤백 안전판 + 과거 감사).

-- 3) RPC 교체: kind 파라미터 버전 (구 grant_share_reward(uuid)는 새 코드 배포 후 미호출로 남김)
CREATE OR REPLACE FUNCTION grant_share_reward_v2(p_user_id UUID, p_kind TEXT)
RETURNS TABLE(success BOOLEAN, reward_amount INTEGER, new_balance INTEGER, reason TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  v_reward CONSTANT INTEGER := 5;
  v_balance INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));  -- 기존 코인 RPC들과 동일 키

  INSERT INTO profiles (user_id, coin_balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 종류당 1회: PK(UNIQUE) 위반이면 미지급
  BEGIN
    INSERT INTO share_reward_grants (user_id, result_kind) VALUES (p_user_id, p_kind);
  EXCEPTION WHEN unique_violation THEN
    SELECT coin_balance INTO v_balance FROM profiles WHERE user_id = p_user_id;
    RETURN QUERY SELECT FALSE, 0, v_balance, 'already_granted'::TEXT;
    RETURN;
  END;

  UPDATE profiles SET coin_balance = coin_balance + v_reward
    WHERE user_id = p_user_id RETURNING coin_balance INTO v_balance;

  INSERT INTO coin_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'bonus', v_reward, v_balance, 'share_reward:' || p_kind);

  RETURN QUERY SELECT TRUE, v_reward, v_balance, 'granted'::TEXT;
END; $$;

-- 4) 1회용 nonce (지급 성공 시에만 소모)
CREATE TABLE share_kakao_nonces (
  nonce TEXT PRIMARY KEY,                     -- base64url(randomBytes(16))
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_kind TEXT NOT NULL CHECK (result_kind IN
    ('result','battle','yearly','pet','wealth','marriage','career')),
  result_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  consumed_at TIMESTAMPTZ,
  last_reject_reason TEXT                     -- 'memo_chat'|'single_chatroom'
);
CREATE INDEX idx_share_nonces_user ON share_kakao_nonces (user_id, created_at DESC);

-- 5) 웹훅 소모+지급 원자 RPC
--    consume_share_nonce_and_grant(p_nonce, p_chat_type, p_resource_id):
--    nonce FOR UPDATE → 미소모·미만료 확인 → grant_share_reward_v2(user_id, result_kind) 호출
--    → granted면 consumed_at 기록. (kind는 nonce row에서 읽는다 — 웹훅 페이로드의 kind는 신뢰하지 않음 §4.7)
--    (동일 advisory lock 키의 트랜잭션 내 재진입은 pg_advisory_xact_lock이 허용 — 데드락 없음)

-- 6) 웹훅 수신 전수 로그 (관측·감사)
CREATE TABLE share_kakao_webhook_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nonce TEXT, resource_id TEXT, chat_type TEXT,
  is_single_chatroom BOOLEAN, chat_member_count_range TEXT,
  verdict TEXT NOT NULL   -- granted|already_granted|rejected_memo_chat|rejected_single_chatroom|invalid_nonce|expired|auth_fail
);
CREATE INDEX idx_share_webhook_log_nonce ON share_kakao_webhook_log (nonce, received_at DESC);
CREATE INDEX idx_share_webhook_log_chat_type ON share_kakao_webhook_log (chat_type, received_at DESC);
```

**마이그레이션 중·후 이중지급이 불가능한 이유(명시):**
1. 백필이 기존 지급자를 `('result')` 행으로 선점 → 신 경로에서 그 사용자의 result 재지급은 PK 위반 = `already_granted`. 다른 kind 지급은 이중지급이 아니라 정책 (b)가 의도한 신규 지급이다.
2. 마이그레이션 적용~코드 배포 사이에 구 코드가 구 RPC로 지급하는 창이 있어도: 구 RPC는 `share_reward_granted_at` 플래그로 여전히 평생 1회 멱등이며, 그 지급자는 **배포 직후 재백필 1회**(위 2번 INSERT 재실행 — `ON CONFLICT DO NOTHING`이라 몇 번 돌려도 안전)로 grants에 반영된다. 배포 순서: 마이그레이션 → 코드 배포 → 재백필 1회.
3. 신 경로 자체는 PK(UNIQUE) + advisory lock + nonce 단일 소모 3중이라 동시·중복 웹훅에도 kind당 1회 초과 불가.

### 4.3 API 계약

#### (1) `POST /api/coins/share-reward/prepare` — nonce 발급 (로그인 필수)
```
요청: { resultKind, resultId }
응답 200: { nonce, alreadyGranted }    // alreadyGranted = 해당 kind 기수령 (공유는 가능, 보상 UI만 생략)
에러: 401 / 400(소유자·kind 검증 실패 §4.7) / 429(사용자당 미소모 nonce 시간당 10개 초과)
```

#### (2) `GET|POST /api/share/kakao-callback` — 웹훅 수신 (비인증 공개, `/api/coins` 밖, matcher 미포함)

**3초 내 2XX — 동기 처리 설계(명시):** ① 어드민 키 문자열 비교 ② 파싱 ③ 단일 RPC ④ 로그 INSERT = DB 왕복 2회 수준(통상 수백 ms, advisory lock 경합은 사용자 단위라 실질 0). **"검증→지급→로그→200" 동기 완결이 기본.** Phase 0에서 콜드스타트 포함 p95 실측(게이트 p95<1.5s). 비상 구조(기본 비활성): 예산 위협 시 "웹훅은 로그 INSERT만+200, 지급 확정은 status 폴링 요청이 미처리 로그 소비". **Vercel 서버리스는 응답 후 실행 미보장 → fire-and-forget 비동기 금지.** 응답은 검증 실패 포함 모든 경우 2XX(재시도 미문서화라 5XX 득 불확실), 실패는 verdict 로그로만.

```
① Authorization === "KakaoAK " + KAKAO_ADMIN_KEY → 불일치: 'auth_fail', 200
② nonce(n)·CHAT_TYPE·IS_SINGLE_CHATROOM 파싱 (GET 쿼리/POST 바디 모두)
③ CHAT_TYPE==='MemoChat'     → 'rejected_memo_chat',       nonce 미소모, last_reject_reason 기록, 200
   IS_SINGLE_CHATROOM===true → 'rejected_single_chatroom', nonce 미소모, last_reject_reason 기록, 200
   (오픈채팅 차단 없음 — 확정. env SHARE_REWARD_BLOCK_OPEN_CHAT=1 설정 시에만 여기서 거부)
④ consume_share_nonce_and_grant → granted|already_granted|invalid_nonce|expired 로그, 200
   (kind는 nonce row에서만 — §4.7)
```

#### (3) `GET /api/coins/share-reward/status` — 로그인 필수
```
응답 200: { state:"none"|"granted"|"rejected", rejectReason?, grantedKind?, grantedAt? }
```
클라이언트: 공유창 닫힌 뒤 2초 간격 최대 30초 폴링 → granted/rejected 토스트(§7 문구), 미도달 시 무문구 종료.

### 4.4 웹훅 위조 방어

어드민 키 대조(`KAKAO_ADMIN_KEY` 서버 env 전용 — 클라이언트/레포 노출 금지) + nonce 단일 소모(발급자에게만 전달, 30분 만료). 위조에는 두 시크릿 동시 확보가 전제. `User-Agent`는 참고 로그. `auth_fail` 다발은 전수 로그로 관측.

### 4.5 지급 조건

```
지급 = 웹훅 수신 AND CHAT_TYPE!=='MemoChat' AND IS_SINGLE_CHATROOM!==true(필드 부재=통과)
     AND nonce 유효 AND (user_id, result_kind) 미지급 (PK 관문)
```
거부는 nonce 미소모(같은 nonce로 재시도 가능). **오픈채팅 허용은 살포 가능성을 인지한 확정 결정** — 관측(kind×chat_type×verdict 분포)만 하고, 이상 시 env 토글 `SHARE_REWARD_BLOCK_OPEN_CHAT=1`로 회귀(재배포만으로 차단 전환).

### 4.6 버튼 교체와 PC 리스크

- `ResultClient.tsx:352-381` 재작성(클립보드 복사·보상 POST·`shareRewardedRef` 제거), "링크 복사" 상시 버튼 제거(SDK 실패 강등만 유지). 공용 `KakaoShareButton` 컴포넌트로 제작해 7종 라인에 재사용.
- PC 동작·비중 미확인 → Phase 0 최우선. **미지원 판명 시 권고 = PC에선 복사 버튼(무보상) + 안내 한 줄** "휴대폰에서 카카오톡으로 공유하면 5알을 드려요". (대안: 영역 숨김=바이럴 차단 / 안내만=그 자리 공유 불가) → 미결정 §11-①.

### 4.7 `result_kind` 신뢰 설계 — **새 정책의 핵심 취약점 대응**

kind당 1회 지급이 되면서 **"클라이언트가 kind를 조작해 다른 kind로 또 받기"**가 최대 공격면이다. 대응 원칙: **kind는 클라이언트 주장값이 아니라 서버가 검증·저장한 값만 쓴다.**

1. **kind 값 집합 확정(문자열 상수)**: `'result' | 'battle' | 'yearly' | 'pet' | 'wealth' | 'marriage' | 'career'` — DB CHECK(§4.2)와 TS 유니언(`lib/constants/share-reward.ts` 신설)으로 이중 고정. `today`는 집합에 없어 API·DB 어느 층에서도 통과 불가.
2. **발급 시점 검증(핵심)**: prepare가 kind→테이블 **고정 매핑**으로 해당 kind의 실물 결과 row 소유를 확인해야만 nonce를 발급한다:

| kind | 검증 (전부 origin/main 실측 테이블) |
|------|------|
| result | `saju_results.id = resultId AND user_id = 세션` |
| battle | `saju_battles.id AND user_id = 세션` (user_id NULL 게스트 배틀은 발급 거부) |
| yearly | `yearly_results.id AND user_id = 세션` |
| pet | `pet_compat_results.id AND user_id = 세션` |
| wealth | `wealth_results.id AND user_id = 세션 AND full_json IS NOT NULL`(결제 전 teaser row 배제) |
| marriage | `marriage_results.id AND user_id = 세션 AND full_json IS NOT NULL` |
| career | `career_results.id AND user_id = 세션 AND` 결제 완료 조건(`career_result_unlocks` 대조 — 구현 시 확정) |

   → kind를 속이려면 그 kind 테이블에 **본인 소유의(결제 완료된) 실물 row**가 있어야 한다. 즉 "다른 kind로 또 받기" = "그 상품을 실제로 구매·분석 완료" = 정책이 의도한 정당한 지급. **조작으로 얻을 수 있는 부당 지급이 정의상 없다.**
3. **소비 시점**: 웹훅 핸들러·RPC는 kind를 **nonce row에서만** 읽는다(§4.2-5). 웹훅 페이로드·쿼리의 어떤 값도 kind로 쓰지 않는다(serverCallbackArgs에 kind를 실어 보내와도 무시).
4. **원장 표기**: `coin_transactions.reference_id='share_reward:<kind>'` — kind별 지급을 원장에서 바로 감사 가능.

---

## 5. 라인업 전수 실측 (origin/main, 2026-07-28) — 확장 대상 7종

| 라인 | share 라우트 | 공유 버튼 | `lib/share-*` | 추가 필요물 | 공수 |
|------|-----|-----|-----|------|------|
| result | O | O(보상 연결, 유일) `ResultClient.tsx:352` | O | 없음(동적 OG `/api/og/result/[id]`) | Phase 1 |
| battle | O | O(무보상) `BattleResultView.tsx:55` | O | 없음(동적 OG `/api/og/battle/[id]`) | 배선만(2a) |
| yearly | O | O(무보상) `YearlyResultClient.tsx:729` | O | 없음(정적 `yearly-share-kakao.jpg`를 카톡 이미지로) | 배선만(2a) |
| pet | O (`app/pet/result/share/[id]`) | O(무보상) `PetResultClient.tsx:115` | O(`share-pet-compat`) | 없음(정적 `og-image.png`) | 배선만(2a) |
| wealth | X | X | X(죽은 코드) | share 페이지+버튼+카톡 이미지 1장+OG (데이터 로더는 준비됨) | 신규 구현(2b) |
| marriage | X | X | X(죽은 코드) | 상동 | 신규 구현(2b) |
| career | X | X | X(`share-career` 죽은 코드) | 상동 | 신규 구현(2b) — **결정 6으로 포함 확정** |
| today | X | O — **파손**(소유자 전용 API 뒤, 친구 못 엶) | — | — | **제외 확정.** 파손 처리 별건(§10) |

공수 감: 2a 전체 ≈ 2b 한 라인(share 페이지 렌더링 신규 제작이 2b의 본 공수).

## 6. 보상 정책 확정: 종류당 1회 5알, 총액 캡 없음

- **(b)안 확정**: `share_reward_grants(user_id, result_kind)` PK/UNIQUE + `grant_share_reward_v2(user_id, kind)` + 기존 지급자 `'result'` 백필 grandfather(§4.2).
- **총액 캡을 두지 않는 결정(운영자)**: 캡 로직·기준 설명의 복잡도와 "왜 안 줘요" CS 비용이 실익보다 크다. 상한이 자연 봉인되기 때문 — **전 라인이 유료 상품**(origin/main `lib/constants/coins.ts` 실측: SAJU 10 / BATTLE 20 / YEARLY 10 / TODAY 5 / PET 20(출시가 10) / MARRIAGE 10 / WEALTH 10 / CAREER 10)이라 보상은 "해당 상품을 구매한 사람만" 받는 구조다. 7종 전부 받으려면 **선지출 90알 대비 최대 환급 35알** — 어뷰징이 아니라 최우수 고객 리워드다.
- today 제외 결정이 결과적으로도 옳다: 5알짜리 상품에 5알 지급 = 실질 무료화라 보상 구조가 성립하지 않았다.

## 7. 최종 UI 문구 확정안 (승인용 일람 — 시니어 대상 실문장)

| 상황 | 문구 |
|------|------|
| 랜딩 배너(`ShareRewardBanner.tsx`) | "결과를 카카오톡으로 공유하면 [5알 선물]" |
| 공유 버튼(해당 결과지 미수령) | **"카카오톡으로 공유하고 5알 받기"** |
| 공유 버튼(해당 결과지 기수령 = alreadyGranted) | **"카카오톡으로 공유하기"** (보상 언급 없음 — 라벨이 곧 안내) |
| 지급 성공 토스트 | **"공유 완료! 5알이 들어왔어요 🎁"** |
| MemoChat/혼자 방 거부 토스트 | **"나와의 채팅은 제외돼요. 친구에게 보내주세요"** |
| 기수령 kind 재공유 완료 시 | **"공유 완료!"** (보상 언급 없음) |
| 웹훅 지연(30초 폴링 미도달) | 화면 문구 없음. 코인함 하단 상시 안내 **"카카오톡으로 친구에게 공유를 마치면 잠시 뒤 5알이 들어와요"** + 코인함 내역 라벨 **"공유 선물 5알"** |
| SDK 로드 실패 강등(복사) | **"링크를 복사했어요"** (보상 언급 없음) |
| (조건부, PC 미지원 시) PC 안내 | **"휴대폰에서 카카오톡으로 공유하면 5알을 드려요"** |

원칙: "무료" 단어 금지(운영 룰), 대기·검증 등 시스템 용어 금지, 한 문구 = 한 정보.

## 8. 단계별 구현 & 검증

### 착수 전 준비 (필수)
- **로컬 워킹트리가 낡았다**: 현재 `feat/wealth-luck-test`에는 origin/main에 이미 있는 pet·career가 없다. `git fetch origin` 후 **origin/main에서 새 브랜치 `feat/share-reward-kakao` 분기**(브랜치 전략 룰: 두루미 작업은 항상 main에서 새 브랜치).

### Phase 0 — 콘솔 설정 + 실측 스파이크 (반나절, 머지 없음) — 운영자가 순서대로 따라 하는 체크리스트

1. **[콘솔] 키 확인**: https://developers.kakao.com → 내 애플리케이션 → 두루미 앱 선택 → **[앱 설정 > 앱 키]**에서 ① JavaScript 키(→ env `NEXT_PUBLIC_KAKAO_JS_KEY`) ② 어드민 키(→ env `KAKAO_ADMIN_KEY`, **서버 전용 — NEXT_PUBLIC 금지**) 확보 → Vercel 환경변수 + 로컬 `.env.local` 등록.
2. **[콘솔] 도메인 등록 — 2곳 모두** (§0-5, 2025-12 콘솔 개편 반영):
   - ① **[앱] > [플랫폼 키] > [JavaScript 키(Default JS Key)] > [JavaScript SDK 도메인]**: `https://www.durumisaju.com` / `https://durumisaju.com` / `https://durumi-saju.vercel.app` / `http://localhost:3000` 전부 등록. **여기 빠지면 공유창은 뜨되 전송 단계에서 4019.** (기존 카카오 로그인은 서버측 OAuth라 이 목록 없이도 동작 — "로그인 되니까 도메인 OK"로 착각 금지)
   - ② [앱] > [제품 링크 관리] > [웹 도메인]: 동일 도메인 등록(2026-07-28 등록 확인됨).
3. **[콘솔] 웹훅 등록**: [앱] > [웹훅] > **[카카오톡 공유 웹훅]**에 콜백 URL 등록(테스트: 프리뷰 배포 또는 터널의 `/api/share/kakao-callback`). **이 메뉴에서 검수·비즈앱 요구가 뜨는지 여기서 확정**(문서상 언급 없음 — 미확인 항목).
4. **[실측] 공유 매트릭스**: 테스트 페이지 1장으로 `sendDefault + serverCallbackArgs:{n:'test'}` 전송. 각 케이스에서 (웹훅 도달 / 지연 ms / 중복 도착 / 실제 메소드 / 바디 원문)을 기록:
   - **PC 크롬, PC 사파리 (최우선)** — 공유 UI가 뜨는지부터. §11-① 결정 근거
   - iOS 사파리, 안드로이드 크롬
   - **카톡 인앱브라우저**(결과 링크를 카톡으로 받아 열었을 때)
   - 전송 대상 변주: 친구 1명 / 단체방 / **나와의 채팅**(`CHAT_TYPE=MemoChat` 원문) / **오픈채팅** / `IS_SINGLE_CHATROOM` 실수신 여부
5. **[실측] 3초 예산**: 검증+RPC+로그 동기 테스트 핸들러의 콜드스타트 포함 p95.
6. **[실측] PC 비중**: Vercel Web Analytics 디바이스 분포(7/27부터 축적 — 표본 부족 시 "추정치" 명기, 2주 후 재확인).

DoD: 매트릭스 표 완성, §0-8·§2 미확인 전부 확정, PC 대응(§11-①) 결정 상신.

### Phase 1 — result 라인 구현
범위: §4 전체(마이그레이션+백필, API 3종, SDK, `ResultClient.tsx` 교체, `KakaoShareButton` 공용 컴포넌트, `lib/constants/share-reward.ts`, 배너 문구). 배포 순서: 마이그레이션 → 코드 → **재백필 1회**(§4.2 사유 2).
DoD:
- [ ] 공유창 취소 → 지급 0, 문구 없음
- [ ] 친구 전송 → 수 초 내 5알+토스트. 같은 kind 재전송 → 추가 지급 0(`already_granted`)
- [ ] 나와의 채팅 → 지급 0+거부 토스트+nonce 미소모 → 이어 친구 전송 시 **같은 nonce로** 지급 성공
- [ ] 오픈채팅 전송 → 지급 인정+`chat_type` 로그
- [ ] **kind 위조**: prepare에 타 kind+본인 result id / 타인 id / 게스트 배틀 id → 전부 400
- [ ] 위조 웹훅(어드민 키 불일치·소모·만료·타인 nonce) → 지급 0, verdict 로그
- [ ] 동시 웹훅 2발 race → `coin_transactions` COUNT=1 (`npx tsx scripts/` 하네스)
- [ ] 구 지급자: 백필 확인 + result 재수령 불가 + (Phase 2 후) 타 kind 수령 가능
- [ ] SDK 로드 실패 강제 → 복사 강등, 에러 미노출
- [ ] 웹훅 p95 < 1.5s / `npx next build` 성공
런북: 미지급 CS → `share_kakao_webhook_log` verdict 확인 → 정당 시 `operator_grant_coins`(`20260518_operator_grant_coins.sql`)로 보정.

### Phase 2 — 확장 (7종 완성)
- **2a 배선(battle·yearly·pet)**: 기존 공유 버튼을 `KakaoShareButton`으로 교체 + prepare kind 검증 확장(§4.7 표). 라인별 DoD = Phase 1 핵심 케이스 재현.
- **2b 신규 구현(wealth·marriage·career)**: 라인별 공개 share 라우트+페이지+카톡 이미지 1장+버튼 신설 후 2a와 동일 배선(죽은 코드 `lib/share-*.ts`가 이때 배선됨). career는 결제 완료 조건(`career_result_unlocks`) 확인 포함.
- 관측: kind×chat_type×verdict 분포(오픈채팅 감시 — §4.5 회귀 트리거), 웹훅 도달률·지연, 공유→유입(`users.referrer` `kakaotalk_inapp` 대조).

### 롤아웃 & 롤백
- 마이그레이션 선적용(구 코드 무충돌: 구 RPC·플래그 그대로 존재) → 코드 배포 → 재백필 1회. 구 캐시 번들의 구 POST는 `{granted:false}` 응답으로 무해(`ResultClient.tsx:371` 로직상 기본 토스트만).
- 롤백: 코드 되돌리면 구 동작(플래그 기반 평생 1회) 복귀 — `share_reward_granted_at` 유지가 안전판. 신규 테이블 잔존 무해. 오픈채팅 회귀는 env 토글.
- 배너 문구는 동작 변경과 같은 배포에서 교체(문구-실동작 불일치는 CS 직행).

## 9. 별건 (범위 밖 기록)

- `components/result/ShareCTA.tsx`·`components/battle/BattleShareCTA.tsx`는 공유 버튼이 아니라 공개 share 페이지의 방문자 전환 CTA — 수정 대상 아님.

## 10. today 파손 공유 버튼 (별건, 미결정 §11-②)

`TodayResultClient.tsx:187-200`의 공유 URL `/today/result/{id}`는 소유자 전용 API(`app/api/today/results/[id]/route.ts:15-32`) 뒤 — **받은 친구가 결과를 못 연다.** 보상 제외는 확정이므로 남은 선택: (가) 방치 (나) 버튼 제거 (다) 공개 share 라우트 신설해 수리(보상은 계속 없음). 권고: (나) 또는 (다) — 파손된 공유는 브랜드 신뢰 손상.

## 11. 남은 미결정 (딱 2건)

1. **(조건부) PC 대응**: Phase 0에서 PC 웹 공유 미지원 판명 시 §4.6 권고안(PC에선 복사 버튼 무보상 + "휴대폰에서 카카오톡으로 공유하면 5알을 드려요" 안내) 승인 여부.
2. **today 파손 공유 버튼 처리**(§10): 방치 / 제거 / 무보상 수리.
