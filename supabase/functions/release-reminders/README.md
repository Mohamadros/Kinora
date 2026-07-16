# Kinora Release Reminders

This Edge Function sends release reminder emails for rows in
`public.upcoming_movie_reminders`.

Required Supabase secrets:

```bash
supabase secrets set BREVO_API_KEY=your_brevo_api_key
supabase secrets set KINORA_REMINDER_FROM_EMAIL=reminders@your-domain.com
supabase secrets set KINORA_REMINDER_FROM_NAME=Kinora
```

Deploy:

```bash
supabase functions deploy release-reminders
```

The migration in `supabase/migrations/20260716170000_schedule_release_reminders.sql`
schedules it once per day at 08:00 UTC with `pg_cron` and `pg_net`.
The function atomically claims each due row with `reminder_status = processing`
before calling Brevo, so concurrent runs cannot deliver the same reminder twice.
It only marks a reminder as sent after the Brevo API call succeeds and returns a
failed claim to `active` so a later scheduled run can retry it.
If `BREVO_API_KEY` or `KINORA_REMINDER_FROM_EMAIL` is missing, no reminders are
marked as sent.

Email copy intentionally says “It may now be available in cinemas” because a
release date does not prove local cinema availability.
