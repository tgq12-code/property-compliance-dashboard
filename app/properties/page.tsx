"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Home, LogOut, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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

  async function loadProperties() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("properties")
      .select("id,name,street_address,city,state,zip,county,apn,tax_collector_name,tax_payment_url,annual_property_tax,escrowed,notes")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setProperties((data ?? []) as PropertyRecord[]);
    setLoading(false);
  }

  useEffect(() => {
    loadProperties();
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm(blankForm);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(property: PropertyRecord) {
    setEditingId(property.id);
    setForm({
      name: property.name,
      street_address: property.street_address,
      city: property.city ?? "",
      state: property.state ?? "CA",
      zip: property.zip ?? "",
      county: property.county ?? "",
      apn: property.apn ?? "",
      tax_collector_name: property.tax_collector_name ?? "",
      tax_payment_url: property.tax_payment_url ?? "",
      annual_property_tax: property.annual_property_tax == null ? "" : String(property.annual_property_tax),
      escrowed: property.escrowed,
      notes: property.notes ?? "",
    });
    setShowForm(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(blankForm);
  }

  async function saveProperty(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const annualTax = form.annual_property_tax.trim() ? Number(form.annual_property_tax) : null;
    const payload = {
      name: form.name.trim(),
      street_address: form.street_address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      county: form.county.trim() || null,
      apn: form.apn.trim() || null,
      tax_collector_name: form.tax_collector_name.trim() || null,
      tax_payment_url: form.tax_payment_url.trim() || null,
      annual_property_tax: Number.isFinite(annualTax) ? annualTax : null,
      escrowed: form.escrowed,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await supabase.from("properties").update(payload).eq("id", editingId)
      : await supabase.from("properties").insert({ user_id: user.id, ...payload });

    if (error) setMessage(error.message);
    else {
      setForm(blankForm);
      setShowForm(false);
      setEditingId(null);
      setMessage(editingId ? "Property updated." : "Property saved.");
      await loadProperties();
    }
    setSaving(false);
  }

  async function deleteProperty(id: string) {
    if (!window.confirm("Delete this property? Any linked obligations will also be deleted.")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await loadProperties();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label="Back to family dashboard"><ArrowLeft size={17} /></Link>
            <div>
              <p className="text-sm font-medium text-gray-500">Property & Business</p>
              <h1 className="text-2xl font-semibold text-gray-950">Properties</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><LogOut size={16} /> Sign out</button>
            <button onClick={openAddForm} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"><Plus size={16} /> Add property</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-950">{editingId ? "Edit property" : "Add property"}</h2>
              <p className="mt-1 text-sm text-gray-500">{editingId ? "Update any property, tax, payment, or impound details below." : "You can fill in only what you know now and add tax details later."}</p>
            </div>
            <form onSubmit={saveProperty} className="grid gap-5 md:grid-cols-2">
              <Field label="Property name" required value={form.name} onChange={(v) => updateField("name", v)} placeholder="La Mesa Rental" />
              <Field label="Street address" required value={form.street_address} onChange={(v) => updateField("street_address", v)} placeholder="9953 Lemon Ave" />
              <Field label="City" value={form.city} onChange={(v) => updateField("city", v)} placeholder="La Mesa" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" value={form.state} onChange={(v) => updateField("state", v)} placeholder="CA" />
                <Field label="ZIP" value={form.zip} onChange={(v) => updateField("zip", v)} placeholder="91941" />
              </div>
              <Field label="County" value={form.county} onChange={(v) => updateField("county", v)} placeholder="San Diego" />
              <Field label="APN / Parcel number" value={form.apn} onChange={(v) => updateField("apn", v)} />
              <Field label="Tax collector" value={form.tax_collector_name} onChange={(v) => updateField("tax_collector_name", v)} placeholder="San Diego County Treasurer-Tax Collector" />
              <Field label="Official tax payment URL" type="url" value={form.tax_payment_url} onChange={(v) => updateField("tax_payment_url", v)} placeholder="https://..." />
              <Field label="Annual property tax" type="number" step="0.01" value={form.annual_property_tax} onChange={(v) => updateField("annual_property_tax", v)} placeholder="12846.32" />
              <label className={`flex items-center gap-3 self-end rounded-xl border px-4 py-3 ${form.escrowed ? "border-emerald-200 bg-emerald-50" : "border-gray-200"}`}>
                <input type="checkbox" checked={form.escrowed} onChange={(e) => updateField("escrowed", e.target.checked)} className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-medium text-gray-800">Property taxes are impounded / escrowed</span>
                  <span className="block text-xs text-gray-500">The lender pays the property taxes. Do not create payment reminders for me.</span>
                </span>
              </label>
              {form.escrowed && (
                <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <ShieldCheck className="mt-0.5 shrink-0" size={18} />
                  <div><span className="font-medium">Impounded property.</span> We will keep the tax information for reference, but this property will be treated as lender-paid and excluded from future property-tax payment reminders.</div>
                </div>
              )}
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Notes</span>
                <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" />
              </label>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={cancelForm} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button disabled={saving} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : "Save property"}</button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="font-semibold text-gray-950">Your properties</h2>
            <p className="mt-1 text-sm text-gray-500">Impounded properties remain on file but will not require you to pay the tax directly.</p>
          </div>
          {loading ? (
            <p className="px-6 py-8 text-sm text-gray-500">Loading properties...</p>
          ) : properties.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Home className="mx-auto text-gray-400" size={28} />
              <p className="mt-3 font-medium text-gray-900">No properties yet</p>
              <p className="mt-1 text-sm text-gray-500">Add your first property to start building your reminder system.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {properties.map((property) => (
                <div key={property.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1.3fr_0.8fr_0.7fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-950">{property.name}</p>
                      {property.escrowed && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Impounded · lender pays</span>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{[property.street_address, property.city, property.state, property.zip].filter(Boolean).join(", ")}</p>
                    {property.apn && <p className="mt-1 text-xs text-gray-400">APN: {property.apn}</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">County</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{property.county || "Not entered"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Tax responsibility</p>
                    <p className={`mt-1 text-sm font-medium ${property.escrowed ? "text-emerald-700" : "text-gray-800"}`}>{property.escrowed ? "Lender pays · no action" : "You pay directly"}</p>
                    {!property.escrowed && <p className="mt-1 text-xs text-gray-500">{property.annual_property_tax == null ? "Tax amount not entered" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(property.annual_property_tax) + " annually"}</p>}
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    {!property.escrowed && property.tax_payment_url && <a href={property.tax_payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Pay site <ExternalLink size={14} /></a>}
                    {property.escrowed && property.tax_payment_url && <a href={property.tax_payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">View tax site <ExternalLink size={14} /></a>}
                    <button onClick={() => startEdit(property)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" aria-label={`Edit ${property.name}`}><Pencil size={14} /> Edit</button>
                    <button onClick={() => deleteProperty(property.id)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-red-600" aria-label="Delete property"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, required, placeholder, type = "text", step }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string; step?: string }) {
  return (
    <label>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input required={required} type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" />
    </label>
  );
}
