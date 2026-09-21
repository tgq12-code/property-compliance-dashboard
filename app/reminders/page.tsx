"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, Mail, Pencil, Plus, Save, Send, Trash2, Users } from "lucide-react";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase-browser";

type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
type Reminder = { id:string; title:string; subject:string; notes:string|null; starts_at:string; recurrence:Recurrence; recipient_emails:string[]; sender_email:string; active:boolean; completed_at:string|null };

const recurrenceLabels:Record<Recurrence,string>={none:"One time",daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Annually"};
const parseEmails=(value:string)=>Array.from(new Set(value.split(/[;,\n]/).map(email=>email.trim()).filter(Boolean)));
const reminderTimezone="America/Los_Angeles";

function localDateParts(isoDate:string){
  const date=toZonedTime(new Date(isoDate),reminderTimezone);
  return {
    date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`,
    time:`${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`,
  };
}

function formatReminderSchedule(reminder:Reminder){
  const date=new Date(reminder.starts_at);
  const day=date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:reminderTimezone});
  const time=date.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:reminderTimezone});
  if(reminder.recurrence==="none")return {main:`${day} at ${time}`,detail:"One-time email"};
  return {main:`${recurrenceLabels[reminder.recurrence]} at ${time}`,detail:`Starts ${day}`};
}

export default function RemindersPage(){
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [reminders,setReminders]=useState<Reminder[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [savingSettings,setSavingSettings]=useState(false);
  const [testingEmail,setTestingEmail]=useState(false);
  const [message,setMessage]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [showEmailSettings,setShowEmailSettings]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editingCompleted,setEditingCompleted]=useState(false);
  const [title,setTitle]=useState("");
  const [subject,setSubject]=useState("");
  const [notes,setNotes]=useState("");
  const [reminderDate,setReminderDate]=useState("");
  const [reminderTime,setReminderTime]=useState("09:00");
  const [recurrence,setRecurrence]=useState<Recurrence>("none");
  const [recipients,setRecipients]=useState("");
  const [primaryEmail,setPrimaryEmail]=useState("");
  const [complianceRecipients,setComplianceRecipients]=useState("");

  async function getUser(){
    for(let attempt=0;attempt<6;attempt+=1){
      const {data}=await supabase.auth.getSession();
      if(data.session?.user)return data.session.user;
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    return null;
  }

  async function load(){
    setLoading(true);
    const user=await getUser();
    if(!user){router.replace("/");return;}
    setPrimaryEmail(user.email??"");
    const [reminderResult,preferenceResult]=await Promise.all([
      supabase.from("family_reminders").select("id,title,subject,notes,starts_at,recurrence,recipient_emails,sender_email,active,completed_at").eq("user_id",user.id).order("starts_at",{ascending:true}),
      supabase.from("reminder_preferences").select("compliance_recipient_emails").eq("user_id",user.id).maybeSingle(),
    ]);
    if(reminderResult.error)setMessage(reminderResult.error.message);else setReminders((reminderResult.data??[]) as Reminder[]);
    if(preferenceResult.error)setMessage(preferenceResult.error.message);else setComplianceRecipients(((preferenceResult.data?.compliance_recipient_emails??[]) as string[]).join(", "));
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  function resetForm(){
    setEditingId(null);setEditingCompleted(false);setTitle("");setSubject("");setNotes("");setReminderDate("");setReminderTime("09:00");setRecurrence("none");setRecipients(primaryEmail);
  }

  function openAddForm(){resetForm();setMessage("");setShowForm(true);}
  function closeForm(){setShowForm(false);resetForm();}

  function openEditForm(reminder:Reminder){
    const parts=localDateParts(reminder.starts_at);
    setEditingId(reminder.id);setEditingCompleted(Boolean(reminder.completed_at));setTitle(reminder.title);setSubject(reminder.subject);setNotes(reminder.notes??"");setReminderDate(parts.date);setReminderTime(parts.time);setRecurrence(reminder.recurrence);setRecipients(reminder.recipient_emails.join(", "));setMessage("");setShowForm(true);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function saveRecipients(){
    setSavingSettings(true);
    const user=await getUser();
    if(!user){router.replace("/");return;}
    const extra=parseEmails(complianceRecipients).filter(email=>email.toLowerCase()!==(user.email??"").toLowerCase());
    const {error}=await supabase.from("reminder_preferences").upsert({user_id:user.id,email_enabled:true,reminder_days:[30,7,1],compliance_recipient_emails:extra,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    setMessage(error?error.message:"Email settings saved.");if(!error)setComplianceRecipients(extra.join(", "));setSavingSettings(false);
  }

  async function saveReminder(event:FormEvent){
    event.preventDefault();setSaving(true);
    const user=await getUser();
    if(!user){router.replace("/");return;}
    const scheduledDate=fromZonedTime(`${reminderDate}T${reminderTime}:00`,reminderTimezone);
    if(Number.isNaN(scheduledDate.getTime())){setMessage("Please choose a valid date and email time.");setSaving(false);return;}
    const emailRecipients=parseEmails(recipients);if(!emailRecipients.length&&user.email)emailRecipients.push(user.email);
    const schedule=scheduledDate.toISOString();
    const values={title:title.trim(),subject:subject.trim(),notes:notes.trim()||null,starts_at:schedule,next_send_at:schedule,recurrence,recipient_emails:emailRecipients,sender_email:user.email??"",active:true,completed_at:null,processing_started_at:null,last_error:null,send_failures:0,updated_at:new Date().toISOString()};
    const result=editingId
      ? await supabase.from("family_reminders").update(values).eq("id",editingId).eq("user_id",user.id).select("id").maybeSingle()
      : await supabase.from("family_reminders").insert({...values,user_id:user.id}).select("id").single();
    if(result.error)setMessage(result.error.message);
    else if(editingId&&!result.data)setMessage("That reminder could not be updated. Please refresh and try again.");
    else{const savedMessage=editingId?"Reminder updated.":"Reminder saved.";closeForm();setMessage(savedMessage);await load();}
    setSaving(false);
  }

  async function remove(id:string){
    if(!confirm("Delete this reminder?"))return;
    const user=await getUser();if(!user){router.replace("/");return;}
    const {error}=await supabase.from("family_reminders").delete().eq("id",id).eq("user_id",user.id);
    if(error)setMessage(error.message);else await load();
  }

  async function markComplete(reminder:Reminder){
    if(reminder.completed_at)return;
    const user=await getUser();if(!user){router.replace("/");return;}
    const completedAt=new Date().toISOString();
    const {error}=await supabase.from("family_reminders").update({completed_at:completedAt,active:false,updated_at:completedAt}).eq("id",reminder.id).eq("user_id",user.id);
    if(error)setMessage(error.message);else{setMessage(`${reminder.title} marked complete.`);await load();}
  }

  async function sendTestEmail(){
    setTestingEmail(true);setMessage("");const {data}=await supabase.auth.getSession();const token=data.session?.access_token;
    if(!token){setMessage("Your sign-in expired. Please sign in again.");setTestingEmail(false);return;}
    try{const response=await fetch("/api/reminders/test-email",{method:"POST",headers:{authorization:`Bearer ${token}`}});const result=await response.json();setMessage(result.ok?`Test email sent to ${primaryEmail}. Please check your inbox and spam folder.`:result.error||"The test email could not be sent.");}
    catch{setMessage("The test email could not be sent. Please try again.");}
    setTestingEmail(false);
  }

  const extras=parseEmails(complianceRecipients);
  return <main className="min-h-screen bg-[#f4f7fb] text-slate-950"><div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Reminders</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Family Reminders</h1><p className="mt-2 text-sm text-slate-500">Add, edit and complete reminders in one place.</p></div><button onClick={openAddForm} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17}/> Add reminder</button></header>
    {message?<div className="mt-5 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>:null}

    {showForm?<section className="mt-6 rounded-[28px] border-2 border-blue-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">{editingId?<Pencil size={18}/>:<Plus size={18}/>}</div><div><h2 className="text-lg font-semibold">{editingId?"Edit reminder":"Add reminder"}</h2><p className="mt-1 text-sm text-slate-500">Choose when the first email arrives and whether it repeats.</p></div></div>
      <form onSubmit={saveReminder} className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Reminder name" value={title} onChange={setTitle} required/><Field label="Email subject" value={subject} onChange={setSubject} required/>
        <label><span className="text-sm font-medium">How often?</span><select value={recurrence} onChange={event=>setRecurrence(event.target.value as Recurrence)} className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5"><option value="none">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Annually</option></select></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="text-sm font-medium">{recurrence==="none"?"Email date":"Start date"}</span><input required type="date" value={reminderDate} onChange={event=>setReminderDate(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-slate-300 px-3 py-2.5"/></label><label><span className="text-sm font-medium">Email time</span><input required type="time" value={reminderTime} onChange={event=>setReminderTime(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-slate-300 px-3 py-2.5"/></label></div>
        <div className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"><Clock3 size={18} className="mt-0.5 shrink-0 text-blue-700"/><p>{recurrence==="none"?"This reminder is scheduled for the date and time you choose.":`The first reminder starts on this date, then repeats ${recurrenceLabels[recurrence].toLowerCase()} at the same time.`} Times use Pacific time.</p></div>
        <label className="md:col-span-2"><span className="text-sm font-medium">Email recipients</span><textarea rows={2} value={recipients} onChange={event=>setRecipients(event.target.value)} placeholder={primaryEmail||"family@example.com"} className="mt-2 w-full rounded-xl border-2 border-slate-300 px-3 py-2.5"/><span className="mt-1 block text-xs text-slate-500">Your email is added automatically. Separate additional emails with commas.</span></label>
        <label className="md:col-span-2"><span className="text-sm font-medium">Message</span><textarea rows={3} value={notes} onChange={event=>setNotes(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-slate-300 px-3 py-2.5"/></label>
        {editingCompleted?<p className="md:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Saving changes will reactivate this completed reminder.</p>:null}
        <div className="md:col-span-2 flex justify-end gap-3"><button type="button" onClick={closeForm} className="rounded-xl border-2 border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving?"Saving...":editingId?"Save changes":"Save reminder"}</button></div>
      </form>
    </section>:null}

    <section className="mt-6 overflow-hidden rounded-[28px] border-2 border-blue-200 bg-white"><div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/70 px-5 py-4 sm:px-6"><div><h2 className="font-semibold">Reminders</h2><p className="mt-1 text-sm text-slate-500">Upcoming and completed family reminders.</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><CalendarDays size={19}/></div></div>
      {loading?<p className="px-6 py-8 text-sm text-slate-500">Loading reminders...</p>:reminders.length===0?<div className="px-6 py-10 text-center"><CalendarDays className="mx-auto text-slate-400" size={30}/><p className="mt-3 font-semibold">No reminders yet</p><p className="mt-1 text-sm text-slate-500">Use Add reminder whenever you want the family notified.</p></div>:<div className="divide-y divide-slate-100">{reminders.map(reminder=>{const schedule=formatReminderSchedule(reminder);return <div key={reminder.id} className={`grid gap-4 px-5 py-4 sm:px-6 md:grid-cols-[1.2fr_.8fr_1fr_auto] md:items-center ${reminder.completed_at?"bg-emerald-50/40":""}`}><div><p className="font-semibold">{reminder.title}</p><p className="mt-1 text-sm text-slate-500">{reminder.subject}</p>{reminder.notes?<p className="mt-1 line-clamp-2 text-xs text-slate-400">{reminder.notes}</p>:null}{reminder.completed_at?<p className="mt-1 text-xs font-medium text-emerald-700">Completed {new Date(reminder.completed_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</p>:null}</div><div><p className="text-xs uppercase tracking-wide text-slate-400">Schedule</p><p className="mt-1 text-sm font-semibold">{schedule.main}</p><p className="mt-1 text-xs text-slate-500">{schedule.detail}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-400">Email to</p><p className="mt-1 text-sm text-slate-700">{reminder.recipient_emails.length?reminder.recipient_emails.join(", "):"Primary account"}</p></div><div className="flex flex-wrap gap-2 md:justify-end"><button onClick={()=>openEditForm(reminder)} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil size={14}/> Edit</button><button onClick={()=>markComplete(reminder)} disabled={Boolean(reminder.completed_at)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${reminder.completed_at?"bg-emerald-100 text-emerald-700":"bg-emerald-600 text-white"}`}><CheckCircle2 size={14}/>{reminder.completed_at?"Completed":"Mark Complete"}</button><button onClick={()=>remove(reminder.id)} aria-label={`Delete ${reminder.title}`} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-red-200 hover:text-red-600"><Trash2 size={16}/></button></div></div>;})}</div>}
    </section>

    <section className="mt-6 rounded-[28px] border-2 border-slate-300 bg-white"><button onClick={()=>setShowEmailSettings(visible=>!visible)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Mail size={18}/></div><div><h2 className="font-semibold">Email Settings</h2><p className="mt-1 text-sm text-slate-500">Compliance reminders send 30, 7 and 1 day before due dates.</p></div></div><ChevronDown size={19} className={`transition ${showEmailSettings?"rotate-180":""}`}/></button>
      {showEmailSettings?<div className="border-t-2 border-slate-200 px-5 py-5 sm:px-6"><div className="flex flex-wrap gap-2">{primaryEmail?<span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Primary · {primaryEmail}</span>:null}{extras.map(email=><span key={email} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{email}</span>)}</div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><label><span className="text-sm font-medium">Additional compliance recipients</span><textarea rows={2} value={complianceRecipients} onChange={event=>setComplianceRecipients(event.target.value)} placeholder="spouse@example.com, accountant@example.com" className="mt-2 w-full rounded-xl border-2 border-slate-300 px-3 py-2.5"/></label><button onClick={saveRecipients} disabled={savingSettings} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white"><Save size={16}/>{savingSettings?"Saving...":"Save settings"}</button></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4"><div><p className="text-sm font-semibold text-blue-950">Check email delivery</p><p className="mt-1 text-xs text-blue-800">Sends one clearly labeled test to your primary account.</p></div><button onClick={sendTestEmail} disabled={testingEmail||!primaryEmail} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Send size={15}/>{testingEmail?"Sending...":"Send Test Email"}</button></div><div className="mt-4 flex gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Users size={18} className="mt-0.5 shrink-0"/><p>Your main account always receives compliance emails. Marking an item paid or completed stops future reminders for that item.</p></div></div>:null}
    </section>
  </div></main>;
}

function Field({label,value,onChange,required}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean}){
  return <label><span className="text-sm font-medium">{label}</span><input required={required} value={value} onChange={event=>onChange(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-slate-300 px-3 py-2.5"/></label>;
}
