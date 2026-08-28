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
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Property & Business</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-950">Choose a new password</h1>
        <p className="mt-2 text-sm text-gray-500">Enter your new password below.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">New password</span>
            <input required minLength={6} disabled={!ready || loading} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900 disabled:bg-gray-100" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Confirm new password</span>
            <input required minLength={6} disabled={!ready || loading} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900 disabled:bg-gray-100" />
          </label>

          {message && <p className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">{message}</p>}

          <button disabled={!ready || loading} className="w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
