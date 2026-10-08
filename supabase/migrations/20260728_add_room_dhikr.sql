-- Add selected dhikr fields to rooms
alter table public.rooms
  add column if not exists dhikr_key text,
  add column if not exists dhikr_label text,
  add column if not exists dhikr_arabic text,
  add column if not exists dhikr_transliteration text,
  add column if not exists dhikr_meaning text;

-- Replace create_room with dhikr-aware version
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

grant execute on function public.create_room(text, integer, text, text, text, text, text, text) to anon, authenticated;
