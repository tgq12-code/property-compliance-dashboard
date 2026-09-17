import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment variables are incomplete." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Supabase recommends a few lightweight database requests each day for
  // low-traffic Free Plan projects. HEAD requests create database activity
  // without downloading rows or exposing family data.
  const checks = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("family_reminders").select("id", { count: "exact", head: true }),
  ]);

  const error = checks.find((check) => check.error)?.error;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    requests: checks.length,
  });
}
