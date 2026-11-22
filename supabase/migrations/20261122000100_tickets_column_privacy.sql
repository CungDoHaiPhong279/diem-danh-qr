-- Members (incl. anyone holding a checker invite) must not read email or the ticket token through
-- PostgREST: RLS limits rows, column grants limit fields. Server code that needs them uses service_role.
revoke select on public.tickets from anon, authenticated;
grant select (id, event_id, name, student_id, class_name, faculty, short_code, status, source,
              consent_at, notice_version, checked_in_at, checked_in_by)
  on public.tickets to authenticated;

-- Cancelled tickets can't be checked in; don't offer them in manual lookup.
create or replace function public.search_tickets(p_event uuid, p_query text)
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
      and t.status = 'valid'
      and (extensions.unaccent(lower(t.name)) like '%' || extensions.unaccent(lower(q)) || '%' escape '\'
           or t.student_id like q || '%' escape '\')
    order by t.name
    limit 20;
end $$;
