"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Home, LogOut, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type PropertyRecord = {
  id: string;
  name: string;
  street_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  apn: string | null;
  tax_collector_name: string | null;
  tax_payment_url: string | null;
  annual_property_tax: number | null;
  property_tax_year: string | null;
  property_tax_status: string | null;
  escrowed: boolean;
  notes: string | null;
};

type FormState = {
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  apn: string;
  tax_collector_name: string;
  tax_payment_url: string;
  annual_property_tax: string;
  escrowed: boolean;
  notes: string;
};

type TaxSchedule = {
  frequency: string;
  cycle: string;
  dueDates: string[];
  note: string;
  installmentAmount?: string;
};

const blankForm: FormState = {
  name: "", street_address: "", city: "", state: "CA", zip: "", county: "", apn: "",
  tax_collector_name: "", tax_payment_url: "", annual_property_tax: "", escrowed: false, notes: "",
};

function officialTaxAuthority(state: string, county: string) {
  const s = state.trim().toUpperCase();
  const c = county.trim().toLowerCase().replace(/ county$/, "");
  if (s === "CA" && c === "san diego") return { name: "San Diego County Treasurer-Tax Collector", url: "https://www.sdttc.com/" };
  if (s === "CA" && c === "alameda") return { name: "Alameda County Treasurer-Tax Collector", url: "https://propertytax.alamedacountyca.gov/search" };
  if (s === "FL" && c === "palm beach") return { name: "Constitutional Tax Collector, Serving Palm Beach County", url: "https://pbctax.publicaccessnow.com/PropertyTax.aspx" };
  if (s === "IN" && c === "tippecanoe") return { name: "Tippecanoe County Treasurer", url: "https://tippecanoe.in.gov/511/Property-Tax-Payments" };
  if (s === "HI" && c === "honolulu") return { name: "City and County of Honolulu - Real Property Tax Collection", url: "https://pay.ehawaii.gov/hnl#!/search/11" };
  return null;
}

function money(amount: number | null) {
  return amount == null ? null : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function shiftWeekendToMonday(date: Date) {
  const d = new Date(date);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getTaxSchedule(property: PropertyRecord): TaxSchedule | null {
  const s = (property.state ?? "").trim().toUpperCase();
  const c = (property.county ?? "").trim().toLowerCase().replace(/ county$/, "");
  const now = new Date();
  const y = now.getFullYear();

  if (s === "CA" && (c === "san diego" || c === "alameda")) {
    const apr10 = new Date(y, 3, 10, 23, 59, 59);
    const start = now > apr10 ? y : y - 1;
    return {
      frequency: "2 installments",
      cycle: `${start}-${String(start + 1).slice(-2)}`,
      dueDates: [`Nov 1, ${start}`, `Feb 1, ${start + 1}`],
      note: "1st installment becomes delinquent after Dec 10; 2nd becomes delinquent after Apr 10.",
    };
  }

  if (s === "HI" && c === "honolulu") {
    const feb20 = new Date(y, 1, 20, 23, 59, 59);
    const start = now > feb20 ? y : y - 1;
    const half = property.annual_property_tax == null ? undefined : money(Number(property.annual_property_tax) / 2) ?? undefined;
    return {
      frequency: "2 equal installments",
      cycle: `${start}-${String(start + 1).slice(-2)}`,
      dueDates: [`Aug 20, ${start}`, `Feb 20, ${start + 1}`],
      installmentAmount: half,
      note: `1st installment covers Jul 1-${start} through Dec 31-${start}. 2nd installment covers Jan 1-${start + 1} through Jun 30-${start + 1}.`,
    };
  }

  if (s === "IN" && c === "tippecanoe") {
    const fallThisYear = y === 2026 ? new Date(2026, 10, 10) : shiftWeekendToMonday(new Date(y, 10, 10));
    const taxYear = now > fallThisYear ? y + 1 : y;
    const spring = taxYear === 2026 ? new Date(2026, 4, 11) : shiftWeekendToMonday(new Date(taxYear, 4, 10));
    const fall = taxYear === 2026 ? new Date(2026, 10, 10) : shiftWeekendToMonday(new Date(taxYear, 10, 10));
    return { frequency: "2 installments", cycle: String(taxYear), dueDates: [fmt(spring), fmt(fall)], note: "Spring and fall installments." };
  }

  if (s === "FL" && c === "palm beach") {
    const mar31 = new Date(y, 2, 31, 23, 59, 59);
    const taxYear = now <= mar31 ? y - 1 : y;
    return {
      frequency: "Annual (standard plan)",
      cycle: String(taxYear),
      dueDates: [`Mar 31, ${taxYear + 1}`],
      note: `Payable beginning Nov 1, ${taxYear}; early-payment discounts apply Nov-Feb. Delinquent Apr 1, ${taxYear + 1}.`,
    };
  }
  return null;
}

export default function PropertiesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function getActiveUser() {
    for (let i = 0; i < 6; i += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user;
      await new Promise((r) => window.setTimeout(r, 150));
    }
    return null;
  }

  async function loadProperties() {
    setLoading(true);
    const user = await getActiveUser();
    if (!user) { router.replace("/"); return; }
    const { data, error } = await supabase.from("properties").select("id,name,street_address,city,state,zip,county,apn,tax_collector_name,tax_payment_url,annual_property_tax,property_tax_year,property_tax_status,escrowed,notes").order("created_at", { ascending: false });
    if (error) setMessage(error.message); else setProperties((data ?? []) as PropertyRecord[]);
    setLoading(false);
  }

  useEffect(() => { loadProperties(); }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((f) => ({ ...f, [key]: value })); }
  function openAddForm() { setEditingId(null); setForm(blankForm); setShowForm(true); setMessage(""); }
  function cancelForm() { setShowForm(false); setEditingId(null); setForm(blankForm); }
  function startEdit(p: PropertyRecord) {
    setEditingId(p.id);
    setForm({ name: p.name, street_address: p.street_address, city: p.city ?? "", state: p.state ?? "CA", zip: p.zip ?? "", county: p.county ?? "", apn: p.apn ?? "", tax_collector_name: p.tax_collector_name ?? "", tax_payment_url: p.tax_payment_url ?? "", annual_property_tax: p.annual_property_tax == null ? "" : String(p.annual_property_tax), escrowed: p.escrowed, notes: p.notes ?? "" });
    setShowForm(true); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProperty(e: FormEvent) {
    e.preventDefault(); setSaving(true); setMessage("");
    const user = await getActiveUser(); if (!user) { router.replace("/"); return; }
    const annual = form.annual_property_tax.trim() ? Number(form.annual_property_tax) : null;
    const authority = officialTaxAuthority(form.state, form.county);
    const payload = { name: form.name.trim(), street_address: form.street_address.trim(), city: form.city.trim() || null, state: form.state.trim() || null, zip: form.zip.trim() || null, county: form.county.trim() || null, apn: form.apn.trim() || null, tax_collector_name: authority?.name ?? (form.tax_collector_name.trim() || null), tax_payment_url: authority?.url ?? (form.tax_payment_url.trim() || null), annual_property_tax: Number.isFinite(annual) ? annual : null, escrowed: form.escrowed, notes: form.notes.trim() || null, updated_at: new Date().toISOString() };
    const { error } = editingId ? await supabase.from("properties").update(payload).eq("id", editingId) : await supabase.from("properties").insert({ user_id: user.id, ...payload });
    if (error) setMessage(error.message); else { cancelForm(); setMessage(editingId ? "Property updated." : "Property saved."); await loadProperties(); }
    setSaving(false);
  }

  async function deleteProperty(id: string) { if (!window.confirm("Delete this property?")) return; const { error } = await supabase.from("properties").delete().eq("id", id); if (error) setMessage(error.message); else await loadProperties(); }
  async function signOut() { await supabase.auth.signOut(); router.replace("/"); }

  return <main className="min-h-screen bg-gray-50">
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><div><Link href="/dashboard" className="block hover:opacity-80"><p className="text-sm font-medium text-gray-500">Vo Family Operations</p><h1 className="text-2xl font-semibold text-gray-950">Family Dashboard</h1></Link><p className="mt-1 text-sm text-gray-500">Properties & Taxes</p></div><div className="flex items-center gap-3"><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700"><LogOut size={16}/> Sign out</button><button onClick={openAddForm} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white"><Plus size={16}/> Add property</button></div></div></header>
    <div className="mx-auto max-w-7xl px-6 py-8">
      {message && <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}
      {showForm && <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">{editingId ? "Edit property" : "Add property"}</h2><form onSubmit={saveProperty} className="mt-5 grid gap-5 md:grid-cols-2"><Field label="Property name" required value={form.name} onChange={(v)=>updateField("name",v)}/><Field label="Street address" required value={form.street_address} onChange={(v)=>updateField("street_address",v)}/><Field label="City" value={form.city} onChange={(v)=>updateField("city",v)}/><div className="grid grid-cols-2 gap-3"><Field label="State" value={form.state} onChange={(v)=>updateField("state",v)}/><Field label="ZIP" value={form.zip} onChange={(v)=>updateField("zip",v)}/></div><Field label="County" value={form.county} onChange={(v)=>updateField("county",v)}/><Field label="APN / Parcel number" value={form.apn} onChange={(v)=>updateField("apn",v)}/><Field label="Tax collector" value={form.tax_collector_name} onChange={(v)=>updateField("tax_collector_name",v)}/><Field label="Official tax payment URL" type="url" value={form.tax_payment_url} onChange={(v)=>updateField("tax_payment_url",v)}/><Field label="Annual tax total (full bill)" type="number" step="0.01" value={form.annual_property_tax} onChange={(v)=>updateField("annual_property_tax",v)}/><label className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${form.escrowed?"border-emerald-200 bg-emerald-50":"border-gray-200"}`}><input type="checkbox" checked={form.escrowed} onChange={(e)=>updateField("escrowed",e.target.checked)}/><span><span className="block text-sm font-medium">Property taxes are impounded / escrowed</span><span className="block text-xs text-gray-500">The lender pays the property taxes.</span></span></label>{form.escrowed && <div className="md:col-span-2 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><ShieldCheck size={18}/> Impounded property. Tax schedule is shown for reference only.</div>}<label className="md:col-span-2"><span className="text-sm font-medium text-gray-700">Notes</span><textarea rows={3} value={form.notes} onChange={(e)=>updateField("notes",e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5"/></label><div className="md:col-span-2 flex justify-end gap-3"><button type="button" onClick={cancelForm} className="rounded-xl border px-4 py-2.5 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm text-white">{saving?"Saving...":editingId?"Save changes":"Save property"}</button></div></form></section>}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-6 py-5"><h2 className="font-semibold">Your properties</h2><p className="mt-1 text-sm text-gray-500">Tax totals, county schedules, due dates, and official payment sites.</p></div>{loading?<p className="px-6 py-8 text-sm text-gray-500">Loading properties...</p>:<div className="divide-y divide-gray-100">{properties.map((p)=>{const schedule=getTaxSchedule(p);return <div key={p.id} className="grid gap-5 px-6 py-5 md:grid-cols-[1.2fr_0.8fr_1.2fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.name}</p>{p.escrowed?<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Impounded · lender pays</span>:<span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">You pay</span>}{p.property_tax_status==="needs_confirmation"&&<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">Needs confirmation</span>}</div><p className="mt-1 text-sm text-gray-500">{[p.street_address,p.city,p.state,p.zip].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-gray-400">{p.county?`${p.county} County`:"County not entered"}{p.apn?` · APN: ${p.apn}`:""}</p></div><div><p className="text-xs uppercase tracking-wide text-gray-400">Tax total</p><p className="mt-1 text-sm font-semibold">{money(p.annual_property_tax)??"Not confirmed"}</p><p className="mt-1 text-xs text-gray-500">{p.property_tax_year?`Tax year ${p.property_tax_year}`:"Tax year not recorded"}</p></div><div><p className="text-xs uppercase tracking-wide text-gray-400">Payment schedule</p>{schedule?<><p className="mt-1 text-sm font-semibold">{schedule.frequency} · {schedule.cycle}</p><p className="mt-1 text-sm text-gray-700">Due: {schedule.dueDates.join(" · ")}</p>{schedule.installmentAmount&&<p className="mt-1 text-sm font-medium text-sky-800">Each installment: {schedule.installmentAmount}</p>}<p className="mt-1 text-xs leading-relaxed text-gray-500">{schedule.note}</p></>:<p className="mt-1 text-sm font-medium text-amber-700">Schedule needs confirmation</p>}</div><div className="flex items-center gap-2 md:justify-end">{p.tax_payment_url&&<a href={p.tax_payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm">{p.escrowed?"View tax site":"Pay site"}<ExternalLink size={14}/></a>}<button onClick={()=>startEdit(p)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Pencil size={14}/> Edit</button><button onClick={()=>deleteProperty(p.id)} className="rounded-lg border p-2 text-gray-500"><Trash2 size={16}/></button></div></div>})}</div>}</section>
    </div>
  </main>;
}

function Field({label,value,onChange,required,type="text",step}:{label:string;value:string;onChange:(v:string)=>void;required?:boolean;type?:string;step?:string}){return <label><span className="text-sm font-medium text-gray-700">{label}</span><input required={required} type={type} step={step} value={value} onChange={(e)=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5"/></label>}
