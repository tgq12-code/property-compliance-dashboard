"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Verifying your reset link...");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function waitForSession() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return false;
        if (!error && data.session) return true;
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
      return false;
    }

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) setMessage("This password reset link is invalid or has expired. Please request a new one.");
          return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const hasSession = await waitForSession();
      if (!active) return;

      if (!hasSession) {
        setMessage("This password reset link is invalid or has expired. Please request a new one.");
        return;
      }

      setReady(true);
      setMessage("");
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        setReady(true);
        setMessage("");
      }
    });

    establishRecoverySession();
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!ready) {
      setMessage("Your password reset session is not ready. Please request a new reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated. Redirecting to your dashboard...");
    setTimeout(() => router.push("/dashboard"), 900);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1.2fr_0.8fr]">
        <section className="relative min-h-[430px] overflow-hidden bg-gray-900 lg:min-h-full">
          <img src="/welcome-photo.jpg" alt="Catmy and Tuan having fun on a trip" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/10" />

          <div className="absolute left-[11%] top-[18%] rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold tracking-wide text-gray-950 shadow-lg">
            CATMY: GRAND IDEAS DEPARTMENT
          </div>
          <div className="absolute right-[5%] top-[12%] rounded-full bg-gray-950/90 px-3 py-1.5 text-xs font-bold tracking-wide text-white shadow-lg">
            TUAN: IMPLEMENTATION DEPARTMENT
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">Vo Family Operations</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              Catmy has the grand ideas. Tuan&apos;s job is to build them... and somehow keep everything running.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
              Property taxes, LLC deadlines, family reminders and all the other fun things nobody remembers until the last minute.
            </p>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full">
            <p className="text-sm font-medium text-gray-500">Vo Family Reminder & Compliance Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">Choose a new password</h1>
            <p className="mt-2 text-sm text-gray-500">Enter your new password below.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">New password</span>
                <input required minLength={6} disabled={!ready || loading} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-gray-900 disabled:bg-gray-100" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Confirm new password</span>
                <input required minLength={6} disabled={!ready || loading} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-gray-900 disabled:bg-gray-100" />
              </label>

              {message && <p className="rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700">{message}</p>}

              <button disabled={!ready || loading} className="w-full rounded-xl bg-gray-950 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
