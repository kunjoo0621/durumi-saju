-- 결제 의도 사전 저장 테이블 (Stripe payment_intents 패턴)
--
-- 배경: 2026-05-26 우슬기 결제 누락 사고 — 카카오톡 인앱에서 결제 후 redirect 복귀 실패.
-- PortOne은 PAID인데 우리 DB에 결제 기록·코인 충전 0건. 4/1~5/26 사이 같은 패턴 3건 확인.
--
-- 기존 흐름의 한계:
--   클라이언트(useCharge)가 randomUUID로 orderId 생성 → PortOne 결제 → redirect로 /coins 복귀 → /api/coins/charge 호출.
--   redirect 복귀가 깨지면 서버는 "이 결제가 있었다"는 사실 자체를 모름. session 의존이라 webhook으로도 매칭 불가.
--
-- 해결 구조:
--   결제 시작 전에 서버가 order_id 발급 + (user_id, package_id, amount, status=pending)을 이 테이블에 저장.
--   결제 완료 후 어느 경로(redirect/webhook/reconcile)로 신호가 와도 order_id 하나로 누구·얼마 충전할지 결정.
--
-- 이 PR(1차)의 범위:
--   테이블만 추가. 기존 결제 흐름 코드는 그대로. 어떤 코드도 아직 이 테이블에 INSERT/SELECT 하지 않음.
--   후속 PR에서 intent endpoint / charge route / webhook이 이 테이블을 사용.

create table if not exists public.charge_orders (
  -- order_id = PortOne paymentId. 서버가 발급 (클라이언트 randomUUID 폐기).
  order_id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  package_id text not null,
  amount integer not null check (amount > 0),

  -- 상태 머신:
  --   pending  : intent 생성됨, PortOne 결제 대기
  --   paid     : PortOne PAID 확인됨, 코인 충전 대기
  --   charged  : profiles.coin_balance 까지 충전 완료
  --   failed   : 결제 실패 또는 검증 실패 (사용자 취소 등)
  --   refunded : PortOne 환불 처리 (별도 webhook으로 진입, 본 PR 범위 밖)
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'charged', 'failed', 'refunded')),

  -- 실제 결제 검증 시점에 PortOne paymentId 저장 (보통 order_id 와 동일).
  payment_id text,
  paid_at timestamptz,
  charged_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 운영 감시용:
-- 1) "오래된 pending" — 결제 시작했는데 N분 이상 paid 안 됨 → 사용자 이탈 또는 redirect 끊김 의심
-- 2) "paid but not charged" — PortOne PAID 인데 코인 충전 미완료 → 충전 RPC 실패 또는 charge endpoint 미호출
create index if not exists charge_orders_status_created_idx
  on public.charge_orders (status, created_at desc);

create index if not exists charge_orders_user_idx
  on public.charge_orders (user_id, created_at desc);

-- updated_at 자동 갱신 trigger
create or replace function public.charge_orders_set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists charge_orders_updated_at on public.charge_orders;
create trigger charge_orders_updated_at
  before update on public.charge_orders
  for each row execute function public.charge_orders_set_updated_at();

-- RLS: service_role 만 접근 허용 (Supabase는 service_role 키 사용 시 RLS 자동 bypass).
-- 정책 미생성 = anon/authenticated 키로는 select/insert/update/delete 전부 거부.
-- 결제·돈 정보 테이블이므로 클라이언트 직접 접근 절대 차단.
alter table public.charge_orders enable row level security;
