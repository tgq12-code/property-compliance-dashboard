"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Home, LogOut, Plus, Trash2 } from "lucide-react";
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

  async function addProperty(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const annualTax = form.annual_property_tax.trim() ? Number(form.annual_property_tax) : null;
    const { error } = await supabase.from("properties").insert({
      user_id: user.id,
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
    });

    if (error) setMessage(error.message);
    else {
      setForm(blankForm);
      setShowForm(false);
      setMessage("Property saved.");
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
            <Link href="/" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><ArrowLeft size={17} /></Link>
            <div>
              <p className="text-sm font-medium text-gray-500">Property & Business</p>
              <h1 className="text-2xl font-semibold text-gray-950">Properties</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><LogOut size={16} /> Sign out</button>
            <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"><Plus size={16} /> Add property</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-950">Add property</h2>
              <p className="mt-1 text-sm text-gray-500">You can fill in only what you know now and add tax details later.</p>
            </div>
            <form onSubmit={addProperty} className="grid gap-5 md:grid-cols-2">
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
              <label className="flex items-center gap-3 self-end rounded-xl border border-gray-200 px-4 py-3">
                <input type="checkbox" checked={form.escrowed} onChange={(e) => updateField("escrowed", e.target.checked)} className="h-4 w-4" />
                <span><span className="block text-sm font-medium text-gray-800">Taxes are escrowed</span><span className="block text-xs text-gray-500">Track it, but flag that the lender may pay it.</span></span>
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Notes</span>
                <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" />
              </label>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button disabled={saving} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{saving ? "Saving..." : "Save property"}</button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="font-semibold text-gray-950">Your properties</h2>
            <p className="mt-1 text-sm text-gray-500">These records will later drive tax reminders and payment links.</p>
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
                <div key={property.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1.3fr_0.8fr_0.6fr_auto] md:items-center">
                  <div>
                    <p className="font-medium text-gray-950">{property.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{[property.street_address, property.city, property.state, property.zip].filter(Boolean).join(", ")}</p>
                    {property.apn && <p className="mt-1 text-xs text-gray-400">APN: {property.apn}</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">County</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{property.county || "Not entered"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Annual tax</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{property.annual_property_tax == null ? "Not entered" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(property.annual_property_tax)}</p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    {property.tax_payment_url && <a href={property.tax_payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Pay site <ExternalLink size={14} /></a>}
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
