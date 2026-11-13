create function public.register(p_event uuid, p_name text, p_email text, p_student_id text,
  p_class text, p_faculty text, p_notice_version text)
returns tickets language plpgsql security definer set search_path = public as $$
declare t tickets; e events;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not e.registration_open then raise exception 'EVENT_CLOSED'; end if;
  -- kiểm tra trùng trước bộ đếm: người đã đăng ký không bao giờ nhận "hết chỗ"
  if exists (select 1 from tickets where event_id = p_event
             and (email = lower(p_email) or (p_student_id <> '' and student_id = p_student_id))) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  update events set seats_taken = seats_taken + 1
    where id = p_event and seats_taken < capacity and registration_open;
  if not found then raise exception 'EVENT_FULL'; end if;
  insert into tickets(event_id, name, email, student_id, class_name, faculty, token, short_code,
                      consent_at, notice_version)
    values (p_event, p_name, lower(p_email), p_student_id, p_class, p_faculty,
            encode(extensions.gen_random_bytes(16), 'hex'),
            upper(encode(extensions.gen_random_bytes(4), 'hex')),
            now(), p_notice_version)
    returning * into t;  -- 23505 do đăng ký đồng thời: cả transaction hoàn tác, gồm bộ đếm
  return t;
end $$;
revoke execute on function public.register from public, anon, authenticated;
grant execute on function public.register to service_role;
