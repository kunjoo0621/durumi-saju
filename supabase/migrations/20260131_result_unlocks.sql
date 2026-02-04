create table if not exists public.result_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result_id uuid not null references public.saju_results(id) on delete cascade,
  input_hash text not null,
  order_id text not null,
  created_at timestamptz default now()
);

create unique index if not exists result_unlocks_user_input_unique
  on public.result_unlocks (user_id, input_hash);

create unique index if not exists result_unlocks_order_unique
  on public.result_unlocks (order_id);

create index if not exists result_unlocks_result_idx
  on public.result_unlocks (result_id);

alter table public.saju_results add column if not exists core_fear_axis text;
alter table public.saju_results add column if not exists saju_text text;

create or replace function public.process_payment_unlock(
  p_user_id uuid,
  p_order_id text,
  p_method text,
  p_amount integer,
  p_input_hash text,
  p_name text,
  p_birth_date date,
  p_birth_time text,
  p_region text,
  p_gender text,
  p_relationship_status text,
  p_employment_status text,
  p_calendar_type text,
  p_core_fear_axis text,
  p_saju_text text,
  p_teaser jsonb,
  p_full jsonb
)
returns table(result_id uuid, reused boolean)
language plpgsql
security definer
as $$
declare
  v_result_id uuid;
  v_existing_status text;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_input_hash));

  select status into v_existing_status
  from public.payment_transactions
  where order_id = p_order_id;

  if v_existing_status is not null then
    return query select null::uuid, true;
    return;
  end if;

  select r.id into v_result_id
  from public.result_unlocks u
  join public.saju_results r on r.id = u.result_id
  where u.user_id = p_user_id and u.input_hash = p_input_hash
  limit 1;

  if v_result_id is not null then
    insert into public.payment_transactions(order_id, user_id, method, amount, status)
    values(p_order_id, p_user_id, p_method, p_amount, 'duplicate')
    on conflict (order_id) do nothing;

    return query select v_result_id, true;
    return;
  end if;

  insert into public.saju_results (
    user_id,
    input_hash,
    name,
    birth_date,
    birth_time,
    region,
    gender,
    relationship_status,
    employment_status,
    calendar_type,
    core_fear_axis,
    saju_text,
    teaser_json,
    full_json,
    unlocked_at
  ) values (
    p_user_id,
    p_input_hash,
    p_name,
    p_birth_date,
    p_birth_time,
    p_region,
    p_gender,
    p_relationship_status,
    p_employment_status,
    p_calendar_type,
    p_core_fear_axis,
    p_saju_text,
    p_teaser,
    p_full,
    now()
  )
  on conflict (user_id, input_hash)
  do update set
    teaser_json = excluded.teaser_json,
    full_json = excluded.full_json,
    core_fear_axis = excluded.core_fear_axis,
    saju_text = excluded.saju_text,
    unlocked_at = now()
  returning id into v_result_id;

  insert into public.payment_transactions(order_id, user_id, method, amount, status)
  values(p_order_id, p_user_id, p_method, p_amount, 'success')
  on conflict (order_id) do nothing;

  insert into public.result_unlocks(user_id, result_id, input_hash, order_id)
  values(p_user_id, v_result_id, p_input_hash, p_order_id)
  on conflict (user_id, input_hash) do nothing;

  return query select v_result_id, false;
end;
$$;
