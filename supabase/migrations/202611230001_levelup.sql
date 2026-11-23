begin;
create table public.ranks (name text primary key, min_level integer unique not null);
insert into public.ranks values ('E',1),('D',5),('C',10),('B',20),('A',35),('S',50),('National Level',75);

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null check (char_length(name) between 1 and 60),
 role text not null default 'user' check (role in ('user','admin')),
 xp int not null default 0 check (xp >= 0),
 level int not null default 1,
 rank text not null default 'E' references public.ranks,
 created_at timestamptz not null default now()
);
create table public.habit_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 80),
 category text not null check (category in ('Strength','Intelligence','Discipline','Vitality')),
 difficulty text not null check (difficulty in ('Easy','Medium','Hard','Extreme')),
 duration_minutes int not null check (duration_minutes between 1 and 180),
 xp_reward int not null check (xp_reward between 1 and 500),
 active boolean not null default true,
 unique(name, category, difficulty)
);
create table public.habits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 template_id uuid references public.habit_templates,
 name text not null check (char_length(name) between 1 and 80),
 category text not null check (category in ('Strength','Intelligence','Discipline','Vitality')),
 is_custom boolean not null,
 difficulty text check (difficulty in ('Easy','Medium','Hard','Extreme')),
 duration_minutes int not null check (duration_minutes between 1 and 180),
 xp_reward int not null check (xp_reward between 0 and 500),
 weekdays int[] not null default '{1,2,3,4,5,6,7}' check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
 reminder_at time,
 streak int not null default 0,
 missed int not null default 0,
 checked_through date not null,
 created_at timestamptz not null default now(),
 archived_at timestamptz,
 check (is_custom = (difficulty is null) and is_custom = (template_id is null)),
 unique(id,user_id)
);
create unique index one_active_template on public.habits(user_id,name,category) where not is_custom and archived_at is null;
create table public.habit_logs (
 habit_id uuid not null,
 user_id uuid not null,
 log_date date not null,
 duration_minutes int not null check (duration_minutes between 1 and 180),
 xp int not null check (xp >= 0),
 created_at timestamptz not null default now(),
 primary key (habit_id,log_date),
 foreign key (habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
create table public.badges (id text primary key, name text not null);
create table public.quest_pool (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 80),
 kind text not null check(kind in ('daily','weekly','special')),
 category text check(category in ('Strength','Intelligence','Discipline','Vitality')),
 xp_reward int not null check(xp_reward between 1 and 500),
 badge_id text not null references public.badges,
 active boolean not null default true
);
create table public.user_quests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 habit_id uuid not null,
 pool_id uuid not null references public.quest_pool,
 title text not null,
 kind text not null check(kind in ('daily','weekly','special')),
 status text not null default 'ready' check(status in ('ready','running','paused','completed','failed')),
 assigned_date date not null,
 expires_at timestamptz not null,
 duration_seconds int not null check(duration_seconds between 60 and 10800),
 xp_reward int not null,
 badge_id text not null references public.badges,
 started_at timestamptz,
 running_since timestamptz,
 paused_at timestamptz,
 elapsed interval not null default interval '0',
 elapsed_seconds double precision generated always as (extract(epoch from elapsed)) stored,
 completed_at timestamptz,
 foreign key (habit_id,user_id) references public.habits(id,user_id) on delete cascade,
 unique(user_id,kind,assigned_date,habit_id)
);
create unique index one_running_quest on public.user_quests(user_id) where status = 'running';
create table public.user_badges (
 user_id uuid references public.profiles on delete cascade,
 badge_id text references public.badges,
 earned_at timestamptz not null default now(),
 primary key(user_id,badge_id)
);
create table public.xp_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles on delete cascade,
 source text not null,
 amount int not null,
 created_at timestamptz not null
);
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null check(char_length(content) between 1 and 12000),
 created_at timestamptz not null default clock_timestamp()
);
create index habits_owner on public.habits(user_id);
create index logs_owner on public.habit_logs(user_id,log_date);
create index quest_open on public.user_quests(user_id,expires_at) where status in ('ready','running','paused');
create index xp_owner on public.xp_events(user_id,created_at);
create index chat_owner on public.chat_messages(user_id,created_at desc);

create function public.is_admin() returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

alter table public.profiles enable row level security;
alter table public.habit_templates enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.quest_pool enable row level security;
alter table public.user_quests enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.chat_messages enable row level security;
alter table public.xp_events enable row level security;
alter table public.ranks enable row level security;

create policy profile_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy own_habits on public.habits for select to authenticated using (user_id = auth.uid());
create policy own_logs on public.habit_logs for select to authenticated using (user_id = auth.uid());
create policy own_quests on public.user_quests for select to authenticated using (user_id = auth.uid());
create policy own_badges on public.user_badges for select to authenticated using (user_id = auth.uid());
create policy own_chat on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy own_events on public.xp_events for select to authenticated using (user_id = auth.uid());
create policy template_read on public.habit_templates for select to authenticated using (active or public.is_admin());
create policy template_manage on public.habit_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pool_manage on public.quest_pool for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy badge_read on public.badges for select to authenticated using (true);
create policy rank_read on public.ranks for select to authenticated using (true);
revoke all on public.profiles,public.habits,public.habit_logs,public.habit_templates,public.quest_pool,public.user_quests,public.badges,public.user_badges,public.chat_messages,public.xp_events,public.ranks from public,anon,authenticated;
grant select on public.profiles,public.habits,public.habit_logs,public.habit_templates,public.quest_pool,public.user_quests,public.badges,public.user_badges,public.chat_messages,public.xp_events,public.ranks to authenticated;
grant insert,update on public.habit_templates,public.quest_pool to authenticated;

create function public.local_day(p_time timestamptz) returns date language sql stable set search_path = ''
as $$ select (p_time at time zone 'Asia/Jakarta')::date $$;

create function public.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,name) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'name'),60),''),'Hunter')) on conflict do nothing;
 return new;
end $$;
create trigger levelup_new_profile after insert on auth.users for each row execute function public.new_profile();
insert into public.profiles(id,name) select id,coalesce(nullif(left(trim(raw_user_meta_data->>'name'),60),''),'Hunter') from auth.users on conflict do nothing;

create function public.update_rank() returns trigger language plpgsql set search_path = '' as $$
begin
 -- Total XP at level L is 50 * L * (L - 1).
 new.level := floor((1 + sqrt(1 + new.xp::numeric / 12.5)) / 2);
 select name into new.rank from public.ranks where min_level <= new.level order by min_level desc limit 1;
 return new;
end $$;
create trigger levelup_rank before update of xp on public.profiles for each row execute function public.update_rank();

create function public.award_xp(p_user uuid,p_source text,p_amount int,p_at timestamptz) returns void language plpgsql set search_path = '' as $$
declare current_xp int; delta int;
begin
 select xp into current_xp from public.profiles where id=p_user for update;
 delta := greatest(-current_xp,p_amount);
 if delta <> 0 then
  update public.profiles set xp=xp+delta where id=p_user;
  insert into public.xp_events(user_id,source,amount,created_at) values(p_user,p_source,delta,p_at);
 end if;
end $$;

create function public.settle_user(p_user uuid,p_now timestamptz) returns void language plpgsql set search_path = '' as $$
declare h public.habits; q public.user_quests; due_at timestamptz; missed_days int; day date := public.local_day(p_now);
begin
 perform 1 from public.profiles where id=p_user for update;
 for q in select * from public.user_quests where user_id=p_user and status in ('ready','running','paused') loop
  due_at := q.running_since + (q.duration_seconds * interval '1 second' - q.elapsed);
  if q.status='running' and due_at <= least(p_now,q.expires_at) then
   update public.user_quests set status='completed',completed_at=due_at,running_since=null where id=q.id;
   perform public.award_xp(p_user,'quest',q.xp_reward,due_at);
   insert into public.user_badges(user_id,badge_id,earned_at) values(p_user,q.badge_id,due_at) on conflict do nothing;
  elsif p_now >= q.expires_at then
   update public.user_quests set status='failed',running_since=null where id=q.id;
   update public.habits set streak=0 where id=q.habit_id and not exists (
    select 1 from public.habit_logs where habit_id=q.habit_id and log_date >= public.local_day(q.expires_at)
   );
   perform public.award_xp(p_user,'quest_penalty',-5,q.expires_at);
  end if;
 end loop;
 for h in select * from public.habits where user_id=p_user and archived_at is null and checked_through < day-1 loop
  select count(*) into missed_days from generate_series((h.checked_through+1)::timestamp,(day-1)::timestamp,interval '1 day') d
   where extract(isodow from d)::int=any(h.weekdays)
   and not exists(select 1 from public.habit_logs l where l.habit_id=h.id and l.log_date=d::date);
  update public.habits set checked_through=day-1, missed=missed+missed_days,
   streak=case when missed_days>0 then 0 else streak end where id=h.id;
  if missed_days>0 and h.streak>0 then perform public.award_xp(p_user,'streak_penalty',-5,p_now); end if;
 end loop;
end $$;

create function public.add_habit(p_template uuid,p_name text,p_category text,p_duration int,p_weekdays int[],p_reminder time)
 returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t public.habit_templates; result uuid;
begin
 if u is null then raise exception 'Sesi berakhir'; end if;
 if p_template is not null then
  select * into t from public.habit_templates where id=p_template and active;
  if not found then raise exception 'Template tidak tersedia'; end if;
 end if;
 insert into public.habits(user_id,template_id,name,category,is_custom,difficulty,duration_minutes,xp_reward,weekdays,reminder_at,checked_through)
 values(u,p_template,trim(coalesce(t.name,p_name)),coalesce(t.category,p_category),p_template is null,t.difficulty,
 coalesce(t.duration_minutes,p_duration),coalesce(t.xp_reward,0),p_weekdays,p_reminder,public.local_day(now())-1)
 returning id into result;
 return result;
end $$;

create function public.archive_habit(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
 perform public.settle_user(u,clock_timestamp());
 update public.habits set archived_at=now() where id=p_id and user_id=u and archived_at is null;
 if not found then raise exception 'Habit tidak tersedia'; end if;
 update public.user_quests set status='failed',running_since=null where habit_id=p_id and user_id=u and status in ('ready','running','paused');
end $$;

create function public.log_habit(p_id uuid,p_minutes int) returns int language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); t timestamptz; d date; h public.habits; reward int; used int;
begin
 perform 1 from public.profiles where id=u for update;
 t:=clock_timestamp();
 d:=public.local_day(t);
 perform public.settle_user(u,t);
 select * into h from public.habits where id=p_id and user_id=u and archived_at is null;
 if not found or not (extract(isodow from d)::int=any(h.weekdays)) then raise exception 'Habit tidak terjadwal hari ini'; end if;
 if exists(select 1 from public.habit_logs where habit_id=p_id and log_date=d) then return 0; end if;
 if h.is_custom then
  if p_minutes is null or p_minutes not between 1 and 180 then raise exception 'Isi durasi aktual 1–180 menit'; end if;
  select coalesce(sum(l.xp),0) into used from public.habit_logs l join public.habits a on a.id=l.habit_id
   where l.user_id=u and l.log_date=d and a.is_custom;
  reward:=least(p_minutes*2,greatest(100-used,0));
 else
  p_minutes:=h.duration_minutes;
  reward:=h.xp_reward;
 end if;
 insert into public.habit_logs(habit_id,user_id,log_date,duration_minutes,xp) values(p_id,u,d,p_minutes,reward);
 update public.habits set streak=streak+1 where id=p_id;
 perform public.award_xp(u,'habit',reward,t);
 return reward;
end $$;

create function public.sync_quests() returns timestamptz language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); t timestamptz; d date; week date; k text; start_day date; deadline timestamptz; slots int;
begin
 if u is null then raise exception 'Sesi berakhir'; end if;
 perform 1 from public.profiles where id=u for update;
 t:=clock_timestamp();
 d:=public.local_day(t);
 week:=d-(extract(isodow from d)::int-1);
 perform public.settle_user(u,t);
 foreach k in array array['daily','weekly','special'] loop
  start_day:=case when k='daily' then d else week end;
  deadline:=((start_day+case when k='daily' then 1 else 7 end)::timestamp at time zone 'Asia/Jakarta');
  slots:=case when k='daily' then 3 else 1 end;
  slots:=slots-(select count(*) from public.user_quests where user_id=u and kind=k and assigned_date=start_day);
  if slots <= 0 then continue; end if;
  insert into public.user_quests(user_id,habit_id,pool_id,title,kind,assigned_date,expires_at,duration_seconds,xp_reward,badge_id)
  select u,h.id,p.id,p.name || ' · ' || h.name,k,start_day,deadline,h.duration_minutes*60,p.xp_reward,p.badge_id
  from public.habits h
  cross join lateral (
   select * from public.quest_pool qp where qp.active and qp.kind=k and (qp.category is null or qp.category=h.category)
   order by random() limit 1
  ) p
  where h.user_id=u and h.archived_at is null
   and (k<>'daily' or extract(isodow from d)::int=any(h.weekdays))
   and not exists(select 1 from public.user_quests q where q.user_id=u and q.kind=k and q.assigned_date=start_day and q.habit_id=h.id)
  order by random() limit slots;
 end loop;
 return clock_timestamp();
end $$;

create function public.quest_action(p_id uuid,p_action text) returns text language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); t timestamptz; q public.user_quests;
begin
 perform 1 from public.profiles where id=u for update;
 t:=clock_timestamp();
 perform public.settle_user(u,t);
 select * into q from public.user_quests where id=p_id and user_id=u;
 if not found then raise exception 'Quest tidak tersedia'; end if;
 if q.status in ('completed','failed') or p_action='finish' then return q.status; end if;
 if (p_action='start' and q.status='ready') or (p_action='resume' and q.status='paused') then
  if exists(select 1 from public.user_quests where user_id=u and status='running') then raise exception 'Jeda quest yang sedang berjalan'; end if;
  if t + (q.duration_seconds * interval '1 second' - q.elapsed) > q.expires_at then raise exception 'Waktu periode tidak mencukupi'; end if;
  update public.user_quests set status='running',started_at=coalesce(started_at,t),running_since=t,paused_at=null where id=p_id;
  return 'running';
 elsif p_action='pause' and q.status='running' then
  update public.user_quests set status='paused',running_since=null,paused_at=t,elapsed=elapsed+(t-q.running_since) where id=p_id;
  return 'paused';
 elsif p_action='cancel' and q.status in ('running','paused') then
  update public.user_quests set status='ready',started_at=null,running_since=null,paused_at=null,elapsed=interval '0' where id=p_id;
  return 'ready';
 end if;
 return q.status;
end $$;

create function public.settle_quests_job() returns void language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
 for u in select distinct user_id from public.user_quests
  where status in ('ready','paused','running') and (expires_at<=now() or (status='running' and running_since+duration_seconds*interval '1 second'-elapsed<=now()))
  order by user_id
 loop
  perform public.settle_user(u,clock_timestamp());
 end loop;
end $$;

create function public.leaderboard(p_weekly boolean) returns table(name text, xp bigint, level int, rank text)
 language sql stable security definer set search_path = '' as $$
 select p.name, s.score, p.level, p.rank from public.profiles p
 cross join lateral (select case when p_weekly then
  (select coalesce(sum(e.amount),0) from public.xp_events e where e.user_id=p.id
   and e.created_at >= (date_trunc('week',now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'))
  else p.xp::bigint end as score) s
 where auth.uid() is not null and s.score>0 order by s.score desc,p.created_at,p.id limit 20
$$;

create function public.admin_role(p_id uuid,p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() or p_id=auth.uid() then raise exception 'Akses ditolak'; end if;
 update public.profiles set role=p_role where id=p_id;
 if not found then raise exception 'Akun tidak ditemukan'; end if;
end $$;

create function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Akses ditolak'; end if;
 return jsonb_build_object('users',(select count(*) from public.profiles),'habits',(select count(*) from public.habits where archived_at is null),
 'quests',(select count(*) from public.user_quests where status='completed'),'xp',(select coalesce(sum(xp),0) from public.profiles));
end $$;

create function public.accept_chat(p_content text) returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); result uuid;
begin
 if u is null or char_length(p_content) not between 1 and 2000 then raise exception 'Pesan tidak valid'; end if;
 perform 1 from public.profiles where id=u for update;
 if (select count(*) from public.chat_messages where user_id=u and role='user' and created_at>clock_timestamp()-interval '1 hour')>=20
 then raise exception using errcode='P0429',message='Batas 20 pesan per jam tercapai'; end if;
 insert into public.chat_messages(user_id,role,content) values(u,'user',p_content) returning id into result;
 return result;
end $$;

revoke execute on function public.is_admin(),public.local_day(timestamptz),public.new_profile(),public.update_rank(),
 public.award_xp(uuid,text,int,timestamptz),public.settle_user(uuid,timestamptz),public.settle_quests_job(),
 public.add_habit(uuid,text,text,int,int[],time),public.archive_habit(uuid),public.log_habit(uuid,int),
 public.sync_quests(),public.quest_action(uuid,text),public.leaderboard(boolean),public.admin_role(uuid,text),public.admin_stats(),
 public.accept_chat(text) from public,anon,authenticated;
grant execute on function public.is_admin(),public.add_habit(uuid,text,text,int,int[],time),
 public.archive_habit(uuid),public.log_habit(uuid,int),public.sync_quests(),public.quest_action(uuid,text),
 public.leaderboard(boolean),public.admin_role(uuid,text),public.admin_stats(),public.accept_chat(text) to authenticated;
grant insert on public.chat_messages to service_role;
commit;
