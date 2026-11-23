begin;
create table public.chat_threads (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 title text not null check (char_length(title) between 1 and 80),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 is_legacy boolean not null default false,
 unique(id,user_id)
);
create unique index chat_thread_legacy_owner on public.chat_threads(user_id) where is_legacy;
create index chat_thread_owner_recent on public.chat_threads(user_id,updated_at desc,id desc);
alter table public.chat_threads enable row level security;
revoke all on public.chat_threads from public,anon,authenticated;
grant select on public.chat_threads to authenticated;
create policy own_chat_threads on public.chat_threads for select to authenticated using (user_id=auth.uid());

alter table public.chat_messages add column thread_id uuid;
insert into public.chat_threads(user_id,title,created_at,updated_at,is_legacy)
select user_id,'Percakapan sebelumnya',min(created_at),max(created_at),true
from public.chat_messages group by user_id;
update public.chat_messages m set thread_id=t.id
from public.chat_threads t where t.is_legacy and t.user_id=m.user_id;
alter table public.chat_messages alter column thread_id set not null;
alter table public.chat_messages add foreign key (thread_id,user_id) references public.chat_threads(id,user_id) on delete cascade;
create index chat_messages_thread_recent on public.chat_messages(thread_id,created_at desc,id desc);

-- Older deployments can still write to the migrated legacy conversation.
create function public.assign_legacy_chat_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.thread_id is null then
  insert into public.chat_threads(user_id,title,is_legacy)
  values(new.user_id,'Percakapan sebelumnya',true)
  on conflict(user_id) where is_legacy
  do update set updated_at=greatest(chat_threads.updated_at,excluded.updated_at)
  returning id into new.thread_id;
 end if;
 return new;
end $$;
create trigger chat_legacy_thread before insert on public.chat_messages
for each row execute function public.assign_legacy_chat_thread();

create function public.accept_chat_message(p_thread uuid,p_content text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); result uuid; thread_owner uuid;
begin
 if u is null or p_thread is null or p_content is null or char_length(trim(p_content)) not between 1 and 2000
 then raise exception 'Pesan tidak valid'; end if;
 perform 1 from public.profiles where id=u for update;
 if (select count(*) from public.chat_messages where user_id=u and role='user' and created_at>clock_timestamp()-interval '1 hour')>=20
 then raise exception using errcode='P0429',message='Batas 20 pesan per jam tercapai'; end if;
 insert into public.chat_threads(id,user_id,title)
 values(p_thread,u,left(regexp_replace(trim(p_content),'[[:space:]]+',' ','g'),80))
 on conflict(id) do nothing;
 select user_id into thread_owner from public.chat_threads where id=p_thread;
 if thread_owner is distinct from u then raise exception using errcode='42501',message='Percakapan tidak tersedia'; end if;
 insert into public.chat_messages(user_id,thread_id,role,content) values(u,p_thread,'user',p_content) returning id into result;
 update public.chat_threads set updated_at=clock_timestamp() where id=p_thread;
 return result;
end $$;

revoke execute on function public.assign_legacy_chat_thread(),public.accept_chat_message(uuid,text) from public,anon,authenticated;
grant execute on function public.accept_chat_message(uuid,text) to authenticated;
grant select(id) on public.chat_messages to service_role;
commit;
