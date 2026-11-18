create extension if not exists unaccent with schema extensions;

-- Composite FK: a log row can only point at a ticket of its own event.
alter table public.tickets add constraint tickets_id_event_key unique (id, event_id);
alter table public.checkin_events drop constraint checkin_events_ticket_id_fkey;
alter table public.checkin_events add constraint checkin_events_ticket_event_fkey
  foreign key (ticket_id, event_id) references public.tickets (id, event_id) on delete set null (ticket_id);

-- Name order: profile, Google metadata, email local part. Internal only.
create function public.user_display_name(p_user uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    nullif(p.display_name, ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(u.email, '@', 1), '')
  )
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = p_user;
$$;
revoke execute on function public.user_display_name(uuid) from public, anon, authenticated;

-- Internal: one payload shape for fresh calls and replays (keys always present).
create function public.checkin_payload(p_result text, p_ticket uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'result', p_result,
    'ticket_id', case when p_result in ('ok', 'already') then t.id end,
    'name', t.name,
    'student_id', t.student_id,
    'class_name', case when p_result in ('ok', 'already') then t.class_name end,
    'checked_in_at', case when p_result in ('ok', 'already') then t.checked_in_at end,
    'checked_in_by_name', case when p_result in ('ok', 'already') then public.user_display_name(t.checked_in_by) end
  )
  from (select 1) s left join public.tickets t on t.id = p_ticket and p_result in ('ok', 'already', 'cancelled');
$$;
revoke execute on function public.checkin_payload(text, uuid) from public, anon, authenticated;

create function public.checkin(p_event uuid, p_scan_id uuid, p_token text default null,
  p_ticket uuid default null, p_scanned_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  ts timestamptz;
  v_id uuid;
  v_event uuid;
  v_status text;
  v_result text;
  v_log checkin_events;
begin
  if not public.is_event_member(p_event, '{organizer,checker}') then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  if (p_token is null) = (p_ticket is null) then raise exception 'BAD_REQUEST'; end if;

  select * into v_log from checkin_events where scan_id = p_scan_id;
  if found then return public.checkin_payload(v_log.result, v_log.ticket_id); end if;

  ts := least(now(), greatest(coalesce(p_scanned_at, now()), now() - interval '1 day'));

  update tickets set checked_in_at = ts, checked_in_by = auth.uid()
  where event_id = p_event and (token = p_token or id = p_ticket)
    and checked_in_at is null and status = 'valid'
  returning id into v_id;

  if found then
    v_result := 'ok';
  else
    select id, event_id, status into v_id, v_event, v_status
    from tickets where token = p_token or id = p_ticket;
    if not found then v_result := 'not_found';
    elsif v_event <> p_event then v_result := 'wrong_event'; v_id := null;
    elsif v_status = 'cancelled' then v_result := 'cancelled';
    else v_result := 'already';
    end if;
    if v_result in ('not_found', 'wrong_event') then v_id := null; end if;
  end if;

  insert into checkin_events (event_id, scan_id, ticket_id, checker_id, result, method, scanned_at)
  values (p_event, p_scan_id, v_id, auth.uid(), v_result,
          case when p_token is not null then 'qr' else 'manual' end, ts)
  on conflict (scan_id) do nothing;
  if not found then
    -- a parallel retry of the same scan_id inserted first: return its stored result
    select * into v_log from checkin_events where scan_id = p_scan_id;
    return public.checkin_payload(v_log.result, v_log.ticket_id);
  end if;

  return public.checkin_payload(v_result, v_id);
end $$;
revoke execute on function public.checkin(uuid, uuid, text, uuid, timestamptz) from public, anon;
grant execute on function public.checkin(uuid, uuid, text, uuid, timestamptz) to authenticated;

create function public.search_tickets(p_event uuid, p_query text)
returns table (id uuid, name text, student_id text, class_name text, faculty text, checked_in_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare q text := trim(coalesce(p_query, ''));
begin
  if not public.is_event_member(p_event, '{organizer,checker}') then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  if length(q) < 2 then return; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select t.id, t.name, t.student_id, t.class_name, t.faculty, t.checked_in_at
    from tickets t
    where t.event_id = p_event
      and (extensions.unaccent(lower(t.name)) like '%' || extensions.unaccent(lower(q)) || '%' escape '\'
           or t.student_id like q || '%' escape '\')
    order by t.name
    limit 20;
end $$;
revoke execute on function public.search_tickets(uuid, text) from public, anon;
grant execute on function public.search_tickets(uuid, text) to authenticated;
