"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, LogOut, Mail, Plus, Save, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Reminder = {
  id: string;
  title: string;
  subject: string;
  notes: string | null;
  starts_at: string;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recipient_emails: string[];
  sender_email: string;
  active: boolean;
};

const recurrenceLabels: Record<Reminder["recurrence"], string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function parseEmails(value: string) {
  return Array.from(new Set(value.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean)));
}

export default function RemindersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [recurrence, setRecurrence] = useState<Reminder["recurrence"]>("none");
  const [recipients, setRecipients] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [complianceRecipients, setComplianceRecipients] = useState("");

  async function getActiveUser() {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    return null;
  }

  async function loadReminders() {
    setLoading(true);
    const user = await getActiveUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setPrimaryEmail(user.email ?? "");
    const [reminderResult, preferenceResult] = await Promise.all([
      supabase.from("family_reminders").select("id,title,subject,notes,starts_at,recurrence,recipient_emails,sender_email,active").order("starts_at", { ascending: true }),
      supabase.from("reminder_preferences").select("compliance_recipient_emails").eq("user_id", user.id).maybeSingle(),
    ]);
    if (reminderResult.error) setMessage(reminderResult.error.message);
    else setReminders((reminderResult.data ?? []) as Reminder[]);
    if (preferenceResult.error) setMessage(preferenceResult.error.message);
    else setComplianceRecipients(((preferenceResult.data?.compliance_recipient_emails ?? []) as string[]).join(", "));
    setLoading(false);
  }

  useEffect(() => { loadReminders(); }, []);

  async function saveComplianceRecipients() {
    setSavingSettings(true);
    setMessage("");
    const user = await getActiveUser();
    if (!user) {
      router.replace("/");
      return;
    }
    const extraEmails = parseEmails(complianceRecipients).filter((email) => email.toLowerCase() !== (user.email ?? "").toLowerCase());
    const { error } = await supabase.from("reminder_preferences").upsert({
      user_id: user.id,
      email_enabled: true,
      reminder_days: [30, 7, 2],
      compliance_recipient_emails: extraEmails,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) setMessage(error.message);
    else {
      setComplianceRecipients(extraEmails.join(", "));
      setMessage("Compliance email recipients saved.");
    }
    setSavingSettings(false);
  }

  async function saveReminder(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const user = await getActiveUser();
    if (!user) {
      router.replace("/");
      return;
    }

    const recipientEmails = parseEmails(recipients);

    const { error } = await supabase.from("family_reminders").insert({
      user_id: user.id,
      title: title.trim(),
      subject: subject.trim(),
      notes: notes.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      next_send_at: new Date(startsAt).toISOString(),
      recurrence,
      recipient_emails: recipientEmails,
      sender_email: "tuan.pi@gmail.com",
    });

    if (error) setMessage(error.message);
    else {
      setTitle(""); setSubject(""); setNotes(""); setStartsAt(""); setRecurrence("none"); setRecipients("");
      setShowForm(false);
      setMessage("Reminder saved.");
      await loadReminders();
    }
    setSaving(false);
  }

  async function deleteReminder(id: string) {
    if (!window.confirm("Delete this reminder?")) return;
    const { error } = await supabase.from("family_reminders").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await loadReminders();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const extraRecipientList = parseEmails(complianceRecipients);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link href="/dashboard" className="block hover:opacity-80">
              <p className="text-sm font-medium text-gray-500">Vo Family Operations</p>
              <h1 className="text-2xl font-semibold text-gray-950">Family Dashboard</h1>
            </Link>
            <p className="mt-1 text-sm text-gray-500">Family Reminders</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/properties" className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Properties</Link>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><LogOut size={16} /> Sign out</button>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"><Plus size={16} /> Add reminder</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Users size={20} /></div>
              <div>
                <h2 className="font-semibold text-blue-950">Compliance email recipients</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-800">Property tax and business compliance reminders always go to your main account. Add anyone else who should automatically receive the same 30-day, 7-day, and 2-day reminders.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {primaryEmail && <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-blue-800 shadow-sm">Primary · {primaryEmail}</span>}
                  {extraRecipientList.map((email) => <span key={email} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">{email}</span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label><span className="text-sm font-medium text-blue-950">Additional email addresses</span><textarea value={complianceRecipients} onChange={(e) => setComplianceRecipients(e.target.value)} rows={2} placeholder="spouse@example.com, accountant@example.com" className="mt-2 w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" /><span className="mt-1 block text-xs text-blue-700">Separate multiple addresses with commas, semicolons, or new lines. Your primary email does not need to be added.</span></label>
            <button onClick={saveComplianceRecipients} disabled={savingSettings} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save size={16} /> {savingSettings ? "Saving..." : "Save recipients"}</button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <div className="flex gap-3"><Mail className="mt-0.5 shrink-0" size={18} /><div><p className="font-medium">Email sender: tuan.pi@gmail.com</p><p className="mt-1 text-amber-800">Family reminders can have their own recipients. Compliance reminders use the recipient list above and stop automatically when an item is marked paid or completed.</p></div></div>
        </section>

        {message && <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6"><h2 className="text-lg font-semibold text-gray-950">Add family reminder</h2><p className="mt-1 text-sm text-gray-500">Create a one-time or repeating reminder and choose exactly who receives it.</p></div>
            <form onSubmit={saveReminder} className="grid gap-5 md:grid-cols-2">
              <Field label="Reminder name" value={title} onChange={setTitle} required placeholder="Mom's birthday dinner" />
              <Field label="Email subject" value={subject} onChange={setSubject} required placeholder="VO FAMILY REMINDER: Mom's birthday dinner" />
              <label><span className="text-sm font-medium text-gray-700">Date and time</span><input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /></label>
              <label><span className="text-sm font-medium text-gray-700">Repeat</span><select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Reminder["recurrence"])} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-gray-900"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
              <label className="md:col-span-2"><span className="text-sm font-medium text-gray-700">Email recipients</span><textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} rows={3} placeholder="family@example.com, another@example.com" className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /><span className="mt-1 block text-xs text-gray-500">Separate multiple addresses with commas, semicolons, or new lines.</span></label>
              <label className="md:col-span-2"><span className="text-sm font-medium text-gray-700">Message / notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Add any details that should appear in the email." className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /></label>
              <div className="md:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700">Cancel</button><button disabled={saving} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save reminder"}</button></div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5"><h2 className="font-semibold text-gray-950">Upcoming family reminders</h2><p className="mt-1 text-sm text-gray-500">One-time and repeating reminders for the family and household.</p></div>
          {loading ? <p className="px-6 py-8 text-sm text-gray-500">Loading reminders...</p> : reminders.length === 0 ? (
            <div className="px-6 py-12 text-center"><CalendarDays className="mx-auto text-gray-400" size={30} /><p className="mt-3 font-medium text-gray-900">No family reminders yet</p><p className="mt-1 text-sm text-gray-500">Add a reminder whenever you need one.</p></div>
          ) : (
            <div className="divide-y divide-gray-100">{reminders.map((reminder) => <div key={reminder.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr_0.8fr_1fr_auto] md:items-center"><div><p className="font-medium text-gray-950">{reminder.title}</p><p className="mt-1 text-sm text-gray-500">Subject: {reminder.subject}</p>{reminder.notes && <p className="mt-1 text-xs text-gray-400">{reminder.notes}</p>}</div><div><p className="text-xs uppercase tracking-wide text-gray-400">When</p><p className="mt-1 text-sm font-medium text-gray-800">{new Date(reminder.starts_at).toLocaleString()}</p><p className="mt-1 text-xs text-gray-500">{recurrenceLabels[reminder.recurrence]}</p></div><div><p className="text-xs uppercase tracking-wide text-gray-400">Email to</p><p className="mt-1 text-sm text-gray-700">{reminder.recipient_emails.length ? reminder.recipient_emails.join(", ") : "No recipients yet"}</p><p className="mt-1 text-xs text-gray-400">From {reminder.sender_email}</p></div><button onClick={() => deleteReminder(reminder.id)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50" aria-label={`Delete ${reminder.title}`}><Trash2 size={16} /></button></div>)}</div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label><span className="text-sm font-medium text-gray-700">{label}</span><input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /></label>;
}
