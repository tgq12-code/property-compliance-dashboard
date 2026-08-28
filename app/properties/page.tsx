"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Home,
  Landmark,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
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
  property_tax_source: string | null;
  property_tax_status: string | null;
  tax_lookup_checked_at: string | null;
  escrowed: boolean;
  notes: string | null;
  estimated_market_value: number | null;
  market_value_source: string | null;
  market_value_source_url: string | null;
  market_value_checked_at: string | null;
  market_value_status: string | null;
  mortgage_servicer: string | null;
  mortgage_balance: number | null;
  mortgage_monthly_payment: number | null;
  mortgage_interest_rate: number | null;
  mortgage_statement_date: string | null;
  mortgage_payment_due_date: string | null;
  insurance_carrier: string | null;
  insurance_annual_premium: number | null;
  insurance_policy_start_date: string | null;
  insurance_policy_expiration_date: string | null;
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
  estimated_market_value: string;
  property_tax_year: string;
  value_source: string;
  escrowed: boolean;
  mortgage_servicer: string;
  mortgage_balance: string;
  mortgage_monthly_payment: string;
  mortgage_interest_rate: string;
  mortgage_statement_date: string;
  mortgage_payment_due_date: string;
  insurance_carrier: string;
  insurance_annual_premium: string;
  insurance_policy_start_date: string;
  insurance_policy_expiration_date: string;
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
  estimated_market_value: "",
  property_tax_year: "",
  value_source: "Zillow",
  escrowed: false,
  mortgage_servicer: "",
  mortgage_balance: "",
  mortgage_monthly_payment: "",
  mortgage_interest_rate: "",
  mortgage_statement_date: "",
  mortgage_payment_due_date: "",
  insurance_carrier: "",
  insurance_annual_premium: "",
  insurance_policy_start_date: "",
  insurance_policy_expiration_date: "",
  notes: "",
};

const money = (n: number | null) =>
  n == null
    ? "Not entered"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

const preciseMoney = (n: number | null) =>
  n == null
    ? "Not entered"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(n));

const formatDate = (date: string | null) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not entered";

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    return { frequency: "2 installments", cycle: String(taxYear), dueDates: [fmt(spring), fmt(fall)], note: "Spring and fall installments." };
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

function getNextDue(schedule: TaxSchedule | null) {
  if (!schedule) return "Not entered";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dated = schedule.dueDates
    .map((label) => ({ label, date: new Date(`${label} 12:00:00`) }))
    .filter((item) => !Number.isNaN(item.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = dated.find((item) => item.date >= today);
  return next?.label ?? dated.at(-1)?.label ?? schedule.dueDates[0] ?? "Not entered";
}

function zillowLookupUrl(address: string) {
  const slug = address.trim().replace(/[\s,]+/g, "-");
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}

function redfinLookupUrl(address: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:redfin.com ${address}`)}`;
}

function countyLookupUrl(address: string, state: string, county: string, taxUrl?: string | null) {
  if (taxUrl) return taxUrl;
  const authority = officialTaxAuthority(state, county);
  if (authority?.url) return authority.url;
  return `https://www.google.com/search?q=${encodeURIComponent(`${county} County ${state} official property tax lookup ${address}`)}`;
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
      .select("id,name,street_address,city,state,zip,county,apn,tax_collector_name,tax_payment_url,annual_property_tax,property_tax_year,property_tax_source,property_tax_status,tax_lookup_checked_at,escrowed,notes,estimated_market_value,market_value_source,market_value_source_url,market_value_checked_at,market_value_status,mortgage_servicer,mortgage_balance,mortgage_monthly_payment,mortgage_interest_rate,mortgage_statement_date,mortgage_payment_due_date,insurance_carrier,insurance_annual_premium,insurance_policy_start_date,insurance_policy_expiration_date")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setProperties((data ?? []) as PropertyRecord[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

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
      estimated_market_value: p.estimated_market_value == null ? "" : String(p.estimated_market_value),
      property_tax_year: p.property_tax_year ?? "",
      value_source: p.market_value_source?.toLowerCase().includes("redfin") ? "Redfin" : p.market_value_source?.toLowerCase().includes("other") ? "Other" : "Zillow",
      escrowed: p.escrowed,
      mortgage_servicer: p.mortgage_servicer ?? "",
      mortgage_balance: p.mortgage_balance == null ? "" : String(p.mortgage_balance),
      mortgage_monthly_payment: p.mortgage_monthly_payment == null ? "" : String(p.mortgage_monthly_payment),
      mortgage_interest_rate: p.mortgage_interest_rate == null ? "" : String(p.mortgage_interest_rate),
      mortgage_statement_date: p.mortgage_statement_date ?? "",
      mortgage_payment_due_date: p.mortgage_payment_due_date ?? "",
      insurance_carrier: p.insurance_carrier ?? "",
      insurance_annual_premium: p.insurance_annual_premium == null ? "" : String(p.insurance_annual_premium),
      insurance_policy_start_date: p.insurance_policy_start_date ?? "",
      insurance_policy_expiration_date: p.insurance_policy_expiration_date ?? "",
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
    const estimated = form.estimated_market_value.trim() ? Number(form.estimated_market_value) : null;
    const address = [form.street_address, form.city, form.state, form.zip].filter(Boolean).join(", ");
    const valueSourceUrl = form.value_source === "Redfin" ? redfinLookupUrl(address) : form.value_source === "Zillow" ? zillowLookupUrl(address) : null;
    const checkedAt = new Date().toISOString();
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
      property_tax_year: form.property_tax_year.trim() || null,
      property_tax_source: Number.isFinite(annual) ? "County records (manually entered)" : null,
      property_tax_status: Number.isFinite(annual) ? "confirmed" : "needs_confirmation",
      tax_lookup_checked_at: Number.isFinite(annual) ? checkedAt : null,
      estimated_market_value: Number.isFinite(estimated) ? estimated : null,
      market_value_source: Number.isFinite(estimated) ? `${form.value_source} (manually entered)` : null,
      market_value_source_url: Number.isFinite(estimated) ? valueSourceUrl : null,
      market_value_checked_at: Number.isFinite(estimated) ? checkedAt : null,
      market_value_status: Number.isFinite(estimated) ? "estimate" : null,
      escrowed: form.escrowed,
      mortgage_servicer: form.mortgage_servicer.trim() || null,
      mortgage_balance: optionalNumber(form.mortgage_balance),
      mortgage_monthly_payment: optionalNumber(form.mortgage_monthly_payment),
      mortgage_interest_rate: optionalNumber(form.mortgage_interest_rate),
      mortgage_statement_date: form.mortgage_statement_date || null,
      mortgage_payment_due_date: form.mortgage_payment_due_date || null,
      insurance_carrier: form.insurance_carrier.trim() || null,
      insurance_annual_premium: optionalNumber(form.insurance_annual_premium),
      insurance_policy_start_date: form.insurance_policy_start_date || null,
      insurance_policy_expiration_date: form.insurance_policy_expiration_date || null,
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

  const filters = ["All", "You Pay", "Lender Pays", "California", "Hawaii", "Florida", "Indiana"];
  const filtered = properties.filter((p) => {
    const q = search.toLowerCase();
    const text = [p.name, p.street_address, p.city, p.state, p.county, p.zip, p.mortgage_servicer, p.insurance_carrier].filter(Boolean).join(" ").toLowerCase();
    if (q && !text.includes(q)) return false;
    if (filter === "You Pay") return !p.escrowed;
    if (filter === "Lender Pays") return p.escrowed;
    if (filter === "California") return p.state?.toUpperCase() === "CA";
    if (filter === "Hawaii") return p.state?.toUpperCase() === "HI";
    if (filter === "Florida") return p.state?.toUpperCase() === "FL";
    if (filter === "Indiana") return p.state?.toUpperCase() === "IN";
    return true;
  });

  const directPay = filtered.filter((p) => !p.escrowed);
  const escrowed = filtered.filter((p) => p.escrowed);
  const portfolioValue = properties.reduce((sum, p) => sum + (Number(p.estimated_market_value) || 0), 0);
  const annualTaxes = properties.reduce((sum, p) => sum + (Number(p.annual_property_tax) || 0), 0);

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <Sidebar active="properties" signOut={signOut} />

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-8">
          <header className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                  <Landmark size={15} /> Property command center
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Properties Made Simple</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">See each property’s value, mortgage, insurance, and taxes in one easy place.</p>
              </div>
              <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={17} /> Add property</button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryStat label="You pay the tax" value={String(properties.filter((p) => !p.escrowed).length)} sub="You pay the county directly" tone="blue" />
              <SummaryStat label="Lender pays the tax" value={String(properties.filter((p) => p.escrowed).length)} sub="Paid through the mortgage" tone="green" />
              <SummaryStat label="Total property value" value={money(portfolioValue || null)} sub="Estimated value of all properties" tone="violet" />
              <SummaryStat label="Yearly property taxes" value={money(annualTaxes || null)} sub="Total recorded for all properties" tone="amber" />
            </div>
          </header>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
            <div className="flex items-center gap-2"><LockKeyhole size={15} className="text-blue-600" /><span><span className="font-semibold text-slate-700">Private workspace.</span> Parcel numbers and private notes stay out of overview cards.</span></div>
            <span>Market values are estimates, not appraisals.</span>
          </div>

          <ColorGuide />

          {message && <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>}

          {showForm && (
            <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div><h2 className="text-lg font-semibold">{editingId ? "Edit property details" : "Add a property"}</h2><p className="mt-1 text-sm text-slate-500">Add what you know. Any field can be updated later.</p></div>
              <form onSubmit={save} className="mt-6 space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 ring-1 ring-slate-200"><Home size={18} /></div><div><h3 className="text-sm font-semibold">Property details</h3><p className="text-xs text-slate-500">Name and address</p></div></div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Property name" required value={form.name} onChange={(v) => updateField("name", v)} />
                    <Field label="Street address" required value={form.street_address} onChange={(v) => updateField("street_address", v)} />
                    <Field label="City" value={form.city} onChange={(v) => updateField("city", v)} />
                    <div className="grid grid-cols-2 gap-3"><Field label="State" value={form.state} onChange={(v) => updateField("state", v)} /><Field label="ZIP" value={form.zip} onChange={(v) => updateField("zip", v)} /></div>
                    <Field label="County" value={form.county} onChange={(v) => updateField("county", v)} />
                    <Field label="APN / Parcel number" value={form.apn} onChange={(v) => updateField("apn", v)} />
                  </div>
                  <PropertyResearchLinks address={[form.street_address, form.city, form.state, form.zip].filter(Boolean).join(", ")} state={form.state} county={form.county} taxUrl={form.tax_payment_url} />
                </div>

                <div className="rounded-3xl border border-blue-200 bg-blue-50/65 p-5">
                  <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 ring-1 ring-blue-100"><ReceiptText size={18} /></div><div><h3 className="text-sm font-semibold text-blue-950">Mortgage</h3><p className="text-xs text-blue-700/75">Who holds the loan, what is owed, and the monthly payment</p></div></div>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Mortgage company" value={form.mortgage_servicer} onChange={(v) => updateField("mortgage_servicer", v)} />
                    <Field label="Amount still owed" type="number" step="0.01" value={form.mortgage_balance} onChange={(v) => updateField("mortgage_balance", v)} />
                    <Field label="Monthly mortgage payment" type="number" step="0.01" value={form.mortgage_monthly_payment} onChange={(v) => updateField("mortgage_monthly_payment", v)} />
                    <Field label="Loan interest rate (%)" type="number" step="0.0001" value={form.mortgage_interest_rate} onChange={(v) => updateField("mortgage_interest_rate", v)} />
                    <Field label="Balance checked on" type="date" value={form.mortgage_statement_date} onChange={(v) => updateField("mortgage_statement_date", v)} />
                    <Field label="Next mortgage payment due" type="date" value={form.mortgage_payment_due_date} onChange={(v) => updateField("mortgage_payment_due_date", v)} />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-blue-700/75">“Amount still owed” comes from the latest statement. The final payoff amount may be slightly different.</p>
                </div>

                <div className="rounded-3xl border border-violet-200 bg-violet-50/65 p-5">
                  <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-violet-600 ring-1 ring-violet-100"><ShieldCheck size={18} /></div><div><h3 className="text-sm font-semibold text-violet-950">Insurance</h3><p className="text-xs text-violet-700/75">Who protects the property and what the coverage costs</p></div></div>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Insurance company" value={form.insurance_carrier} onChange={(v) => updateField("insurance_carrier", v)} />
                    <Field label="Yearly insurance cost" type="number" step="0.01" value={form.insurance_annual_premium} onChange={(v) => updateField("insurance_annual_premium", v)} />
                    <Field label="Coverage starts" type="date" value={form.insurance_policy_start_date} onChange={(v) => updateField("insurance_policy_start_date", v)} />
                    <Field label="Coverage ends or renews" type="date" value={form.insurance_policy_expiration_date} onChange={(v) => updateField("insurance_policy_expiration_date", v)} />
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
                  <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-amber-600 ring-1 ring-amber-100"><Landmark size={18} /></div><div><h3 className="text-sm font-semibold text-amber-950">Property taxes</h3><p className="text-xs text-amber-700/75">Who pays the county and where to make a payment</p></div></div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Estimated property value" type="number" step="1" value={form.estimated_market_value} onChange={(v) => updateField("estimated_market_value", v)} />
                    <SelectField label="Value copied from" value={form.value_source} options={["Zillow", "Redfin", "Other"]} onChange={(v) => updateField("value_source", v)} />
                    <Field label="County tax office" value={form.tax_collector_name} onChange={(v) => updateField("tax_collector_name", v)} />
                    <Field label="Tax payment website" type="url" value={form.tax_payment_url} onChange={(v) => updateField("tax_payment_url", v)} />
                    <Field label="Yearly property tax" type="number" step="0.01" value={form.annual_property_tax} onChange={(v) => updateField("annual_property_tax", v)} />
                    <Field label="Property tax year" value={form.property_tax_year} onChange={(v) => updateField("property_tax_year", v)} />
                    <label className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 ${form.escrowed ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}><input type="checkbox" checked={form.escrowed} onChange={(e) => updateField("escrowed", e.target.checked)} /><span><span className="block text-sm font-medium">Mortgage company pays the property tax</span><span className="block text-xs text-slate-500">This is also called escrow. Leave unchecked if you pay the county yourself.</span></span></label>
                  </div>
                </div>

                <label className="block"><span className="text-sm font-medium text-slate-700">Private notes</span><textarea rows={3} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                <div className="flex justify-end gap-3"><button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm">Cancel</button><button disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving..." : "Save changes"}</button></div>
              </form>
            </section>
          )}

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search properties..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white" /></div>
              <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible">{filters.map((f) => <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === f ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{f}</button>)}</div>
            </div>
          </div>

          {loading ? <p className="mt-8 text-sm text-slate-500">Loading properties...</p> : (
            <div className="mt-7 space-y-12">
              {filter !== "Lender Pays" && (
                <section>
                  <SectionHeading title="You Pay the Property Tax" count={directPay.length} subtitle="You are responsible for paying the county directly." tone="blue" />
                  {directPay.length === 0 ? <EmptyState text="No direct-pay properties in this view." /> : <div className="mt-4 space-y-4">{directPay.map((p) => <ActionPropertyCard key={p.id} property={p} onEdit={edit} onDelete={remove} />)}</div>}
                </section>
              )}

              {filter !== "You Pay" && (
                <section>
                  <SectionHeading title="Lender Pays the Property Tax" count={escrowed.length} subtitle="Your mortgage company handles the tax payment through escrow." tone="green" />
                  {escrowed.length === 0 ? <EmptyState text="No escrowed properties in this view." /> : <div className="mt-4 grid gap-4 xl:grid-cols-2">{escrowed.map((p) => <ManagedPropertyCard key={p.id} property={p} onEdit={edit} onDelete={remove} />)}</div>}
                </section>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ActionPropertyCard({ property: p, onEdit, onDelete }: { property: PropertyRecord; onEdit: (p: PropertyRecord) => void; onDelete: (id: string) => void }) {
  const schedule = getTaxSchedule(p);
  const needs = p.property_tax_status === "needs_confirmation";
  const nextDue = getNextDue(schedule);
  const checkedDate = p.market_value_checked_at ? new Date(p.market_value_checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <article className="overflow-hidden rounded-[28px] border-2 border-sky-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="grid gap-0 xl:grid-cols-[1.35fr_.85fr]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Home size={21} /></div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{p.name}</h3><span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">You pay the tax</span>{needs && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Tax amount needs checking</span>}</div><p className="mt-1 text-sm text-slate-500">{[p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-slate-400">{p.county ? `${p.county} County` : "County not entered"}</p></div>
            </div>
            <CardActions property={p} onEdit={onEdit} onDelete={onDelete} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Estimated property value" value={p.estimated_market_value == null ? "Not entered" : money(p.estimated_market_value)} accent="indigo" />
            <InfoTile label="Yearly property tax" value={money(p.annual_property_tax)} accent="amber" />
            <InfoTile label="Next tax payment due" value={nextDue} accent="rose" />
          </div>

          <PropertySourceButtons property={p} />

          <MortgageInsuranceSummary property={p} />

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span><span className="font-semibold text-slate-700">Payment plan:</span> {schedule?.frequency ?? "Not entered"}</span>
            <span><span className="font-semibold text-slate-700">Tax year:</span> {p.property_tax_year ?? schedule?.cycle ?? "Not entered"}</span>
            {p.market_value_source && <span><span className="font-semibold text-slate-700">Value source:</span> {p.market_value_source}{checkedDate ? ` · ${checkedDate}` : ""}</span>}
            {p.market_value_source_url && <a href={p.market_value_source_url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-700">View value source ↗</a>}
          </div>

          {schedule && (
            <details className="group mt-4 rounded-2xl border border-slate-200 bg-slate-50/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700"><span>Show all property tax dates</span><ChevronDown size={16} className="transition group-open:rotate-180" /></summary>
              <div className="border-t border-slate-200 px-4 py-4"><div className="flex flex-wrap gap-2">{schedule.dueDates.map((date) => <span key={date} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">{date}</span>)}</div>{schedule.installmentAmount && <p className="mt-3 text-xs font-semibold text-slate-600">Approx. {schedule.installmentAmount} per installment</p>}<p className="mt-2 text-xs leading-5 text-slate-500">{schedule.note}</p></div>
            </details>
          )}
        </div>

        <div className="border-t border-amber-200 bg-amber-50/70 p-5 sm:p-6 xl:border-l xl:border-t-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-amber-600 ring-1 ring-amber-200"><Landmark size={18} /></div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Property tax payment</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use the county’s official website to check the bill or pay the property tax.</p>
          <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-amber-200"><p className="text-xs text-slate-400">County tax office</p><p className="mt-1 text-sm font-semibold text-slate-800">{p.tax_collector_name ?? "Not entered"}</p></div>
          {p.tax_payment_url ? <a href={p.tax_payment_url} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400">Open County Tax Website <ExternalLink size={15} /></a> : <button disabled className="mt-4 w-full rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">Tax website not entered</button>}
        </div>
      </div>
    </article>
  );
}

function ManagedPropertyCard({ property: p, onEdit, onDelete }: { property: PropertyRecord; onEdit: (p: PropertyRecord) => void; onDelete: (id: string) => void }) {
  const schedule = getTaxSchedule(p);
  return (
    <article className="rounded-[24px] border-2 border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><ShieldCheck size={18} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{p.name}</h3><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Mortgage company pays the tax</span></div><p className="mt-1 text-sm text-slate-500">{[p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p></div></div>
        <CardActions property={p} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3"><InfoTile label="Estimated property value" value={p.estimated_market_value == null ? "Not entered" : money(p.estimated_market_value)} accent="indigo" /><InfoTile label="Yearly property tax" value={money(p.annual_property_tax)} accent="amber" /></div>
      <PropertySourceButtons property={p} />
      <MortgageInsuranceSummary property={p} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 pt-4"><p className="text-xs text-slate-500">Tax schedule: {schedule?.frequency ?? "Not entered"} · Next date: {getNextDue(schedule)}</p>{p.tax_payment_url && <a href={p.tax_payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800">Open County Tax Website <ExternalLink size={13} /></a>}</div>
    </article>
  );
}

function PropertyResearchLinks({ address, state, county, taxUrl }: { address: string; state: string; county: string; taxUrl?: string | null }) {
  const ready = address.trim().length >= 8;
  const links = [
    { label: "Check Zillow value", href: zillowLookupUrl(address), style: "border-blue-200 bg-white text-blue-700 hover:bg-blue-50" },
    { label: "Check Redfin value", href: redfinLookupUrl(address), style: "border-red-200 bg-white text-red-700 hover:bg-red-50" },
    { label: "Check county tax", href: countyLookupUrl(address, state, county, taxUrl), style: "border-amber-200 bg-white text-amber-800 hover:bg-amber-50" },
  ];

  return (
    <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-sm font-semibold text-indigo-950">Look it up, then enter the numbers below</p>
      <p className="mt-1 text-xs leading-5 text-indigo-700">These buttons search the address for you. Copy the estimated value and yearly tax into the editable fields.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => ready ? (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${link.style}`}>{link.label} <ExternalLink size={13} /></a>
        ) : (
          <span key={link.label} className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400">{link.label}</span>
        ))}
      </div>
      {!ready && <p className="mt-2 text-xs text-slate-500">Enter the address first to activate these buttons.</p>}
    </div>
  );
}

function PropertySourceButtons({ property: p }: { property: PropertyRecord }) {
  const address = [p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a href={zillowLookupUrl(address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">Check Zillow <ExternalLink size={11} /></a>
      <a href={redfinLookupUrl(address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100">Check Redfin <ExternalLink size={11} /></a>
      <a href={countyLookupUrl(address, p.state ?? "", p.county ?? "", p.tax_payment_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">Check county tax <ExternalLink size={11} /></a>
    </div>
  );
}

function MortgageInsuranceSummary({ property: p }: { property: PropertyRecord }) {
  const hasMortgage = [p.mortgage_servicer, p.mortgage_balance, p.mortgage_monthly_payment, p.mortgage_interest_rate, p.mortgage_statement_date, p.mortgage_payment_due_date].some((value) => value != null);
  const hasInsurance = [p.insurance_carrier, p.insurance_annual_premium, p.insurance_policy_start_date, p.insurance_policy_expiration_date].some((value) => value != null);
  const renewal = getRenewalStatus(p.insurance_policy_expiration_date);
  const interestRate = p.mortgage_interest_rate == null
    ? null
    : `${Number(p.mortgage_interest_rate).toLocaleString("en-US", { maximumFractionDigits: 4 })}% interest`;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <section className="rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 ring-1 ring-sky-100"><ReceiptText size={17} /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-sky-700">Mortgage · money borrowed</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{p.mortgage_servicer ?? "Mortgage company not entered"}</p>
          </div>
        </div>
        {hasMortgage ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <FinancialValue label="Amount still owed" value={preciseMoney(p.mortgage_balance)} />
              <FinancialValue label="Monthly mortgage payment" value={preciseMoney(p.mortgage_monthly_payment)} />
            </div>
            <div className="mt-3 space-y-1 text-xs leading-5 text-sky-900/70">
              {interestRate && <p>{interestRate}</p>}
              {p.mortgage_statement_date && <p>Balance checked on {formatDate(p.mortgage_statement_date)}</p>}
              {p.mortgage_payment_due_date && <p>Next mortgage payment: {formatDate(p.mortgage_payment_due_date)}</p>}
            </div>
          </>
        ) : <p className="mt-4 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-sky-800">Not added yet. Use <span className="font-semibold">Edit details</span> to add the mortgage.</p>}
      </section>

      <section className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 ring-1 ring-violet-100"><ShieldCheck size={17} /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-violet-700">Insurance · property protection</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">{p.insurance_carrier ?? "Insurance company not entered"}</p>
            </div>
          </div>
          {renewal && <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${renewal.className}`}>{renewal.label}</span>}
        </div>
        {hasInsurance ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <FinancialValue label="Yearly insurance cost" value={preciseMoney(p.insurance_annual_premium)} />
              <FinancialValue label="Coverage ends or renews" value={formatDate(p.insurance_policy_expiration_date)} />
            </div>
            {p.insurance_policy_start_date && <p className="mt-3 text-xs leading-5 text-violet-900/70">Coverage started {formatDate(p.insurance_policy_start_date)}</p>}
          </>
        ) : <p className="mt-4 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-violet-800">Not added yet. Use <span className="font-semibold">Edit details</span> to add the insurance.</p>}
      </section>
    </div>
  );
}

function getRenewalStatus(expirationDate: string | null) {
  if (!expirationDate) return null;
  const expiration = new Date(`${expirationDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.ceil((expiration.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: "Update needed", className: "bg-red-100 text-red-700" };
  if (days <= 60) return { label: "Renews soon", className: "bg-amber-100 text-amber-800" };
  return null;
}

function FinancialValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold leading-5 text-slate-900">{value}</p></div>;
}

function CardActions({ property, onEdit, onDelete }: { property: PropertyRecord; onEdit: (p: PropertyRecord) => void; onDelete: (id: string) => void }) {
  return <div className="flex shrink-0 gap-1"><button onClick={() => onEdit(property)} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Pencil size={14} /> Edit details</button><button onClick={() => onDelete(property.id)} aria-label="Delete property" className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></div>;
}

function SectionHeading({ title, count, subtitle, tone }: { title: string; count: number; subtitle: string; tone: "blue" | "green" }) {
  const shell = tone === "blue" ? "border-sky-200 bg-sky-50" : "border-emerald-200 bg-emerald-50";
  const icon = tone === "blue" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white";
  const pill = tone === "blue" ? "bg-white text-sky-700 ring-sky-200" : "bg-white text-emerald-700 ring-emerald-200";
  return <div className={`rounded-2xl border px-4 py-3 ${shell}`}><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${icon}`}>{count}</span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{title}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${pill}`}>{tone === "blue" ? "ACTION" : "HANDLED FOR YOU"}</span></div><p className="mt-0.5 text-xs text-slate-600 sm:text-sm">{subtitle}</p></div></div></div>;
}

function SummaryStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "blue" | "green" | "violet" | "amber" }) {
  const shells = { blue: "border-sky-200 bg-sky-50", green: "border-emerald-200 bg-emerald-50", violet: "border-violet-200 bg-violet-50", amber: "border-amber-200 bg-amber-50" };
  const labels = { blue: "text-sky-700", green: "text-emerald-700", violet: "text-violet-700", amber: "text-amber-700" };
  return <div className={`rounded-2xl border p-4 ${shells[tone]}`}><span className={`text-xs font-semibold ${labels[tone]}`}>{label}</span><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>;
}

function InfoTile({ label, value, accent = "slate" }: { label: string; value: string; accent?: "slate" | "blue" | "indigo" | "amber" | "rose" }) {
  const styles = {
    slate: "border-slate-200 bg-white text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return <div className={`rounded-2xl border p-3 ${styles[accent]}`}><p className="text-[11px] font-semibold uppercase tracking-[0.07em] opacity-65">{label}</p><p className="mt-1.5 text-sm font-semibold">{value}</p></div>;
}

function ColorGuide() {
  const items = [
    { label: "Property value", help: "What the property may be worth", dot: "bg-indigo-500", shell: "border-indigo-200 bg-indigo-50 text-indigo-900" },
    { label: "Mortgage", help: "Loan balance and monthly payment", dot: "bg-sky-500", shell: "border-sky-200 bg-sky-50 text-sky-900" },
    { label: "Insurance", help: "Protection and yearly cost", dot: "bg-violet-500", shell: "border-violet-200 bg-violet-50 text-violet-900" },
    { label: "Property tax", help: "County tax and payment dates", dot: "bg-amber-500", shell: "border-amber-200 bg-amber-50 text-amber-950" },
  ];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-slate-800">Color guide</h2>
        <p className="text-xs text-slate-500">The same color always means the same thing.</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl border px-3 py-2.5 ${item.shell}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
              <span className="text-xs font-semibold">{item.label}</span>
            </div>
            <p className="mt-1 pl-[18px] text-[11px] opacity-70">{item.help}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

function Sidebar({ active, signOut }: { active: string; signOut: () => void }) {
  const nav = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: Home },
    { key: "properties", href: "/properties", label: "Properties & Taxes", icon: Landmark },
    { key: "businesses", href: "/businesses", label: "Business Compliance", icon: Building2 },
    { key: "reminders", href: "/reminders", label: "Family Reminders", icon: CalendarDays },
  ];
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
      <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"><Home size={21} /></div><div><p className="font-semibold">Vo Family Operations</p><p className="text-xs text-slate-500">Family Dashboard</p></div></Link>
      <nav className="mt-8 space-y-2">{nav.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${active === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={18} /> {label}</Link>)}</nav>
      <div className="mt-auto rounded-3xl border border-blue-100 bg-blue-50/70 p-5 text-xs leading-5 text-blue-800"><div className="flex items-center gap-2 font-semibold text-blue-950"><LockKeyhole size={16} /> Private family workspace</div><p className="mt-2">Property and compliance data is available only after authentication.</p></div>
      <button onClick={signOut} className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={17} /> Sign out</button>
    </aside>
  );
}

function Field({ label, value, onChange, type = "text", step, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string; required?: boolean }) {
  return <label><span className="text-sm font-medium text-slate-700">{label}</span><input type={type} step={step} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="text-sm font-medium text-slate-700">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
