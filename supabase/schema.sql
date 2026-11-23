-- Family Dhikr Counter schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query),
-- then apply the files in supabase/migrations in name order.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  goal integer not null default 12000 check (goal > 0),
  count integer not null default 0 check (count >= 0),
  dhikr_key text,
  dhikr_label text,
  dhikr_arabic text,
  dhikr_transliteration text,
  dhikr_meaning text,
  created_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists dhikr_key text,
  add column if not exists dhikr_label text,
  add column if not exists dhikr_arabic text,
  add column if not exists dhikr_transliteration text,
  add column if not exists dhikr_meaning text;

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null,
  taps integer not null default 0 check (taps >= 0),
  last_seen timestamptz not null default now(),
  unique (room_id, display_name)
);

create index if not exists room_members_room_id_idx on public.room_members(room_id);

create or replace function public.adjust_room_count(
  p_code text,
  p_delta integer,
  p_display_name text default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  update public.rooms
  set count = greatest(0, count + p_delta)
  where code = upper(trim(p_code))
  returning * into v_room;

  if v_room.id is null then
    raise exception 'Room not found';
  end if;

  if p_display_name is not null and length(trim(p_display_name)) > 0 then
    insert into public.room_members (room_id, display_name, taps, last_seen)
    values (v_room.id, trim(p_display_name), greatest(0, p_delta), now())
    on conflict (room_id, display_name)
    do update set
      taps = greatest(0, public.room_members.taps + p_delta),
      last_seen = now();
  end if;

  return v_room;
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_display_name text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where code = upper(trim(p_code));
  if v_room.id is null then
    raise exception 'Room not found';
  end if;

  insert into public.room_members (room_id, display_name, last_seen)
  values (v_room.id, trim(p_display_name), now())
  on conflict (room_id, display_name)
  do update set last_seen = now();

  return v_room;
end;
$$;

drop function if exists public.create_room(text, integer, text);

create or replace function public.create_room(
  p_name text,
  p_goal integer default 12000,
  p_display_name text default null,
  p_dhikr_key text default null,
  p_dhikr_label text default null,
  p_dhikr_arabic text default null,
  p_dhikr_transliteration text default null,
  p_dhikr_meaning text default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_code text;
  i integer;
begin
  for i in 1..10 loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.rooms (
        code,
        name,
        goal,
        dhikr_key,
        dhikr_label,
        dhikr_arabic,
        dhikr_transliteration,
        dhikr_meaning
      )
      values (
        v_code,
        trim(p_name),
        greatest(1, coalesce(p_goal, 12000)),
        nullif(trim(coalesce(p_dhikr_key, '')), ''),
        nullif(trim(coalesce(p_dhikr_label, '')), ''),
        nullif(trim(coalesce(p_dhikr_arabic, '')), ''),
        nullif(trim(coalesce(p_dhikr_transliteration, '')), ''),
        nullif(trim(coalesce(p_dhikr_meaning, '')), '')
      )
      returning * into v_room;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  if v_room.id is null then
    raise exception 'Could not create room';
  end if;

  if p_display_name is not null and length(trim(p_display_name)) > 0 then
    insert into public.room_members (room_id, display_name, last_seen)
    values (v_room.id, trim(p_display_name), now())
    on conflict (room_id, display_name)
    do update set last_seen = now();
  end if;

  return v_room;
end;
$$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms for select using (true);

drop policy if exists "rooms_insert" on public.rooms;
create policy "rooms_insert" on public.rooms for insert with check (true);

drop policy if exists "rooms_update" on public.rooms;
create policy "rooms_update" on public.rooms for update using (true);

drop policy if exists "members_select" on public.room_members;
create policy "members_select" on public.room_members for select using (true);

drop policy if exists "members_insert" on public.room_members;
create policy "members_insert" on public.room_members for insert with check (true);

drop policy if exists "members_update" on public.room_members;
create policy "members_update" on public.room_members for update using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.rooms to anon, authenticated;
grant select, insert, update on public.room_members to anon, authenticated;
grant execute on function public.adjust_room_count(text, integer, text) to anon, authenticated;
grant execute on function public.join_room(text, text) to anon, authenticated;
grant execute on function public.create_room(text, integer, text, text, text, text, text, text) to anon, authenticated;

-- Live sync for everyone in the room
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
  ) then
    alter publication supabase_realtime add table public.room_members;
  end if;
end $$;
