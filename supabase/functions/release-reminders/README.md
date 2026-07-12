# Kinora Release Reminders

This Edge Function sends release reminder emails for rows in
`public.upcoming_movie_reminders`.

Required Supabase secrets:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set KINORA_REMINDER_FROM="Kinora <reminders@your-domain.com>"
```

Deploy:

```bash
supabase functions deploy release-reminders
```

Schedule it once per day with Supabase Scheduled Functions or `pg_cron`.
The function only marks a reminder as sent after the Resend API call succeeds.
If `RESEND_API_KEY` is missing, no reminders are marked as sent.

Email copy intentionally says “It may now be available in cinemas” because a
release date does not prove local cinema availability.
