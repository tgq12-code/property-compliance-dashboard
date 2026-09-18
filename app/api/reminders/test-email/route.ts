import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/resend-email";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!token || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "Unable to verify your account." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.email) {
    return NextResponse.json({ ok: false, error: "Your sign-in expired. Please sign in again." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.approved) {
    return NextResponse.json({ ok: false, error: "This account is not approved." }, { status: 403 });
  }

  if (!resendApiKey) {
    console.error(JSON.stringify({ level: "error", event: "reminder_test_missing_resend_config" }));
    return NextResponse.json({ ok: false, error: "Email delivery is not configured yet." }, { status: 503 });
  }

  try {
    const sentAt = new Date();
    await sendReminderEmail({
      to: [user.email],
      subject: "Test successful — Vo Family reminder emails",
      text: `This is a test from Vo Family Operations. Email delivery worked successfully at ${sentAt.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific Time.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;line-height:1.6"><div style="font-size:12px;letter-spacing:.14em;color:#2563eb;font-weight:700">VO FAMILY OPERATIONS</div><h1 style="font-size:24px;margin:10px 0">Test email received</h1><p>Your reminder email delivery is working.</p><div style="margin-top:18px;padding:16px;border-radius:12px;background:#eff6ff"><strong>Tested:</strong> ${sentAt.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific Time</div><p style="margin-top:20px;font-size:13px;color:#64748b">Automatic compliance reminders are scheduled 30, 7, and 1 day before each due date.</p></div>`,
    });
    console.log(JSON.stringify({ level: "info", event: "reminder_test_sent", userId: user.id }));
    return NextResponse.json({ ok: true, sentAt: sentAt.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", event: "reminder_test_failed", error: message }));
    return NextResponse.json({ ok: false, error: "The test email could not be sent. Please check the email configuration." }, { status: 502 });
  }
}
