import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Reminder = {
  id: string;
  user_id: string;
  movie_title: string;
  release_date: string | null;
  email: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const sendReminderEmail = async (reminder: Reminder, email: string) => {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  const senderEmail = Deno.env.get("KINORA_REMINDER_FROM_EMAIL") ?? "";
  const senderName = Deno.env.get("KINORA_REMINDER_FROM_NAME") ?? "Kinora";
  if (!brevoKey || !senderEmail) {
    return {
      ok: false,
      configured: false,
      error: "BREVO_API_KEY and KINORA_REMINDER_FROM_EMAIL must be configured.",
    };
  }

  const releaseDate = reminder.release_date ?? "Date not available";
  const subject = `Kinora release reminder: ${reminder.movie_title}`;
  const text = `${reminder.movie_title} is now scheduled for release.

You saved this movie in your Kinora Upcoming Watchlist.

Release date:
${releaseDate}

It may now be available in cinemas. Check your local cinema listings for current availability.`;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    return { ok: false, configured: true, error: await response.text() };
  }

  return { ok: true, configured: true, error: null };
};

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("upcoming_movie_reminders")
    .select("id,user_id,movie_title,release_date,email")
    .eq("reminder_status", "active")
    .eq("reminder_sent", false)
    .not("release_date", "is", null)
    .lte("release_date", today);

  if (error) return json({ error }, 500);

  const reminders = (data ?? []) as Reminder[];
  const results = [];

  for (const reminder of reminders) {
    const { data: claimed, error: claimError } = await supabase
      .from("upcoming_movie_reminders")
      .update({ reminder_status: "processing" })
      .eq("id", reminder.id)
      .eq("reminder_status", "active")
      .eq("reminder_sent", false)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      results.push({ id: reminder.id, sent: false, skipped: true, error: claimError?.message ?? "Already claimed." });
      continue;
    }

    let email = reminder.email ?? "";
    if (!email) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(reminder.user_id);
      if (userError) {
        await supabase.from("upcoming_movie_reminders").update({ reminder_status: "active" }).eq("id", reminder.id).eq("reminder_status", "processing");
        results.push({ id: reminder.id, sent: false, error: userError.message });
        continue;
      }
      email = userData.user?.email ?? "";
    }

    if (!email) {
      await supabase.from("upcoming_movie_reminders").update({ reminder_status: "active" }).eq("id", reminder.id).eq("reminder_status", "processing");
      results.push({ id: reminder.id, sent: false, error: "No user email found." });
      continue;
    }

    const sendResult = await sendReminderEmail(reminder, email);
    if (!sendResult.ok) {
      await supabase.from("upcoming_movie_reminders").update({ reminder_status: "active" }).eq("id", reminder.id).eq("reminder_status", "processing");
      results.push({ id: reminder.id, sent: false, configured: sendResult.configured, error: sendResult.error });
      continue;
    }

    const { error: updateError } = await supabase
      .from("upcoming_movie_reminders")
      .update({
        reminder_sent: true,
        reminder_status: "sent",
        reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", reminder.id)
      .eq("reminder_status", "processing")
      .eq("reminder_sent", false);

    results.push({ id: reminder.id, sent: !updateError, error: updateError?.message ?? null });
  }

  return json({
    checked: reminders.length,
    sent: results.filter((result) => result.sent).length,
    results,
  });
});
