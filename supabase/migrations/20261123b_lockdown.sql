-- Sync v2, part 2 (run after the new app is live): close direct table access
-- so rooms and members can only be reached by exact room code through functions.

drop policy if exists "rooms_select" on public.rooms;
drop policy if exists "rooms_insert" on public.rooms;
drop policy if exists "rooms_update" on public.rooms;
drop policy if exists "members_select" on public.room_members;
drop policy if exists "members_insert" on public.room_members;
drop policy if exists "members_update" on public.room_members;

revoke all on public.rooms from public, anon, authenticated;
revoke all on public.room_members from public, anon, authenticated;

revoke execute on function public.adjust_room_count(text, integer, text) from public, anon, authenticated;
revoke execute on function public.join_room(text, text) from public, anon, authenticated;
revoke execute on function public.create_room(text, integer, text, text, text, text, text, text) from public, anon, authenticated;

-- Live updates now go over Broadcast; per-row change events are no longer needed.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime drop table public.rooms;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
  ) then
    alter publication supabase_realtime drop table public.room_members;
  end if;
end $$;
