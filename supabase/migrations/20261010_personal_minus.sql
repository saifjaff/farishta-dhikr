-- Minus now lowers the presser's personal taps too (never below 0).
-- Only replaces the function; existing rooms, counts and members are untouched.
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

grant execute on function public.adjust_room_count(text, integer, text) to anon, authenticated;
