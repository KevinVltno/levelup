begin;
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 endpoint text not null unique check (octet_length(endpoint) between 20 and 2048),
 p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
 auth_key text not null check (auth_key ~ '^[A-Za-z0-9_-]{22}$'),
 updated_at timestamptz not null default now()
);
create index push_subscriptions_owner on public.push_subscriptions(user_id);
create table public.push_reminders (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.push_subscriptions on delete cascade,
 habit_id uuid not null references public.habits on delete cascade,
 reminder_day date not null,
 scheduled_at timestamptz not null,
 attempts integer not null default 0,
 retry_at timestamptz not null default now(),
 finished boolean not null default false,
 unique(subscription_id,habit_id,reminder_day)
);
create index push_reminders_due on public.push_reminders(retry_at) where not finished;
alter table public.push_subscriptions enable row level security;
alter table public.push_reminders enable row level security;
revoke all on public.push_subscriptions,public.push_reminders from public,anon,authenticated;

create function public.register_push(p_endpoint text,p_p256dh text,p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Sesi berakhir'; end if;
 perform 1 from public.profiles where id=u for update;
 if (select count(*) from public.push_subscriptions where user_id=u)>=10
   and not exists(select 1 from public.push_subscriptions where user_id=u and endpoint=p_endpoint)
 then raise exception 'Batas perangkat tercapai'; end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_key)
 values(u,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,updated_at=now()
 where push_subscriptions.user_id=u;
 if not found then raise exception 'Langganan perangkat dimiliki akun lain'; end if;
end $$;

create function public.remove_push(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
 delete from public.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint
$$;

create function public.get_push_state(p_endpoint text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint)
$$;

create function public.set_habit_reminder(p_id uuid,p_reminder time) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.habits set reminder_at=p_reminder where id=p_id and user_id=auth.uid() and archived_at is null;
 if not found then raise exception 'Habit tidak tersedia'; end if;
end $$;

create function public.claim_push_reminders()
returns table(id uuid, endpoint text, p256dh text, auth_key text, habit_name text, habit_id uuid, reminder_day date)
language plpgsql security definer set search_path = '' as $$
declare t timestamptz := clock_timestamp(); d date := public.local_day(t);
begin
 delete from public.push_reminders where scheduled_at < t-interval '7 days';
 insert into public.push_reminders(subscription_id,habit_id,reminder_day,scheduled_at)
 select s.id,h.id,d,(d+h.reminder_at) at time zone 'Asia/Jakarta'
 from public.habits h join public.push_subscriptions s on h.user_id=s.user_id
 where h.archived_at is null and h.reminder_at is not null
 and extract(isodow from d)::int=any(h.weekdays)
 and (d+h.reminder_at) at time zone 'Asia/Jakarta' between t-interval '10 minutes' and t
 and not exists(select 1 from public.habit_logs l where l.habit_id=h.id and l.log_date=d)
 on conflict on constraint push_reminders_subscription_id_habit_id_reminder_day_key
 do update set scheduled_at=excluded.scheduled_at,attempts=0,retry_at=now()
 where not push_reminders.finished and push_reminders.scheduled_at<>excluded.scheduled_at;

 return query
 with due as (
  select r.id from public.push_reminders r join public.habits h on h.id=r.habit_id
  where not r.finished and r.attempts<3 and r.retry_at<=t and r.scheduled_at>=t-interval '10 minutes'
    and h.archived_at is null and h.reminder_at is not null
    and (r.reminder_day+h.reminder_at) at time zone 'Asia/Jakarta'=r.scheduled_at
    and not exists(select 1 from public.habit_logs l where l.habit_id=h.id and l.log_date=r.reminder_day)
  order by r.scheduled_at,r.id limit 75 for update of r skip locked
 ), claimed as (
  update public.push_reminders r set attempts=r.attempts+1,retry_at=t+interval '2 minutes'
  from due where r.id=due.id returning r.*
 )
 select c.id,s.endpoint,s.p256dh,s.auth_key,h.name,h.id,c.reminder_day
 from claimed c join public.push_subscriptions s on s.id=c.subscription_id
 join public.habits h on h.id=c.habit_id;
end $$;

create function public.finish_push_reminder(p_id uuid,p_expired boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_expired then
  delete from public.push_subscriptions s using public.push_reminders r where s.id=r.subscription_id and r.id=p_id;
 else
  update public.push_reminders set finished=true where id=p_id;
 end if;
end $$;

create function public.admin_user_habits(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; today date := public.local_day(now());
begin
 if not public.is_admin() then raise exception 'Akses ditolak'; end if;
 select jsonb_build_object(
 'profile', jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'xp',p.xp,'level',p.level,'rank',p.rank),
 'habits',coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',h.id,'name',h.name,'category',h.category,'is_custom',h.is_custom,'difficulty',h.difficulty,
   'duration_minutes',h.duration_minutes,'weekdays',h.weekdays,'reminder_at',h.reminder_at,
   'streak',h.streak,'archived_at',h.archived_at,'today_done',s.today_done,'last_done',s.last_done,'completion_count',s.total
  ) order by h.archived_at nulls first,h.created_at desc)
  from public.habits h cross join lateral (
   select count(*) total,max(log_date) last_done,coalesce(bool_or(log_date=today),false) today_done
   from public.habit_logs l where l.habit_id=h.id and l.user_id=p_id
  ) s where h.user_id=p_id
 ),'[]'::jsonb),
 'logs',coalesce((
  select jsonb_agg(to_jsonb(l) order by l.log_date desc,l.created_at desc)
  from (
   select x.habit_id,h.name,x.log_date,x.duration_minutes,x.xp,x.created_at
   from public.habit_logs x join public.habits h on h.id=x.habit_id
   where x.user_id=p_id order by x.log_date desc,x.created_at desc limit 30
  ) l
 ),'[]'::jsonb)
 ) into result from public.profiles p where p.id=p_id;
 return result;
end $$;

revoke execute on function public.register_push(text,text,text),public.remove_push(text),public.get_push_state(text),public.set_habit_reminder(uuid,time),
 public.claim_push_reminders(),public.finish_push_reminder(uuid,boolean),public.admin_user_habits(uuid) from public,anon,authenticated;
grant execute on function public.register_push(text,text,text),public.remove_push(text),public.get_push_state(text),public.set_habit_reminder(uuid,time),public.admin_user_habits(uuid) to authenticated;
grant execute on function public.claim_push_reminders(),public.finish_push_reminder(uuid,boolean) to service_role;
commit;
