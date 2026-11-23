insert into public.badges(id,name) values
 ('daily','Langkah Pertama'),('weekly','Ritme Konsisten'),('special','Penjelajah Gerbang')
on conflict do nothing;

insert into public.habit_templates(name,category,difficulty,duration_minutes,xp_reward)
select h.name,h.category,d.name,d.minutes,d.xp from
(values ('Latihan fisik','Strength'),('Membaca buku','Intelligence'),('Sesi fokus','Discipline'),('Meditasi','Vitality')) h(name,category)
cross join (values ('Easy',10,20),('Medium',25,45),('Hard',45,85),('Extreme',60,120)) d(name,minutes,xp)
on conflict do nothing;

insert into public.quest_pool(id,name,kind,category,xp_reward,badge_id) values
 ('00000000-0000-4000-8000-000000000001','Latihan Harian','daily',null,30,'daily'),
 ('00000000-0000-4000-8000-000000000002','Mode Fokus','daily','Discipline',35,'daily'),
 ('00000000-0000-4000-8000-000000000003','Misi Mingguan','weekly',null,65,'weekly'),
 ('00000000-0000-4000-8000-000000000004','Gerbang Khusus','special',null,90,'special')
on conflict do nothing;
