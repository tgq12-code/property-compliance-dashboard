"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Home, LogOut, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Profile = {
  id: string;
  email: string | null;
  approved: boolean;
  is_admin: boolean;
  approval_requested_at: string;
  approved_at: string | null;
};

export default function AccountApprovalsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) { router.replace("/"); return; }

    const { data: me } = await supabase.from("profiles").select("approved,is_admin").eq("id", user.id).maybeSingle();
    if (!me?.approved || !me?.is_admin) {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,approved,is_admin,approval_requested_at,approved_at")
      .order("approved", { ascending: true })
      .order("approval_requested_at", { ascending: true });
    if (error) setMessage(error.message);
    else setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setApproval(profile: Profile, approved: boolean) {
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const adminId = sessionData.session?.user.id;
    if (!adminId) { router.replace("/"); return; }
    if (profile.is_admin && !approved) {
      setMessage("The administrator account cannot be revoked here.");
      return;
    }

    const { error } = await supabase.from("profiles").update({
      approved,
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? adminId : null,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);

    if (error) setMessage(error.message);
    else {
      setMessage(approved ? `${profile.email ?? "Account"} approved.` : `${profile.email ?? "Account"} access revoked.`);
      await load();
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const pending = profiles.filter((p) => !p.approved);
  const approved = profiles.filter((p) => p.approved);

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600"><ShieldCheck size={16}/> Security</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Account Approvals</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">New users can request an account, but they cannot access protected family data until you approve them here.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"><Home size={16}/> Dashboard</Link>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"><LogOut size={16}/> Sign out</button>
          </div>
        </header>

        {message && <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Clock3 size={19}/></div><div><p className="text-sm text-amber-800">Waiting for approval</p><p className="text-3xl font-semibold text-amber-950">{pending.length}</p></div></div></div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={19}/></div><div><p className="text-sm text-emerald-800">Approved accounts</p><p className="text-3xl font-semibold text-emerald-950">{approved.length}</p></div></div></div>
        </div>

        <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-semibold">Pending requests</h2><p className="mt-1 text-sm text-slate-500">Only approve people you recognize and trust with private family information.</p></div>
          {loading ? <p className="px-6 py-8 text-sm text-slate-500">Loading account requests...</p> : pending.length === 0 ? <p className="px-6 py-8 text-sm text-slate-500">No accounts are waiting for approval.</p> : <div className="divide-y divide-slate-100">{pending.map((profile) => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div><p className="font-medium">{profile.email ?? "No email"}</p><p className="mt-1 text-xs text-slate-500">Requested {new Date(profile.approval_requested_at).toLocaleString()}</p></div><button onClick={() => setApproval(profile, true)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><UserCheck size={16}/> Approve access</button></div>)}</div>}
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-semibold">Approved accounts</h2><p className="mt-1 text-sm text-slate-500">You can revoke access later if needed.</p></div>
          <div className="divide-y divide-slate-100">{approved.map((profile) => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div><div className="flex items-center gap-2"><p className="font-medium">{profile.email ?? "No email"}</p>{profile.is_admin && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Administrator</span>}</div><p className="mt-1 text-xs text-slate-500">{profile.approved_at ? `Approved ${new Date(profile.approved_at).toLocaleString()}` : "Approved"}</p></div>{!profile.is_admin && <button onClick={() => setApproval(profile, false)} className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"><UserX size={16}/> Revoke access</button>}</div>)}</div>
        </section>
      </div>
    </main>
  );
}
