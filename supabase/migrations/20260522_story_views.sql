-- ============================================================
-- 2026-05-22: 사주 이야기 조회수 카운터
-- ============================================================
-- /stories/[slug] 페이지가 SSG라 서버 카운트 불가.
-- 클라이언트에서 POST /api/stories/:slug/view 호출 시
-- 본 테이블의 카운터를 RPC로 원자 증분.
--
-- - story_views(slug, view_count, updated_at)
-- - increment_story_view(p_slug) RPC → 증분 후 새 카운트 반환
-- ============================================================

create table if not exists story_views (
  slug text primary key,
  view_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function increment_story_view(p_slug text)
returns bigint
language plpgsql
security definer
as $$
declare
  v_count bigint;
begin
  insert into story_views (slug, view_count, updated_at)
  values (p_slug, 1, now())
  on conflict (slug) do update
    set view_count = story_views.view_count + 1,
        updated_at = now()
  returning view_count into v_count;
  return v_count;
end;
$$;

revoke all on function increment_story_view(text) from public;
grant execute on function increment_story_view(text) to service_role;
