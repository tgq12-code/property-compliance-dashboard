"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setMessage(error.message);
      else setMessage("Password reset email sent. Check your inbox and follow the link to choose a new password.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage("Account created. If email confirmation is enabled, check your inbox before signing in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else {
        router.push("/properties");
        router.refresh();
      }
    }
    setLoading(false);
  }

  const title = mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Property & Business</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-950">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {mode === "forgot" ? "Enter your email and we’ll send you a password reset link." : "Your records are private and tied to your Supabase account."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" />
          </label>

          {mode !== "forgot" && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-900" />
            </label>
          )}

          {mode === "login" && (
            <button type="button" onClick={() => { setMode("forgot"); setMessage(""); }} className="text-sm font-medium text-gray-600 hover:text-gray-950">
              Forgot password?
            </button>
          )}

          {message && <p className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">{message}</p>}

          <button disabled={loading} className="w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        {mode === "forgot" ? (
          <button onClick={() => { setMode("login"); setMessage(""); }} className="mt-5 w-full text-sm font-medium text-gray-600 hover:text-gray-950">Back to sign in</button>
        ) : (
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-5 w-full text-sm font-medium text-gray-600 hover:text-gray-950">
            {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        )}
      </div>
    </main>
  );
}
