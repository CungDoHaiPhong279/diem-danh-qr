-- Privacy notice promises deletion 30 days after the event; events only have starts_at, so count from it.
create function public.set_purge_after() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.purge_after is null then
    new.purge_after := new.starts_at + interval '30 days';
  elsif tg_op = 'UPDATE' then
    if new.starts_at is distinct from old.starts_at and new.purge_after is not distinct from old.purge_after then
      new.purge_after := new.starts_at + interval '30 days';
    end if;
  end if;
  return new;
end $$;

create trigger events_set_purge_after before insert or update on public.events
for each row execute function public.set_purge_after();

update public.events set purge_after = starts_at + interval '30 days' where purge_after is null;
