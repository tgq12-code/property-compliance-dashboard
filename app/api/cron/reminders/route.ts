import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

type ClaimedReminder = {
  id: string;
  title: string;
  subject: string;
  notes: string | null;
  starts_at: string;
  timezone: string;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recipient_emails: string[];
  sender_email: string;
  next_send_at: string;
};

function nextOccurrence(reminder: ClaimedReminder) {
  if (reminder.recurrence === "none") return null;

  const timezone = reminder.timezone || "America/Los_Angeles";
  const currentUtc = new Date(reminder.next_send_at);
  const local = toZonedTime(currentUtc, timezone);

  let nextLocal: Date;
  switch (reminder.recurrence) {
    case "daily":
      nextLocal = addDays(local, 1);
      break;
    case "weekly":
      nextLocal = addWeeks(local, 1);
      break;
    case "monthly":
      nextLocal = addMonths(local, 1);
      break;
    case "yearly":
      nextLocal = addYears(local, 1);
      break;
    default:
      return null;
  }

  return fromZonedTime(nextLocal, timezone).toISOString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const smtpUser = process.env.REMINDER_SMTP_USER;
  const smtpPassword = process.env.REMINDER_SMTP_APP_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      { ok: false, error: "Reminder email environment variables are incomplete." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("claim_due_family_reminders", {
    p_secret: cronSecret,
    p_limit: 25,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const reminders = (data ?? []) as ClaimedReminder[];
  if (!reminders.length) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      const recipients = reminder.recipient_emails.filter(Boolean);
      if (!recipients.length) throw new Error("No recipient email addresses configured.");

      const message = reminder.notes?.trim() || "This is your Vo Family reminder.";
      const when = new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: reminder.timezone || "America/Los_Angeles",
      }).format(new Date(reminder.next_send_at));

      const plainText = [
        "VO FAMILY REMINDER",
        "",
        reminder.title,
        "",
        message,
        "",
        `Scheduled for: ${when}`,
        reminder.recurrence === "none" ? "One-time reminder" : `Repeats: ${reminder.recurrence}`,
        "",
        "Sent by the Vo Family Reminder system.",
      ].join("\n");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;line-height:1.6">
          <div style="font-size:12px;letter-spacing:.16em;color:#6b7280;font-weight:700">VO FAMILY REMINDER</div>
          <h1 style="font-size:24px;margin:10px 0 18px">${escapeHtml(reminder.title)}</h1>
          <div style="font-size:16px;white-space:pre-wrap">${escapeHtml(message)}</div>
          <div style="margin-top:24px;padding:16px;border-radius:12px;background:#f3f4f6">
            <div><strong>Scheduled for:</strong> ${escapeHtml(when)}</div>
            <div><strong>Repeat:</strong> ${escapeHtml(reminder.recurrence === "none" ? "One time" : reminder.recurrence)}</div>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af">Sent by the Vo Family Reminder system.</p>
        </div>`;

      await transporter.sendMail({
        from: `Vo Family Reminders <${smtpUser}>`,
        to: recipients,
        subject: reminder.subject,
        text: plainText,
        html,
      });

      const nextSendAt = nextOccurrence(reminder);
      const keepActive = Boolean(nextSendAt);

      const { error: completeError } = await supabase.rpc("complete_family_reminder_send", {
        p_secret: cronSecret,
        p_id: reminder.id,
        p_sent_at: new Date().toISOString(),
        p_next_send_at: nextSendAt,
        p_keep_active: keepActive,
      });

      if (completeError) throw completeError;
      sent += 1;
    } catch (sendError) {
      failed += 1;
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      await supabase.rpc("fail_family_reminder_send", {
        p_secret: cronSecret,
        p_id: reminder.id,
        p_error: errorMessage,
      });
    }
  }

  return NextResponse.json({ ok: true, processed: reminders.length, sent, failed });
}
