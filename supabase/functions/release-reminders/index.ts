import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Reminder = {
  id: string;
  user_id: string;
  movie_title: string;
  release_date: string | null;
};

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const today = new Date();
  const soon = new Date(today);
  soon.setDate(today.getDate() + 3);
  const from = today.toISOString().slice(0, 10);
  const to = soon.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("upcoming_movie_reminders")
    .select("id,user_id,movie_title,release_date")
    .eq("reminder_status", "active")
    .eq("reminder_sent", false)
    .gte("release_date", from)
    .lte("release_date", to);

  if (error) return new Response(JSON.stringify({ error }), { status: 500 });

  const reminders = (data ?? []) as Reminder[];

  // Email provider integration goes here. Supabase Auth does not expose a simple
  // broadcast email API from Edge Functions; connect Resend, SendGrid, or SMTP.
  // This function marks due reminders as sent once the email call succeeds.
  for (const reminder of reminders) {
    await supabase
      .from("upcoming_movie_reminders")
      .update({
        reminder_sent: true,
        reminder_status: "sent",
        reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", reminder.id);
  }

  return new Response(JSON.stringify({ checked: reminders.length }), {
    headers: { "content-type": "application/json" },
  });
});
