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

type ClaimedObligationReminder = {
  log_id: string;
  obligation_id: string;
  title: string;
  category: string;
  amount_due: number | null;
  due_date: string;
  reminder_day: number;
  official_payment_url: string | null;
  recipient_emails: string[];
  property_name: string | null;
  business_name: string | null;
};

function nextOccurrence(reminder: ClaimedReminder) {
  if (reminder.recurrence === "none") return null;
  const timezone = reminder.timezone || "America/Los_Angeles";
  const currentUtc = new Date(reminder.next_send_at);
  const local = toZonedTime(currentUtc, timezone);
  let nextLocal: Date;
  switch (reminder.recurrence) {
    case "daily": nextLocal = addDays(local, 1); break;
    case "weekly": nextLocal = addWeeks(local, 1); break;
    case "monthly": nextLocal = addMonths(local, 1); break;
    case "yearly": nextLocal = addYears(local, 1); break;
    default: return null;
  }
  return fromZonedTime(nextLocal, timezone).toISOString();
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function money(value: number | null) {
  return value == null ? null : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function dueLabel(day: number) {
  if (day > 1) return `Due in ${day} days`;
  if (day === 1) return "Due tomorrow";
  if (day === 0) return "DUE TODAY";
  if (day === -1) return "PAST DUE by 1 day";
  return `PAST DUE by ${Math.abs(day)} days`;
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
    return NextResponse.json({ ok: false, error: "Reminder email environment variables are incomplete." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [familyClaim, obligationClaim] = await Promise.all([
    supabase.rpc("claim_due_family_reminders", { p_secret: cronSecret, p_limit: 25 }),
    supabase.rpc("claim_due_obligation_reminders", { p_secret: cronSecret, p_limit: 100 }),
  ]);

  if (familyClaim.error) return NextResponse.json({ ok: false, error: familyClaim.error.message }, { status: 500 });
  if (obligationClaim.error) return NextResponse.json({ ok: false, error: obligationClaim.error.message }, { status: 500 });

  const reminders = (familyClaim.data ?? []) as ClaimedReminder[];
  const obligations = (obligationClaim.data ?? []) as ClaimedObligationReminder[];
  const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth: { user: smtpUser, pass: smtpPassword } });

  let familySent = 0;
  let familyFailed = 0;
  let obligationSent = 0;
  let obligationFailed = 0;

  for (const reminder of reminders) {
    try {
      const recipients = reminder.recipient_emails.filter(Boolean);
      if (!recipients.length) throw new Error("No recipient email addresses configured.");
      const message = reminder.notes?.trim() || "This is your Vo Family reminder.";
      const when = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone: reminder.timezone || "America/Los_Angeles" }).format(new Date(reminder.next_send_at));
      const plainText = ["VO FAMILY REMINDER", "", reminder.title, "", message, "", `Scheduled for: ${when}`, reminder.recurrence === "none" ? "One-time reminder" : `Repeats: ${reminder.recurrence}`, "", "Sent by the Vo Family Reminder system."].join("\n");
      const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;line-height:1.6"><div style="font-size:12px;letter-spacing:.16em;color:#6b7280;font-weight:700">VO FAMILY REMINDER</div><h1 style="font-size:24px;margin:10px 0 18px">${escapeHtml(reminder.title)}</h1><div style="font-size:16px;white-space:pre-wrap">${escapeHtml(message)}</div><div style="margin-top:24px;padding:16px;border-radius:12px;background:#f3f4f6"><div><strong>Scheduled for:</strong> ${escapeHtml(when)}</div><div><strong>Repeat:</strong> ${escapeHtml(reminder.recurrence === "none" ? "One time" : reminder.recurrence)}</div></div><p style="margin-top:24px;font-size:12px;color:#9ca3af">Sent by the Vo Family Reminder system.</p></div>`;
      await transporter.sendMail({ from: `Vo Family Reminders <${smtpUser}>`, to: recipients, subject: reminder.subject, text: plainText, html });
      const nextSendAt = nextOccurrence(reminder);
      const { error } = await supabase.rpc("complete_family_reminder_send", { p_secret: cronSecret, p_id: reminder.id, p_sent_at: new Date().toISOString(), p_next_send_at: nextSendAt, p_keep_active: Boolean(nextSendAt) });
      if (error) throw error;
      familySent += 1;
    } catch (sendError) {
      familyFailed += 1;
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      await supabase.rpc("fail_family_reminder_send", { p_secret: cronSecret, p_id: reminder.id, p_error: errorMessage });
    }
  }

  for (const item of obligations) {
    try {
      const recipients = [...new Set((item.recipient_emails ?? []).map((email) => email.trim()).filter(Boolean))];
      if (!recipients.length) throw new Error("No compliance reminder recipients configured.");
      const context = item.property_name || item.business_name || "Compliance item";
      const amount = money(item.amount_due);
      const due = new Date(`${item.due_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const status = dueLabel(item.reminder_day);
      const subject = `${status}: ${item.title}`;
      const plainText = ["VO FAMILY COMPLIANCE REMINDER", "", status, item.title, context, "", `Due date: ${due}`, amount ? `Amount: ${amount}` : null, item.official_payment_url ? `Official link: ${item.official_payment_url}` : null, "", "Please review this item before the due date.", "", "Sent automatically by the Vo Family Reminder system."].filter(Boolean).join("\n");
      const actionButton = item.official_payment_url ? `<p style="margin-top:22px"><a href="${escapeHtml(item.official_payment_url)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open official site</a></p>` : "";
      const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;line-height:1.6"><div style="font-size:12px;letter-spacing:.14em;color:#2563eb;font-weight:700">VO FAMILY COMPLIANCE REMINDER</div><h1 style="font-size:24px;margin:10px 0 6px">${escapeHtml(item.title)}</h1><p style="margin:0 0 20px;color:#6b7280">${escapeHtml(context)}</p><div style="padding:18px;border-radius:14px;background:#eff6ff"><div style="font-weight:700;font-size:18px">${escapeHtml(status)}</div><div style="margin-top:8px"><strong>Due:</strong> ${escapeHtml(due)}</div>${amount ? `<div><strong>Amount:</strong> ${escapeHtml(amount)}</div>` : ""}</div>${actionButton}<p style="margin-top:24px;font-size:12px;color:#9ca3af">Automatic reminders are scheduled 30, 7, and 2 days before the due date. Marking an obligation paid or completed stops future reminders. Escrowed property-tax items are excluded.</p></div>`;
      await transporter.sendMail({ from: `Vo Family Reminders <${smtpUser}>`, to: recipients, subject, text: plainText, html });
      const { error } = await supabase.rpc("complete_obligation_reminder_send", { p_secret: cronSecret, p_log_id: item.log_id, p_sent_at: new Date().toISOString() });
      if (error) throw error;
      obligationSent += 1;
    } catch (sendError) {
      obligationFailed += 1;
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      await supabase.rpc("fail_obligation_reminder_send", { p_secret: cronSecret, p_log_id: item.log_id, p_error: errorMessage });
    }
  }

  return NextResponse.json({ ok: true, family: { processed: reminders.length, sent: familySent, failed: familyFailed }, compliance: { processed: obligations.length, sent: obligationSent, failed: obligationFailed } });
}
