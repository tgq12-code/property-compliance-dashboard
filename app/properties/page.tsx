"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Home,
  Landmark,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
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
  name: "",
  street_address: "",
  city: "",
  state: "CA",
  zip: "",
  county: "",
  apn: "",
  tax_collector_name: "",
  tax_payment_url: "",
  annual_property_tax: "",
  escrowed: false,
  notes: "",
};

const money = (n: number | null) =>
  n == null
    ? "Not confirmed"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function officialTaxAuthority(state: string, county: string) {
  const s = state.trim().toUpperCase();
  const c = county.trim().toLowerCase().replace(/ county$/, "");
  if (s === "CA" && c === "san diego")
    return { name: "San Diego County Treasurer-Tax Collector", url: "https://www.sdttc.com/" };
  if (s === "CA" && c === "alameda")
    return { name: "Alameda County Treasurer-Tax Collector", url: "https://propertytax.alamedacountyca.gov/search" };
  if (s === "FL" && c === "palm beach")
    return { name: "Constitutional Tax Collector, Serving Palm Beach County", url: "https://pbctax.publicaccessnow.com/PropertyTax.aspx" };
  if (s === "IN" && c === "tippecanoe")
    return { name: "Tippecanoe County Treasurer", url: "https://tippecanoe.in.gov/511/Property-Tax-Payments" };
  if (s === "HI" && c === "honolulu")
    return { name: "City and County of Honolulu - Real Property Tax Collection", url: "https://pay.ehawaii.gov/hnl#!/search/11" };
  return null;
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

function getTaxSchedule(p: PropertyRecord): TaxSchedule | null {
  const s = (p.state ?? "").toUpperCase();
  const c = (p.county ?? "").toLowerCase().replace(/ county$/, "");
  const now = new Date();
  const y = now.getFullYear();

  if (s === "CA" && (c === "san diego" || c === "alameda")) {
    const start = now > new Date(y, 3, 10, 23, 59, 59) ? y : y - 1;
    return {
      frequency: "2 installments",
      cycle: `${start}-${String(start + 1).slice(-2)}`,
      dueDates: [`Nov 1, ${start}`, `Feb 1, ${start + 1}`],
      note: "1st installment becomes delinquent after Dec 10; 2nd after Apr 10.",
    };
  }

  if (s === "HI" && c === "honolulu") {
    const start = now > new Date(y, 1, 20, 23, 59, 59) ? y : y - 1;
    return {
      frequency: "2 equal installments",
      cycle: `${start}-${String(start + 1).slice(-2)}`,
      dueDates: [`Aug 20, ${start}`, `Feb 20, ${start + 1}`],
      installmentAmount: p.annual_property_tax == null ? undefined : money(Number(p.annual_property_tax) / 2),
      note: `1st installment covers Jul 1-${start} through Dec 31-${start}. 2nd installment covers Jan 1-${start + 1} through Jun 30-${start + 1}.`,
    };
  }

  if (s === "IN" && c === "tippecanoe") {
    const taxYear = now > (y === 2026 ? new Date(2026, 10, 10) : shiftWeekendToMonday(new Date(y, 10, 10))) ? y + 1 : y;
    const spring = taxYear === 2026 ? new Date(2026, 4, 11) : shiftWeekendToMonday(new Date(taxYear, 4, 10));
    const fall = taxYear === 2026 ? new Date(2026, 10, 10) : shiftWeekendToMonday(new Date(taxYear, 10, 10));
    return {
      frequency: "2 installments",
      cycle: String(taxYear),
      dueDates: [fmt(spring), fmt(fall)],
      note: "Spring and fall installments.",
    };
  }

  if (s === "FL" && c === "palm beach") {
    const taxYear = now <= new Date(y, 2, 31, 23, 59, 59) ? y - 1 : y;
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  async function getUser() {
    for (let i = 0; i < 6; i += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }

  async function load() {
    setLoading(true);
    const user = await getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    const { data, error } = await supabase
      .from("properties")
      .select("id,name,street_address,city,state,zip,county,apn,tax_collector_name,tax_payment_url,annual_property_tax,property_tax_year,property_tax_status,escrowed,notes")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setProperties((data ?? []) as PropertyRecord[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function openAdd() {
    setEditingId(null);
    setForm(blankForm);
    setShowForm(true);
    setMessage("");
  }

  function edit(p: PropertyRecord) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      street_address: p.street_address,
      city: p.city ?? "",
      state: p.state ?? "CA",
      zip: p.zip ?? "",
      county: p.county ?? "",
      apn: p.apn ?? "",
      tax_collector_name: p.tax_collector_name ?? "",
      tax_payment_url: p.tax_payment_url ?? "",
      annual_property_tax: p.annual_property_tax == null ? "" : String(p.annual_property_tax),
      escrowed: p.escrowed,
      notes: p.notes ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const user = await getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    const annual = form.annual_property_tax.trim() ? Number(form.annual_property_tax) : null;
    const authority = officialTaxAuthority(form.state, form.county);
    const payload = {
      name: form.name.trim(),
      street_address: form.street_address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      county: form.county.trim() || null,
      apn: form.apn.trim() || null,
      tax_collector_name: authority?.name ?? (form.tax_collector_name.trim() || null),
      tax_payment_url: authority?.url ?? (form.tax_payment_url.trim() || null),
      annual_property_tax: Number.isFinite(annual) ? annual : null,
      escrowed: form.escrowed,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await supabase.from("properties").update(payload).eq("id", editingId)
      : await supabase.from("properties").insert({ user_id: user.id, ...payload });
    if (error) setMessage(error.message);
    else {
      setShowForm(false);
      setEditingId(null);
      setForm(blankForm);
      setMessage("Property saved.");
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this property?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const filters = ["All", "You Pay", "Escrowed", "California", "Hawaii", "Florida", "Indiana"];
  const filtered = properties.filter((p) => {
    const q = search.toLowerCase();
    const text = [p.name, p.street_address, p.city, p.state, p.county, p.zip].filter(Boolean).join(" ").toLowerCase();
    if (q && !text.includes(q)) return false;
    if (filter === "You Pay") return !p.escrowed;
    if (filter === "Escrowed") return p.escrowed;
    if (filter === "California") return p.state?.toUpperCase() === "CA";
    if (filter === "Hawaii") return p.state?.toUpperCase() === "HI";
    if (filter === "Florida") return p.state?.toUpperCase() === "FL";
    if (filter === "Indiana") return p.state?.toUpperCase() === "IN";
    return true;
  });

  const directPay = filtered.filter((p) => !p.escrowed);
  const escrowed = filtered.filter((p) => p.escrowed);

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <Sidebar active="properties" signOut={signOut} />

        <section className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Family assets</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Properties & Taxes</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Payment responsibilities come first. Escrowed properties are separated below so the page is easier to scan.
              </p>
            </div>
            <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
              <Plus size={17} /> Add property
            </button>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
            <ShieldCheck className="mt-0.5 shrink-0" size={18} />
            <p><span className="font-semibold">Private workspace.</span> Parcel numbers and internal notes are kept out of the overview cards and only appear when you edit a property.</p>
          </div>

          {message && <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>}

          {showForm && (
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold">{editingId ? "Edit property" : "Add property"}</h2>
                <p className="mt-1 text-sm text-slate-500">Sensitive details stay inside this edit view instead of the main property cards.</p>
              </div>
              <form onSubmit={save} className="mt-6 grid gap-5 md:grid-cols-2">
                <Field label="Property name" required value={form.name} onChange={(v) => updateField("name", v)} />
                <Field label="Street address" required value={form.street_address} onChange={(v) => updateField("street_address", v)} />
                <Field label="City" value={form.city} onChange={(v) => updateField("city", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State" value={form.state} onChange={(v) => updateField("state", v)} />
                  <Field label="ZIP" value={form.zip} onChange={(v) => updateField("zip", v)} />
                </div>
                <Field label="County" value={form.county} onChange={(v) => updateField("county", v)} />
                <Field label="APN / Parcel number" value={form.apn} onChange={(v) => updateField("apn", v)} />
                <Field label="Tax collector" value={form.tax_collector_name} onChange={(v) => updateField("tax_collector_name", v)} />
                <Field label="Official tax payment URL" type="url" value={form.tax_payment_url} onChange={(v) => updateField("tax_payment_url", v)} />
                <Field label="Annual tax total" type="number" step="0.01" value={form.annual_property_tax} onChange={(v) => updateField("annual_property_tax", v)} />
                <label className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${form.escrowed ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                  <input type="checkbox" checked={form.escrowed} onChange={(e) => updateField("escrowed", e.target.checked)} />
                  <span>
                    <span className="block text-sm font-medium">Impounded / escrowed</span>
                    <span className="block text-xs text-slate-500">Lender pays the property taxes.</span>
                  </span>
                </label>
                <label className="md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Private notes</span>
                  <textarea rows={3} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm">Cancel</button>
                  <button disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">{saving ? "Saving..." : "Save property"}</button>
                </div>
              </form>
            </section>
          )}

          <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search properties, addresses, counties..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white" />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-2 text-xs font-medium transition ${filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{f}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Loading properties...</p>
          ) : (
            <div className="mt-7 space-y-10">
              {filter !== "Escrowed" && (
                <PropertySection
                  title="You Pay"
                  subtitle="Action first — these are the properties where you are responsible for the tax payment."
                  count={directPay.length}
                  tone="blue"
                  properties={directPay}
                  onEdit={edit}
                  onDelete={remove}
                />
              )}

              {filter !== "You Pay" && (
                <PropertySection
                  title="Impounded · Lender Pays"
                  subtitle="Reference only — your lender handles these tax payments through escrow."
                  count={escrowed.length}
                  tone="green"
                  properties={escrowed}
                  onEdit={edit}
                  onDelete={remove}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PropertySection({ title, subtitle, count, tone, properties, onEdit, onDelete }: {
  title: string;
  subtitle: string;
  count: number;
  tone: "blue" | "green";
  properties: PropertyRecord[];
  onEdit: (p: PropertyRecord) => void;
  onDelete: (id: string) => void;
}) {
  const accent = tone === "blue" ? "bg-blue-600" : "bg-emerald-500";
  const soft = tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${accent}`} />
            <h2 className="text-xl font-semibold">{title}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${soft}`}>{count}</span>
          </div>
          <p className="mt-1 pl-6 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No properties in this section.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

function PropertyCard({ property: p, onEdit, onDelete }: { property: PropertyRecord; onEdit: (p: PropertyRecord) => void; onDelete: (id: string) => void }) {
  const schedule = getTaxSchedule(p);
  const needs = p.property_tax_status === "needs_confirmation";
  const badge = p.escrowed ? "Impounded · lender pays" : "You pay";

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${p.escrowed ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
              <Home size={21} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.escrowed ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{badge}</span>
                {needs && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs confirmation</span>}
              </div>
              <p className="mt-1 text-sm text-slate-500">{[p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p>
              <p className="mt-1 text-xs text-slate-400">{p.county ? `${p.county} County` : "County not entered"}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => onEdit(p)} aria-label="Edit property" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Pencil size={15} /></button>
            <button onClick={() => onDelete(p.id)} aria-label="Delete property" className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric icon={<WalletCards size={16} />} label="Tax total" value={money(p.annual_property_tax)} />
          <Metric icon={<CalendarDays size={16} />} label="Tax year" value={p.property_tax_year ?? schedule?.cycle ?? "Not confirmed"} />
          <Metric icon={<Landmark size={16} />} label="Payment schedule" value={schedule?.frequency ?? "Not confirmed"} />
        </div>

        {schedule && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Due dates</p>
              {schedule.installmentAmount && <p className="text-xs font-semibold text-slate-600">Approx. {schedule.installmentAmount} each</p>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {schedule.dueDates.map((date) => <span key={date} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">{date}</span>)}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{schedule.note}</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{p.tax_collector_name ?? "Official county tax authority"}</span>
            <span className="ml-2">· Sensitive parcel details hidden</span>
          </div>
          {p.tax_payment_url ? (
            <a href={p.tax_payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              Open Official Tax Site <ExternalLink size={15} />
            </a>
          ) : (
            <button disabled className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500">Official tax site unavailable</button>
          )}
        </div>
      </div>
    </article>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Sidebar({ active, signOut }: { active: string; signOut: () => void }) {
  const nav = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: Home },
    { key: "properties", href: "/properties", label: "Properties & Taxes", icon: Landmark },
    { key: "businesses", href: "/businesses", label: "Business Compliance", icon: Building2 },
    { key: "reminders", href: "/reminders", label: "Family Reminders", icon: CalendarDays },
  ];
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 lg:flex lg:flex-col">
      <Link href="/dashboard" className="rounded-2xl px-3 py-2 hover:bg-slate-50">
        <p className="text-sm font-semibold text-blue-600">Vo Family Operations</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-950">Family Dashboard</p>
      </Link>
      <nav className="mt-7 space-y-1">
        {nav.map(({ key, href, label, icon: Icon }) => (
          <Link key={key} href={href} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${active === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
        <div className="flex items-center gap-2 font-semibold text-slate-700"><ShieldCheck size={16} className="text-blue-600" /> Private family workspace</div>
        <p className="mt-2">Only authenticated users can access property and compliance data.</p>
      </div>
      <button onClick={signOut} className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={17} /> Sign out</button>
    </aside>
  );
}

function Field({ label, value, onChange, type = "text", step, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string; required?: boolean }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type={type} step={step} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}
