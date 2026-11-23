-- Provision push_cron_url and push_cron_secret in Supabase Vault before running.
create extension if not exists pg_net with schema extensions;
select cron.schedule('levelup-push-reminders','* * * * *',$job$
 select net.http_post(
  url := u.decrypted_secret,
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || s.decrypted_secret),
  body := '{}'::jsonb,
  timeout_milliseconds := 55000
 )
 from vault.decrypted_secrets u cross join vault.decrypted_secrets s
 where u.name='push_cron_url' and s.name='push_cron_secret';
$job$);
