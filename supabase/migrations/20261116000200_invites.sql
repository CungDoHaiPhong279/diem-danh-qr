create table public.event_invites (
  token text primary key check (token ~ '^[0-9a-f]{32}$'),
  event_id uuid not null references public.events on delete cascade,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);
create index event_invites_event_idx on public.event_invites (event_id);

alter table public.event_invites enable row level security;
create policy event_invites_select on public.event_invites for select to authenticated
  using (public.is_event_member(event_id, '{organizer}'));
revoke insert, update, delete on public.event_invites from anon, authenticated;

-- Errors: NOT_MEMBER uses errcode 42501; INVITE_INVALID uses the default errcode P0001.
create function public.create_checker_invite(p_event uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_token text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if not public.is_event_member(p_event, '{organizer}') then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  -- serialize per event so concurrent calls cannot leave two active links
  perform 1 from public.events where id = p_event for no key update;
  update public.event_invites set revoked_at = now()
  where event_id = p_event and revoked_at is null and expires_at > now();
  insert into public.event_invites (token, event_id, created_by) values (v_token, p_event, auth.uid());
  return v_token;
end $$;

create function public.revoke_checker_invites(p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_event_member(p_event, '{organizer}') then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  update public.event_invites set revoked_at = now()
  where event_id = p_event and revoked_at is null and expires_at > now();
end $$;

create function public.accept_checker_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_event uuid;
begin
  if auth.uid() is null then raise exception 'NOT_MEMBER' using errcode = '42501'; end if;
  select event_id into v_event from public.event_invites
  where token = p_token and revoked_at is null and expires_at > now();
  if not found then raise exception 'INVITE_INVALID'; end if;
  -- do nothing on conflict: an existing organizer is never downgraded
  insert into public.event_members (event_id, user_id, role) values (v_event, auth.uid(), 'checker')
  on conflict (event_id, user_id) do nothing;
  return v_event;
end $$;

create function public.remove_checker(p_event uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_event_member(p_event, '{organizer}') then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  delete from public.event_members where event_id = p_event and user_id = p_user and role = 'checker';
  -- the removed checker must not rejoin with the old link
  update public.event_invites set revoked_at = now() where event_id = p_event and revoked_at is null;
end $$;

create function public.member_names(p_event uuid)
returns table (user_id uuid, role text, name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_event_member(p_event, '{organizer,checker}') then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role, public.user_display_name(m.user_id)
    from public.event_members m where m.event_id = p_event
    order by m.role, 3;
end $$;

-- Invalid, revoked, expired or malformed tokens simply return no rows.
create function public.invite_preview(p_token text)
returns table (club_name text, title text)
language sql stable security definer set search_path = public
as $$
  select e.club_name, e.title
  from public.event_invites i join public.events e on e.id = i.event_id
  where i.token = p_token and i.revoked_at is null and i.expires_at > now();
$$;

revoke execute on function public.create_checker_invite(uuid), public.revoke_checker_invites(uuid),
  public.accept_checker_invite(text), public.remove_checker(uuid, uuid),
  public.member_names(uuid), public.invite_preview(text) from public, anon;
grant execute on function public.create_checker_invite(uuid), public.revoke_checker_invites(uuid),
  public.accept_checker_invite(text), public.remove_checker(uuid, uuid),
  public.member_names(uuid), public.invite_preview(text) to authenticated;
