# 삭제 감사 로그 + 결제-무결과 판별 도구

작성일: 2026-07-22
상태: 승인됨 (운영자 approval, 브레인스토밍 A안)

## 배경 / 문제

유료 결과가 사라졌을 때 그게 **본인 삭제**인지 **시스템 손실**인지 구분이 안 된다.
삭제는 `DELETE /api/results/[id]`가 하드 삭제(+ `result_unlocks` cascade)로 처리하고
**흔적을 안 남긴다.** 그래서 "결제했는데 결과 없음" 케이스(예: 주현=삭제, 서동민=불명)를
매번 코드 소거법으로 몇십 분씩 파야 판별된다.

환불 여부는 **이미 판별 가능**하다 — 실패 시 `coin_transactions`에 `type='refund'`가 남는다.
따라서 새로 필요한 데이터는 **"누가 언제 무엇을 지웠는가"** 하나뿐이다.

## 목표

- 사주 결과 삭제 시 감사 로그를 남겨, 이후 "결제-무결과" 케이스를 **[본인삭제 / 실패환불 /
  미완 / 진짜손실]** 로 자동 분류한다.
- 대시보드/기존 화면·목록·삭제 동작에 **영향 0** (뒤에 기록만 추가).
- 판별은 **그때그때 돌리는 스크립트**로 (A안). 대시보드 상시표시는 범위 밖.

## 비목표 (YAGNI)

- 소프트 삭제(saju_results에 deleted_at 후 전 쿼리 필터)로 안 간다 — 블라스트 반경 큼.
- 배틀 결과 삭제 로깅은 이번 범위 밖(돈-무결과 이슈는 사주에 집중). 필요 시 후속.
- 환불 추적 신규 개발 없음 — 이미 `coin_transactions.refund`에 있음.
- 대시보드 UI 통합 없음.

## 설계

### 1) 감사 표 `result_deletions` (append-only)

```
id           uuid pk default gen_random_uuid()
user_id      uuid            -- FK 없음(감사는 유저 삭제돼도 살아남아야 함)
result_id    uuid not null   -- FK 없음(삭제된 saju_results.id, 원본은 사라짐)
input_hash   text
name         text
birth_date   text
was_delivered boolean        -- 삭제 시점에 정상 full_json(전달완료)였는지 여부
deleted_at   timestamptz not null default now()
```
- RLS enable, 클라이언트 정책 없음(서버 service-role 전용).
- 인덱스: user_id, deleted_at.
- **FK/cascade를 일부러 안 건다** — 감사 로그는 원본·유저가 사라져도 보존돼야 함.

### 2) `DELETE /api/results/[id]` 로깅 추가

- 기존 동작(소유권 확인 → 하드 삭제 → 대표 승계)은 **그대로**.
- 삭제 **직전** saju_results에서 `input_hash, name, birth_date, full_json` 조회.
- `was_delivered = full_json != null && !full_json._error`.
- 하드 삭제 **성공 후** `result_deletions`에 한 줄 insert.
- **감사 insert 실패는 삭제를 막지 않는다** — try/catch, 실패 시 `console.error`만.

### 3) 판별 스크립트 `scripts/triage-paid-no-result.mts`

- 입력: 날짜범위(기본 최근 N일) 또는 특정 user_id(옵션 인자).
- 유저별 회계: `spend` 건수 vs {현재 정상결과, 환불, pending행, 삭제로그} 합.
- 분류(유저 단위, 결제했는데 현재 정상결과 부족한 유저만 출력):
  - 🟢 **본인삭제**: `result_deletions`에 해당 유저 기록 존재
  - 🟡 **실패환불**: `coin_transactions.refund` 존재
  - 🔵 **미완/pending**: full_json이 null인 결과행 존재
  - 🔴 **진짜손실**: 위 어디에도 안 잡히는 미설명 spend (= 보상 후보)
- `result_deletions` 표가 아직 없으면(마이그레이션 적용 전) **삭제=불명**으로 표기하고 계속 실행.
- raw 우선 출력, 과해석 없음.

## 한계 (명시)

- 감사 로그는 **적용 시점부터 forward-only.** 서동민 등 **과거 건은 소급 판별 불가** —
  "삭제 기록 없음"이 "손실"이 아니라 "로그 이전"일 수 있음. 스크립트는 로그 도입일 이전
  삭제를 손실로 오판하지 않도록, 도입일 이전 spend는 별도 표기.

## 배포 / 롤아웃

- 마이그레이션(`20260722_result_deletions.sql`) + 라우트 변경 → 배포 필요(운영자 승인).
- 스크립트 → 배포 불필요.
- main에서 브랜치(`feat/deletion-audit-triage`) → PR. 표는 additive라 저위험(기존 무영향).

## 검증

- 라우트 파싱/타입 OK.
- 스크립트를 현재 DB에 실행 → 주현(삭제로그 없으면 forward-only 표기), 서동민(과거·불명),
  정상 결제자 분류가 기대대로 나오는지 확인.
- 표 생성 후(승인 시) 실삭제 1건으로 로그 적재 → 스크립트가 🟢본인삭제로 잡는지 확인.
