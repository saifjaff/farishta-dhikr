-- Sync v2, part 1 (additive): device-linked members, idempotent tap batches,
-- versioned room counts and throttled Broadcast. Old functions keep working.

alter table public.rooms add column if not exists version bigint not null default 0;
alter table public.rooms add column if not exists last_broadcast_at timestamptz;

create table if not exists public.member_devices (
  room_id uuid not null references public.rooms(id) on delete cascade,
  device_id uuid not null,
  member_id uuid not null references public.room_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, device_id)
);
create index if not exists member_devices_member_idx on public.member_devices(member_id);

create table if not exists public.tap_batches (
  batch_id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  member_id uuid references public.room_members(id) on delete set null,
  delta integer not null,
  created_at timestamptz not null default now()
);
create index if not exists tap_batches_created_idx on public.tap_batches(created_at);

alter table public.member_devices enable row level security;
alter table public.tap_batches enable row level security;
revoke all on public.member_devices from public, anon, authenticated;
revoke all on public.tap_batches from public, anon, authenticated;

-- Sends the room total to everyone listening, at most every 250ms per room.
-- Must never block a tap, so failures are swallowed.
create or replace function public.bump_room(p_room_id uuid, p_delta integer)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_now timestamptz := clock_timestamp();
begin
  update public.rooms
  set
    count = greatest(0, count + p_delta),
    version = version + 1,
    last_broadcast_at = case
      when last_broadcast_at is null
        or v_now - last_broadcast_at >= interval '250 milliseconds'
      then v_now
      else last_broadcast_at
    end
  where id = p_room_id
  returning * into v_room;

  if v_room.last_broadcast_at = v_now then
    begin
      perform realtime.send(
        jsonb_build_object('count', v_room.count, 'version', v_room.version),
        'count',
        'room-live:' || v_room.id::text,
        false
      );
    exception when others then
      null;
    end;
  end if;

  return v_room;
end;
$$;
revoke execute on function public.bump_room(uuid, integer) from public, anon, authenticated;

-- Old clients: same behaviour, but now also versioned and broadcast.
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
  v_room_id uuid;
  v_room public.rooms;
begin
  select id into v_room_id from public.rooms where code = upper(trim(p_code));
  if v_room_id is null then
    raise exception 'Room not found';
  end if;

  v_room := public.bump_room(v_room_id, p_delta);

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

create or replace function public.get_room(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where code = upper(trim(p_code));
  if v_room.id is null then
    raise exception 'room_not_found';
  end if;
  return to_jsonb(v_room) - 'last_broadcast_at';
end;
$$;

create or replace function public.get_room_members(p_code text)
returns table (id uuid, display_name text, taps integer)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.display_name, m.taps
  from public.room_members m
  join public.rooms r on r.id = m.room_id
  where r.code = upper(trim(p_code))
  order by m.taps desc, m.display_name
  limit 500;
$$;

-- Links this device to a named member of the room.
-- Errors: room_not_found, name_required, name_taken (another device uses that name).
create or replace function public.enter_room(
  p_code text,
  p_device_id uuid,
  p_display_name text default null,
  p_claim boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
  v_name text := left(nullif(trim(coalesce(p_display_name, '')), ''), 40);
begin
  if p_device_id is null then
    raise exception 'device_required';
  end if;

  select * into v_room from public.rooms where code = upper(trim(p_code));
  if v_room.id is null then
    raise exception 'room_not_found';
  end if;

  select m.* into v_member
  from public.member_devices d
  join public.room_members m on m.id = d.member_id
  where d.room_id = v_room.id and d.device_id = p_device_id;

  if v_member.id is not null then
    if v_name is not null and v_name <> v_member.display_name then
      if exists (
        select 1 from public.room_members
        where room_id = v_room.id
          and lower(display_name) = lower(v_name)
          and id <> v_member.id
      ) then
        raise exception 'name_taken';
      end if;
      update public.room_members
      set display_name = v_name, last_seen = now()
      where id = v_member.id
      returning * into v_member;
    else
      update public.room_members set last_seen = now()
      where id = v_member.id
      returning * into v_member;
    end if;
  else
    if v_name is null then
      raise exception 'name_required';
    end if;

    select * into v_member
    from public.room_members
    where room_id = v_room.id and lower(display_name) = lower(v_name)
    order by taps desc
    limit 1;

    if v_member.id is not null then
      -- Members from before devices existed are claimed automatically.
      if exists (select 1 from public.member_devices where member_id = v_member.id)
        and not coalesce(p_claim, false) then
        raise exception 'name_taken';
      end if;
      update public.room_members set last_seen = now()
      where id = v_member.id
      returning * into v_member;
    else
      insert into public.room_members (room_id, display_name, last_seen)
      values (v_room.id, v_name, now())
      returning * into v_member;
    end if;

    insert into public.member_devices (room_id, device_id, member_id)
    values (v_room.id, p_device_id, v_member.id)
    on conflict (room_id, device_id) do update set member_id = excluded.member_id;
  end if;

  return jsonb_build_object(
    'room', to_jsonb(v_room) - 'last_broadcast_at',
    'member', jsonb_build_object(
      'id', v_member.id,
      'display_name', v_member.display_name,
      'taps', v_member.taps
    )
  );
end;
$$;

-- Applies a batch of taps exactly once (retries with the same batch id are ignored).
create or replace function public.count_taps(
  p_code text,
  p_device_id uuid,
  p_batch_id uuid,
  p_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_member_id uuid;
  v_room public.rooms;
  v_taps integer;
  v_applied boolean;
begin
  if p_batch_id is null or p_delta is null or p_delta = 0 or abs(p_delta) > 1000 then
    raise exception 'invalid_batch';
  end if;

  select r.id, d.member_id into v_room_id, v_member_id
  from public.rooms r
  left join public.member_devices d
    on d.room_id = r.id and d.device_id = p_device_id
  where r.code = upper(trim(p_code));

  if v_room_id is null then
    raise exception 'room_not_found';
  end if;
  if v_member_id is null then
    raise exception 'not_joined';
  end if;

  insert into public.tap_batches (batch_id, room_id, member_id, delta)
  values (p_batch_id, v_room_id, v_member_id, p_delta)
  on conflict (batch_id) do nothing;
  v_applied := found;

  if v_applied then
    v_room := public.bump_room(v_room_id, p_delta);
    update public.room_members
    set taps = greatest(0, taps + p_delta), last_seen = now()
    where id = v_member_id
    returning taps into v_taps;
  else
    select * into v_room from public.rooms where id = v_room_id;
    select taps into v_taps from public.room_members where id = v_member_id;
  end if;

  if random() < 0.002 then
    delete from public.tap_batches where created_at < now() - interval '3 days';
  end if;

  return jsonb_build_object(
    'count', v_room.count,
    'version', v_room.version,
    'taps', v_taps,
    'duplicate', not v_applied
  );
end;
$$;

-- New rooms get 8-character codes without look-alike characters (no I, O, 0, 1).
create or replace function public.create_room_v2(
  p_name text,
  p_goal integer,
  p_display_name text,
  p_device_id uuid,
  p_dhikr_key text default null,
  p_dhikr_label text default null,
  p_dhikr_arabic text default null,
  p_dhikr_transliteration text default null,
  p_dhikr_meaning text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_byte_positions constant int[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  v_room public.rooms;
  v_code text;
  v_bytes bytea;
  v_name text := left(nullif(trim(coalesce(p_display_name, '')), ''), 40);
  i integer;
  j integer;
begin
  if v_name is null then
    raise exception 'name_required';
  end if;
  if p_device_id is null then
    raise exception 'device_required';
  end if;

  for i in 1..10 loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach j in array v_byte_positions loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, j) % 32), 1);
    end loop;
    begin
      insert into public.rooms (
        code, name, goal,
        dhikr_key, dhikr_label, dhikr_arabic, dhikr_transliteration, dhikr_meaning
      )
      values (
        v_code,
        coalesce(nullif(trim(p_name), ''), 'Family Dhikr'),
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

  return public.enter_room(v_room.code, p_device_id, v_name, false);
end;
$$;

revoke execute on function public.get_room(text) from public;
revoke execute on function public.get_room_members(text) from public;
revoke execute on function public.enter_room(text, uuid, text, boolean) from public;
revoke execute on function public.count_taps(text, uuid, uuid, integer) from public;
revoke execute on function public.create_room_v2(text, integer, text, uuid, text, text, text, text, text) from public;

grant execute on function public.get_room(text) to anon, authenticated;
grant execute on function public.get_room_members(text) to anon, authenticated;
grant execute on function public.enter_room(text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.count_taps(text, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.create_room_v2(text, integer, text, uuid, text, text, text, text, text) to anon, authenticated;
