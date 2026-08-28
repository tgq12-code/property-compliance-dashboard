"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const RESET_COOLDOWN_SECONDS = 60;
const RESET_COOLDOWN_KEY = "vo-family-reset-cooldown-until";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recoveryCode = params.get("code");

    // Supabase PKCE recovery links can land on the site root first. Move the
    // untouched one-time code to the dedicated reset page BEFORE creating a
    // Supabase browser client, otherwise the client may consume the code here.
    if (recoveryCode) {
      window.location.replace(`/reset-password?code=${encodeURIComponent(recoveryCode)}`);
      return;
    }

    const supabase = createClient();

    function updateCooldown() {
      const until = Number(window.localStorage.getItem(RESET_COOLDOWN_KEY) || 0);
      const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setResetCooldown(seconds);
      if (seconds === 0 && until) window.localStorage.removeItem(RESET_COOLDOWN_KEY);
    }

    function handleAuthRedirect() {
      const currentParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorCode = currentParams.get("error_code") || hashParams.get("error_code");
      const errorDescription = currentParams.get("error_description") || hashParams.get("error_description");

      if (errorCode === "otp_expired") {
        setMode("forgot");
        setMessage("That password reset link has already been used or expired. Request one new reset email below and use only the newest link.");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (errorDescription) {
        setMessage(errorDescription.replace(/\+/g, " "));
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    updateCooldown();
    handleAuthRedirect();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        router.replace("/reset-password");
        router.refresh();
      }
    });

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery" || hashParams.has("access_token")) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.replace("/reset-password");
          router.refresh();
        }
      });
    }

    const timer = window.setInterval(updateCooldown, 1000);
    return () => {
      window.clearInterval(timer);
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    if (mode === "forgot") {
      if (resetCooldown > 0) {
        setMessage(`Please wait ${resetCooldown} seconds before requesting another reset email.`);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        if (error.message.toLowerCase().includes("rate limit")) {
          const until = Date.now() + RESET_COOLDOWN_SECONDS * 1000;
          window.localStorage.setItem(RESET_COOLDOWN_KEY, String(until));
          setResetCooldown(RESET_COOLDOWN_SECONDS);
          setMessage("Password reset email limit reached. Please wait before trying again. The button is temporarily locked to prevent repeated requests.");
        } else {
          setMessage(error.message);
        }
      } else {
        const until = Date.now() + RESET_COOLDOWN_SECONDS * 1000;
        window.localStorage.setItem(RESET_COOLDOWN_KEY, String(until));
        setResetCooldown(RESET_COOLDOWN_SECONDS);
        setMessage("Password reset email sent. Check your inbox and use only the newest link.");
      }

      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setMessage(error ? error.message : "Account created. Check your email if confirmation is required.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else {
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  }

  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password";

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
              Property taxes, LLC deadlines, family reminders, birthdays, appointments, school dates, and all the other fun things nobody remembers until the last minute.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-white/25 bg-black/35 px-4 py-2 text-sm backdrop-blur-sm">
              Current system status: Catmy is thinking of another idea. Tuan is already behind.
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full">
            <p className="text-sm font-medium text-gray-500">Vo Family Reminder & Compliance Dashboard</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {mode === "forgot" ? "Enter your email and we’ll send you a reset link." : "Sign in before viewing family reminders, property, business, tax, or compliance information."}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Email</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-gray-900" />
              </label>

              {mode !== "forgot" && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Password</span>
                  <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-gray-900" />
                </label>
              )}

              {mode === "login" && (
                <button type="button" onClick={() => { setMode("forgot"); setMessage(""); }} className="text-sm font-medium text-gray-600 hover:text-gray-950">
                  Forgot password?
                </button>
              )}

              {message && <p className="rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700">{message}</p>}

              <button disabled={loading || (mode === "forgot" && resetCooldown > 0)} className="w-full rounded-xl bg-gray-950 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : resetCooldown > 0
                        ? `Try again in ${resetCooldown}s`
                        : "Send reset link"}
              </button>
            </form>

            {mode === "forgot" ? (
              <button onClick={() => { setMode("login"); setMessage(""); }} className="mt-5 w-full text-sm font-medium text-gray-600 hover:text-gray-950">Back to sign in</button>
            ) : (
              <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-5 w-full text-sm font-medium text-gray-600 hover:text-gray-950">
                {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
              </button>
            )}

            <p className="mt-8 text-center text-xs text-gray-400">Private dashboard · No family or compliance information is shown until you sign in.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
