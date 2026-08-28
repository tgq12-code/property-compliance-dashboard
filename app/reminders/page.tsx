"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, LogOut, Plus, Trash2 } from "lucide-react";
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

export default function RemindersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [recurrence, setRecurrence] = useState<Reminder["recurrence"]>("none");
  const [recipients, setRecipients] = useState("");

  async function loadReminders() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    const { data, error } = await supabase
      .from("family_reminders")
      .select("id,title,subject,notes,starts_at,recurrence,recipient_emails,sender_email,active")
      .order("starts_at", { ascending: true });
    if (error) setMessage(error.message);
    else setReminders((data ?? []) as Reminder[]);
    setLoading(false);
  }

  useEffect(() => { loadReminders(); }, []);

  async function saveReminder(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }

    const recipientEmails = recipients
      .split(/[;,\n]/)
      .map((email) => email.trim())
      .filter(Boolean);

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
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-medium text-gray-500">Vo Family Operations</p>
            <h1 className="text-2xl font-semibold text-gray-950">Family Reminders</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/properties" className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Properties</Link>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><LogOut size={16} /> Sign out</button>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"><Plus size={16} /> Add reminder</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <div className="flex gap-3"><Bell className="mt-0.5 shrink-0" size={18} /><div><p className="font-medium">Email sender: tuan.pi@gmail.com</p><p className="mt-1 text-amber-800">You can add one or more family email addresses to each reminder. The reminder schedule is saved now; automatic email delivery will use the connected mail service once the sender configuration is fully cleared and tested.</p></div></div>
        </section>

        {message && <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6"><h2 className="text-lg font-semibold text-gray-950">Add family reminder</h2><p className="mt-1 text-sm text-gray-500">Birthdays, bills, school dates, travel, renewals, appointments, family events, or anything else you do not want the Vo family to forget.</p></div>
            <form onSubmit={saveReminder} className="grid gap-5 md:grid-cols-2">
              <Field label="Reminder name" value={title} onChange={setTitle} required placeholder="Mom's birthday dinner" />
              <Field label="Email subject" value={subject} onChange={setSubject} required placeholder="VO FAMILY REMINDER: Mom's birthday dinner" />
              <label><span className="text-sm font-medium text-gray-700">Date and time</span><input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /></label>
              <label><span className="text-sm font-medium text-gray-700">Repeat</span><select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Reminder["recurrence"])} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-gray-900"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
              <label className="md:col-span-2"><span className="text-sm font-medium text-gray-700">Family member emails</span><textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} rows={3} placeholder="catmy@example.com, family@example.com" className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /><span className="mt-1 block text-xs text-gray-500">Separate multiple addresses with commas, semicolons, or new lines.</span></label>
              <label className="md:col-span-2"><span className="text-sm font-medium text-gray-700">Message / notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Dinner reservation is at 6:30 PM. Do not let Dad say nobody told him." className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" /></label>
              <div className="md:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700">Cancel</button><button disabled={saving} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save reminder"}</button></div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5"><h2 className="font-semibold text-gray-950">Upcoming reminders</h2><p className="mt-1 text-sm text-gray-500">One-time and repeating reminders for the family and household.</p></div>
          {loading ? <p className="px-6 py-8 text-sm text-gray-500">Loading reminders...</p> : reminders.length === 0 ? (
            <div className="px-6 py-12 text-center"><CalendarDays className="mx-auto text-gray-400" size={30} /><p className="mt-3 font-medium text-gray-900">No family reminders yet</p><p className="mt-1 text-sm text-gray-500">Add birthdays, appointments, bills, school events, renewals, or anything Catmy thinks of next.</p></div>
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
