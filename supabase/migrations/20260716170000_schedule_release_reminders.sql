create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kinora-release-reminders') then
    perform cron.unschedule('kinora-release-reminders');
  end if;
end
$$;

select cron.schedule(
  'kinora-release-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://eldtneiumwborlpcofwr.supabase.co/functions/v1/release-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
