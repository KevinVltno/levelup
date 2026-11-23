create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('levelup-settle-quests', '* * * * *', 'select public.settle_quests_job()');
