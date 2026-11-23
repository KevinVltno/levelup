begin;

create table public.login_limits (
 bucket text primary key check (bucket ~ '^[a-f0-9]{64}$'),
 failures timestamptz[] not null default '{}',
 locked_until timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
create index login_limits_updated on public.login_limits(updated_at);

create table public.login_reservations (
 id uuid primary key default gen_random_uuid(),
 bucket text not null references public.login_limits on delete cascade,
 expires_at timestamptz not null
);
create index login_reservations_by_bucket on public.login_reservations(bucket);

alter table public.login_limits enable row level security;
alter table public.login_reservations enable row level security;
revoke all on public.login_limits,public.login_reservations from public,anon,authenticated;

create function public.begin_login(p_bucket text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.login_limits; t timestamptz; reservation uuid; pending int;
begin
 insert into public.login_limits(bucket) values(p_bucket) on conflict do nothing;
 select * into b from public.login_limits where bucket=p_bucket for update;
 t:=clock_timestamp();
 if b.locked_until>t then
  return jsonb_build_object('retry_after',ceil(extract(epoch from b.locked_until-t))::int);
 end if;
 if b.locked_until is not null then b.failures:='{}'; end if;
 select coalesce(array_agg(f),'{}') into b.failures
 from unnest(b.failures) f where f>t-interval '30 minutes';
 update public.login_limits set failures=b.failures,locked_until=null,updated_at=t where bucket=p_bucket;

 delete from public.login_reservations where bucket=p_bucket and expires_at<=t;
 select count(*) into pending from public.login_reservations where bucket=p_bucket;
 if cardinality(b.failures)+pending>=5 then
  return jsonb_build_object('pending',true);
 end if;
 insert into public.login_reservations(bucket,expires_at)
 values(p_bucket,t+interval '60 seconds') returning id into reservation;
 return jsonb_build_object('reservation',reservation);
end $$;

create function public.finish_login(p_bucket text,p_reservation uuid,p_result text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.login_limits; t timestamptz; remaining int;
begin
 if p_result is null or p_result not in ('failure','success','ignore') then raise exception 'Invalid login result'; end if;
 select * into b from public.login_limits where bucket=p_bucket for update;
 t:=clock_timestamp();
 delete from public.login_reservations where id=p_reservation and bucket=p_bucket and expires_at>t;
 if not found then return '{}'::jsonb; end if;
 if p_result='success' then
  update public.login_limits set failures='{}',locked_until=null,updated_at=t where bucket=p_bucket;
  return '{}'::jsonb;
 end if;
 if p_result='ignore' then return '{}'::jsonb; end if;

 select coalesce(array_agg(f),'{}') || t into b.failures
 from unnest(b.failures) f where f>t-interval '30 minutes';
 remaining:=greatest(0,5-cardinality(b.failures));
 if remaining=0 then b.locked_until:=t+interval '30 minutes'; end if;
 update public.login_limits set failures=b.failures,locked_until=b.locked_until,updated_at=t where bucket=p_bucket;
 return jsonb_build_object('remaining',remaining,'retry_after',case when remaining=0 then 1800 end);
end $$;

revoke execute on function public.begin_login(text),public.finish_login(text,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_login(text),public.finish_login(text,uuid,text) to service_role;

-- Hosted deployments already enable pg_cron for reminders.
do $$
begin
 if to_regnamespace('cron') is not null then
  perform cron.schedule('levelup-clean-login-limits','17 3 * * *',
    $job$delete from public.login_limits where updated_at < now()-interval '1 day'$job$);
 end if;
end $$;
commit;
