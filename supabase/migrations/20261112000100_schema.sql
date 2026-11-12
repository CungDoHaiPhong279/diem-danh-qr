-- Schema, RLS and membership triggers.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users,
  club_name text not null,
  title text not null,
  starts_at timestamptz not null,
  location text not null,
  capacity int not null check (capacity between 1 and 5000),
  seats_taken int not null default 0 check (seats_taken >= 0 and seats_taken <= capacity),
  registration_open bool not null default true,
  purge_after timestamptz
);

create table public.event_members (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('organizer', 'checker')),
  primary key (event_id, user_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  name text not null,
  email text not null,
  student_id text,
  class_name text,
  faculty text,
  token text not null unique,
  short_code text not null,
  status text not null default 'valid' check (status in ('valid', 'cancelled')),
  source text not null default 'online' check (source in ('online', 'walk_in')),
  consent_at timestamptz not null,
  notice_version text not null,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users
);
create unique index tickets_event_email_key on public.tickets (event_id, email);
create unique index tickets_event_student_key on public.tickets (event_id, student_id) where student_id <> '';
create unique index tickets_event_short_code_key on public.tickets (event_id, short_code);

create table public.checkin_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  scan_id uuid unique,
  ticket_id uuid references public.tickets on delete set null,
  checker_id uuid references auth.users,
  result text not null,
  method text,
  scanned_at timestamptz not null default now()
);

-- security definer so event_members policies can call it without recursing into RLS.
create function public.is_event_member(p_event uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid() and role = any (p_roles)
  );
$$;
revoke execute on function public.is_event_member(uuid, text[]) from public;
grant execute on function public.is_event_member(uuid, text[]) to anon, authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_new_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.owner_id, 'organizer');
  return new;
end;
$$;
create trigger on_event_created after insert on public.events
  for each row execute function public.handle_new_event();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.tickets enable row level security;
alter table public.checkin_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy events_select on public.events for select to anon, authenticated
  using (registration_open or public.is_event_member(id, '{organizer,checker}'));
create policy events_insert on public.events for insert to authenticated
  with check (owner_id = auth.uid());
create policy events_update on public.events for update to authenticated
  using (public.is_event_member(id, '{organizer}'))
  with check (public.is_event_member(id, '{organizer}'));
create policy events_delete on public.events for delete to authenticated
  using (owner_id = auth.uid());

create policy event_members_select on public.event_members for select to authenticated
  using (user_id = auth.uid() or public.is_event_member(event_id, '{organizer}'));

create policy tickets_select on public.tickets for select to authenticated
  using (public.is_event_member(event_id, '{organizer,checker}'));
create policy checkin_events_select on public.checkin_events for select to authenticated
  using (public.is_event_member(event_id, '{organizer,checker}'));

-- Column-level writes: seats_taken, owner_id and id are server-only.
revoke update on public.events from authenticated;
grant update (club_name, title, starts_at, location, capacity, registration_open, purge_after)
  on public.events to authenticated;
-- No write policies exist for these tables; also drop the default table grants as defense in depth.
-- (anon SELECT is left to RLS: no policy means zero rows.)
revoke insert, update, delete on public.event_members, public.tickets, public.checkin_events from anon, authenticated;
revoke insert, update, delete on public.profiles from anon;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.events from anon;
-- seats_taken starts at 0 and is server-managed: owners may not seed it on insert either.
revoke insert on public.events from authenticated;
grant insert (owner_id, club_name, title, starts_at, location, capacity, registration_open, purge_after)
  on public.events to authenticated;
