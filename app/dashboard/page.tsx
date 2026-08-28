"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Building2, Home, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/");
      else setReady(true);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!ready) return <main className="min-h-screen bg-gray-50 p-8 text-sm text-gray-500">Loading...</main>;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-gray-500">Vo Family Operations</p>
            <h1 className="text-2xl font-semibold text-gray-950">Family Dashboard</h1>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><LogOut size={16} /> Sign out</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-gray-950 p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">The Vo Family Command Center</p>
          <h2 className="mt-3 text-3xl font-semibold">Catmy creates the ideas. Tuan keeps the machine alive.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">One private place for properties, taxes, business compliance, important dates, birthdays, appointments, school events, renewals, and all the things someone will eventually ask, “Did you remember?”</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link href="/reminders" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-950 text-white"><BellRing size={20} /></div>
            <h3 className="mt-5 text-xl font-semibold text-gray-950">Family Reminders</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">Create one-time, daily, weekly, monthly, or yearly reminders and choose which family members receive the email.</p>
          </Link>

          <Link href="/properties" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-900"><Home size={20} /></div>
            <h3 className="mt-5 text-xl font-semibold text-gray-950">Properties & Taxes</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">Track properties, escrow status, property tax details, official payment links, and future tax reminders.</p>
          </Link>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><Building2 size={20} /></div>
            <h3 className="mt-5 text-xl font-semibold text-gray-950">Business Compliance</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">California LLC annual tax, filings, renewals, receipts, and compliance deadlines will live here as we continue building.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
