-- today_results 분석 동시 실행 차단 (배포 차단 이슈)
-- 문제: full_json 만 보고 pending이면 analyze를 트리거 → 새로고침/2탭에서 같은 row 동시 분석 → 중복 환불·결과 덮어쓰기·LLM 비용 중복
-- 해결: analysis_started_at TIMESTAMPTZ 컬럼 + atomic UPDATE WHERE 조건으로 락 획득
-- 락 만료 (3분) — LLM 호출이 90초 정도 걸리므로 보수적으로 3분
-- 같은 패턴 yearly_results에도 동일 적용

alter table public.today_results
  add column if not exists analysis_started_at timestamptz;

-- 만료된 락 빨리 찾기 (analyze route에서 매번 lookup)
create index if not exists today_results_analysis_started_idx
  on public.today_results (analysis_started_at);

comment on column public.today_results.analysis_started_at is
  '분석 시작 시각. NULL 이거나 3분 이상 지나면 락 획득 가능. atomic UPDATE WHERE 조건으로 동시 분석 차단.';
