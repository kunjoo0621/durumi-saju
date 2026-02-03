# 진행상태 및 보안 규칙

## 최종 플로우
입력(/start) → 티저(/teaser) → 결제(/payment) → 결과(/result)

- 로그인 없이도 입력/티저/결제/결과까지 한 번은 진행 가능
- 재조회(나중에 다시보기)는 로그인 필수

## 보안 규칙
- 티저 결과만 공개: `/api/analyze`는 teaser_json만 반환
- 전체 결과(full_json)는 결제 성공 처리에서만 생성/저장
- 전체 결과 접근 권한은 단기 쿠키(SAJU_ACCESS)로만 판단
- URL/쿼리스트링에 토큰을 절대 넣지 않음

## 재조회 정책
- `/result`는 로그인 사용자가 결제 직후에만 접근
- 재조회는 `/my/results`에서만 가능 (로그인 필수)

## 환경변수
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
