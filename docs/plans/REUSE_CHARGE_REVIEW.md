# PR#104 (fix/reuse-charge) 적대적 검토 리포트

검토일: 2026-07-29 · 대상 커밋: `6d2123a` + `370d5a6` · 검토 방식: 정적 코드 추적 + 프로덕션 DB 읽기 전용 감사 + `tsc`/`next build`

## 판정: **조건부 GO**

- 매출 경로(신규 분석 정상 차감)는 깨지지 않았다 — 코드 추적으로 확인.
- 치명 결함 0건. 다만 **중대 1건(사전조회 에러 시 fail-open → 기존 완성 결과 파괴 가능)** 은 한 줄짜리 수정이므로 배포 전에 고치는 걸 권장한다. 안 고치고 배포해도 "돈이 새는" 게 아니라 "드문 에러 상황에서 결과가 재생성되는" 문제라 롤백 사유는 아니다.

---

## 검증에 사용한 실측 (프로덕션 DB, 읽기 전용)

| 항목 | 결과 |
|---|---|
| `result_unlocks` 총 행수 | 2,875 |
| `(user_id, input_hash)` 중복 키 | **0건** → `maybeSingle()` 안전, 유니크 인덱스 실존과 정합 |
| 죽은 `result_id`를 가리키는 unlock | **0건** → FK `on delete cascade` 작동 확인 (마이그레이션 `20260131_result_unlocks.sql:4`) |
| `full_json IS NULL`인 `saju_results` | 2건 (각각 62일·65일 전 stuck pending, 둘 다 unlock 보유) |
| `npx tsc --noEmit` | 통과 |
| `npx next build` | 통과 (dev 서버 미가동 확인 후 실행; :3000은 Docker) |

※ 유니크 인덱스 `result_unlocks_user_input_unique`의 **프로덕션 실존 자체는 PostgREST로 직접 증명 불가**(pg_catalog 미노출). 정황 증거는 3중: 마이그레이션 SQL, 2,875행 중복 0, 기존 코드의 23505 관측 주석. 확정하려면 Supabase 대시보드 SQL 에디터에서 `select indexname from pg_indexes where tablename='result_unlocks';` 1회 실행.

---

## 발견된 결함

### [중대-1] 사전조회(pre-check) 에러가 fail-open — 기존 완성 결과를 파괴·재생성할 수 있다
`app/api/coins/spend/route.ts:97~102` — `existingUnlock.error`를 검사하지 않는다. unlock SELECT가 일시 오류(네트워크/Supabase 5xx)를 반환하면 `data`가 null이라 "기존 결과 없음"으로 오판하고 그대로 진행한다. 그 결과:

1. `spend_coins` 차감 (10알)
2. `saju_results` upsert가 **기존 완성 row의 `full_json/teaser_json/saju_text`를 null로 리셋** (line 264~285, onConflict `user_id,input_hash`)
3. unlock insert → 23505 → 환불 + `pending:true` 반환
4. 클라이언트가 analyze 재호출 → **v18 산식으로 결과 재생성 → grandfather(결제자 보호) 위반, 등급이 바뀔 수 있다**

돈은 환불되므로 금전 손실은 없지만, "이미 언락된 결과는 재계산 안 함" 정책이 뚫린다. 빈도는 낮다(해당 SELECT의 일시 오류 확률). 참고로 **구코드도 같은 fail-open이었고 환불조차 없었으므로 순수 회귀는 아니다** — 그러나 이번 PR의 목적이 정확히 이 불변식 보강이므로 같이 닫는 게 맞다.

**수정**: line 97 결과에서 `if (existingUnlock.error) return 500` (차감 전이므로 환불 불필요, 재시도 안내만). `intake/session:103~108`의 같은 패턴은 fail-safe 방향(모달만 안 뜨고 서버가 막음)이라 그대로 둬도 된다.

### [경미-1] 무차감 토스트가 실제로는 거의 안 보인다
`app/result/ResultClient.tsx:363~368` — 토스트 플래그를 마운트 즉시 소비하고 2.6초 뒤 끈다. 그런데 `analysisStatus === "pending"`(재사용 pending 재진입)이거나 로딩 중이면 컴포넌트가 토스트 JSX(line 557) 도달 전에 early return — **pending 재사용에선 토스트가 100% 유실**, 완료 결과 재사용도 fetch가 2.6초 넘게 걸리면 유실. 기능 파괴는 아니고 안내 누락. 수정하려면: 토스트를 로딩/pending 화면에도 렌더하거나, `sessionStorage` 소거를 "실제 표시 시점"으로 미루거나, result 로드 완료 후에 notify.

### [경미-2] `/api/intake/session` 추가 조회가 today/yearly 세션 생성까지 태운다
새 로그인 유저 체크(unlock 조회 + `saju_results.full_json` 전체 fetch)는 이 라우트를 쓰는 **모든** 흐름에서 실행된다. 호출부 실측: checkout, teaser 외에 `app/today/TodayEntryClient.tsx:114`, `app/today/input/page.tsx:49`, `app/yearly/YearlyEntryClient.tsx:120`, `app/yearly/input/page.tsx:58`. today/yearly 단골은 개인사주 결과 보유자라 매번 히트해서 **수십~수백 KB짜리 full_json을 통째로 읽는다**. 오동작은 없다(응답 필드는 무시됨). 개선: `select("id, full_json")` 대신 `full_json->_error` 같은 JSON 경로 선택 또는 today/yearly 요청 구분 스킵.

### [경미-3] 모달이 "분석 진행 중" 결과도 "이미 보신 결과"로 안내
`intake/session:117~119`가 `full_json IS NULL`(진행 중/stuck)도 existingResultId로 내려보내고, 모달 문구는 "이미 보신 결과가 있어요"다. 아직 본 적 없는 결과라 문구가 부정확하지만, 클릭하면 `/result` → `results/full` 202 → pending 화면 + analyze 재트리거로 **오히려 stuck row를 치유**한다(아래 시나리오 9). 동작상 무해.

### [경미-4] 이중 Gemini 분석 (기존 결함, PR로 악화 아님 — 명시적으로 기록)
pending 재진입 재사용 응답이 `pending:true`를 주면 클라이언트가 `/api/results/analyze`를 다시 호출한다. analyze에는 in-flight 잠금이 없어(`full_json === null`만 검사, route.ts:37) **원래 돌던 Gemini와 병렬 실행**된다. 구코드에서도 `results/full` 202 → pending → analyze 경로로 동일하게 발생했으므로 회귀는 아니다. 위험: 두 호출 중 하나가 실패(~1.2% 블립)하면 `_error` 마커가 성공 결과를 덮고 10알을 환불한다(과환불+결과 파손, 순서 의존). 후속 과제: `analysis_started_at` 컬럼 등으로 analyze 멱등 잠금.

### [경미-5] 크래시 창 이중 차감 (기존과 동일, 미해결로 기록)
spend 성공 → unlock insert 사이(수백 ms)에 서버리스 함수가 죽으면: 차감 반영·unlock 없음·환불 없음. 재 POST 시 pre-check가 unlock을 못 찾아 **재차감**된다(합계 20알/결과 1개). `catch`는 throw만 잡고 프로세스 킬은 못 잡는다. 구코드도 동일 노출이라 회귀 아님. 근본 해결은 spend+unlock의 단일 RPC 원자화(계획서도 인지).

### [경미-6] refundCoins 이론적 이중환불/유실
`session-helpers.ts:110~137` — read-then-write 비원자(주석으로 문서화된 기존 트레이드오프). 23505 경로에서 refundCoins의 Promise.all 일부만 성공하고 throw되면 바깥 catch(line 346)가 **한 번 더 환불**할 수 있다(+20/차감 10). 확률 극히 낮음(같은 요청 내 네트워크 블립 2연속). 사용자 손해 방향 아님.

---

## 12개 시나리오 판정

1. **정상 신규 분석** — **통과**. pre-check 미스 → spend 차감 → result upsert → unlock plain insert → consumed+primary → `{charged:true, pending:true, balance}` 반환. 매출 경로 이상 없음. 부수 개선: 구코드는 `autoSetPrimaryIfNeeded`가 unlock upsert와 **동시에** Promise.all로 돌아 primary 설정이 race로 누락될 수 있었는데, 신코드는 unlock insert 후 실행이라 잠재 race가 닫혔다.
2. **동일 입력 재진입(정상 결과)** — **통과**. 차감 0, `reused:true, charged:false`, balance 없음. 프론트 3곳 모두 `typeof data.balance === "number"` 가드(checkout:457, teaser:305) 또는 미사용(coins는 즉시 이탈)이라 잔액 표시 안 깨짐. 스토어 잔액은 차감 전 값 그대로 = 실제값과 일치.
3. **분석 진행 중 재진입** — **통과(단서)**. 차감 0 + `pending:true` → analyze 재호출 → 이중 Gemini 병렬 실행. 이건 구코드에서도 202 경로로 동일 발생하던 기존 결함(경미-4). 이중 과금은 없다. 결과 덮어쓰기는 같은 입력 → 같은 산식이라 내용 유사, `_error` 경합만 위험(~1.2%).
4. **`_error` row 재시도** — **통과**. pre-check가 `analysisRetryResultId`만 세팅하고 통과 → 정상 차감 → row reset → `charged:true, pending:true`. yearly/start 정책과 동일 유지.
5. **동시 요청 2개** — **통과(단서)**. 유니크 인덱스(중복 0건 실측)로 loser가 23505 → 환불 1회 + `reused, charged:false, pending:true`. 환불 reference_id=sessionId는 spend의 reference_id와 동일해 대조 정확(analysis는 skipSpend 가드 제외라 간섭 없음). 이중환불은 refundCoins 부분실패+catch 재환불의 이론 경로만(경미-6). 환불 누락은 함수 킬 시에만(경미-5와 동근). loser의 upsert가 winner row의 full_json을 null로 덮지만 그 시점(수백 ms 내)엔 어차피 null이라 실질 무해.
6. **consumed 세션 재POST** — **의도대로**. unlock 존재 → 차감 0 재사용. 단 "result row만 만들고 unlock 직전에 죽은" 크래시 창은 재차감된다(경미-5, 기존과 동일·회귀 아님).
7. **pet/battle** — **통과**. `isAnalysis = !isPet && !isBattle`로 pre-check 제외, `skipSpend` 가드는 pet/battle 한정 그대로. battle의 existingResultId는 checkout:406 `!isBattle`·teaser:251,359 `!isBattle` 가드로 모달 차단. pet intake(`pet-compat/intake/session`)는 existingResultId를 반환하지 않음(grep 확인).
8. **게스트 흐름** — **통과**. 게스트 분기(`sessionId:""` + existingResultId) diff 무변경. 로그인 유저는 세션 insert가 항상 실행돼 sessionId가 항상 존재 — `if (!sid) throw` 에러는 게스트+기존결과 조합에서만 나는 기존 동작 그대로, 전염 없음.
9. **모달 "그 결과 다시 보기" pending 함정** — **통과 (운영자가 가장 의심한 지점, 깨지지 않음)**. `/result?resultId=X`(pending 파라미터 없음) → `fetchResult` → `/api/results/full`이 `full_json IS NULL`이면 **202 + resultId 반환**(full/route.ts:157~158) → ResultClient가 `setAnalysisStatus("pending")`(ResultClient.tsx:145~149) → pending 로딩 화면 + analyze 트리거 + 3초 폴링. 빈 화면·무한로딩 아님. 오히려 실측된 stuck pending 2건(62·65일 방치)도 이 경로로 치유된다. 잔여 위험은 경미-4(이중 분석)와, analyze POST 자체가 네트워크로 유실되면 폴링만 도는 경우(기존 pending 흐름 공통).
10. **`maybeSingle()` 안전성** — **통과**. 유니크 인덱스 마이그레이션 존재 + 프로덕션 2,875행 전수에서 `(user_id, input_hash)` 중복 0건 + 죽은 result_id 0건(FK cascade). PGRST116 다중행 에러 발생 조건 자체가 없다. 단, 에러 시 fail-open 문제는 별개(중대-1).
11. **`charged` 전파** — **의도대로**. analysis 4개 응답 전부 charged 포함(신규 true / retry true / 재사용 false / 23505 false). pet·battle·insufficient·에러 응답엔 없지만 프론트가 charged를 읽는 곳은 analysis 성공 분기뿐이라 undefined → 토스트 없음 = 올바름. 단 토스트 자체가 잘 안 보이는 문제는 별개(경미-1).
12. **check-reuse-spend.mts** — **부분 통과**. 페이지네이션·타 상품 마스킹(RESULT_TABLES) 설계는 옳다. 그러나 "0건=진짜 0건"은 아니다: **(a) 위양성** — `_error` 재시도 정당 과금은 새 row를 안 만들어(기존 row reset, created_at 불변) 플래그되고, 23505 동시요청도 환불됐는데 refund 대조 없이 플래그된다. 즉 배포 후 0이 아니어도 곧장 버그는 아니다. **(b) 위음성** — 차감 ±10분 내에 다른 결과(today/yearly/재구매 등)가 하나라도 생기면 마스킹된다. 개선: 같은 reference_id의 refund 존재 시 제외 + `_error` 이력 표시. 현재 상태로도 "추세 0 수렴" 판정용으론 쓸 만하다.

---

## 정적으로 확신 불가 → 런타임 확인 필요 (브라우저 없이 가능한 방법)

1. **유니크 인덱스 실존** — Supabase SQL 에디터에서 `select indexname from pg_indexes where tablename='result_unlocks';`. (정황 3중 증거로 사실상 확실하지만 이 PR의 안전축이므로 1회 확정 권장)
2. **재사용 무차감 E2E** — 운영자 본인 계정(기존 결과 보유)으로 배포 후 같은 입력 재진입 1회 → `coin_transactions`에서 본인 user_id의 spend 미발생 확인: `npx tsx scripts/diag-user.mts` 또는 coin history 조회. 브라우저 대신 세션 쿠키로 curl 재현도 가능하나 본인 계정 1회가 가장 확실.
3. **배포 후 24~48h**: `npx tsx scripts/check-reuse-spend.mts 2` + Vercel 로그에서 `[SPEND] concurrent unlock, refunding` 빈도 + `type='refund'` 건수 급증 여부. concurrent 로그가 비정상적으로 많으면 23505 경로가 동시요청이 아닌 다른 이유(중대-1 fail-open 등)로 타고 있다는 신호다.
4. **무차감 토스트 실표시 여부**(경미-1) — 코드상 pending 재진입에선 안 보인다고 판정했다. UX로 중요하면 수정 후 배포.

## 이 검토에서 하지 않은 것
- 실제 결제/차감을 일으키는 런타임 테스트 (프로덕션 DB 쓰기 금지 제약)
- PortOne 레거시 `payment/complete` 경로 회귀 (RPC `process_payment_unlock`은 원래 확인-후-처리 구조라 이 PR과 독립 — 코드 무변경 확인만 함)
- 배틀 같은 세션 재POST 40알 이중차감(계획서 0-2 (D)) — 이 PR 범위 밖으로 남아 있음
