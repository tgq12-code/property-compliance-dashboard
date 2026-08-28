"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Landmark,
  ShieldCheck,
  UserCheck,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Property = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  escrowed: boolean;
  annual_property_tax: number | null;
};

type Business = {
  id: string;
  name: string;
  entity_type: string | null;
  state: string | null;
};

type Obligation = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  amount_due: number | null;
  business_id: string | null;
  property_id: string | null;
};

type Reminder = {
  id: string;
  title: string;
  starts_at: string;
  active: boolean;
};

type UpcomingItem = {
  id: string;
  kind: "business" | "property" | "reminder";
  title: string;
  date: string;
  amount: number | null;
  status: string;
};

const money = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

const dateLabel = (iso: string) =>
  new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );

const closedStatus = (status: string) =>
  ["completed", "paid", "cancelled", "canceled"].includes(
    (status || "").toLowerCase(),
  );

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      for (let i = 0; i < 8; i += 1) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        if (data.session) {
          const userId = data.session.user.id;
          const profile = await supabase
            .from("profiles")
            .select("approved,is_admin")
            .eq("id", userId)
            .maybeSingle();

          if (!profile.data?.approved) {
            await supabase.auth.signOut();
            router.replace("/");
            return;
          }

          setIsAdmin(Boolean(profile.data.is_admin));
          const [propertyResult, businessResult, obligationResult, reminderResult] =
            await Promise.all([
              supabase
                .from("properties")
                .select("id,name,city,state,escrowed,annual_property_tax")
                .order("created_at", { ascending: false }),
              supabase
                .from("businesses")
                .select("id,name,entity_type,state")
                .order("created_at", { ascending: false }),
              supabase
                .from("obligations")
                .select(
                  "id,title,due_date,status,amount_due,business_id,property_id",
                )
                .order("due_date", { ascending: true }),
              supabase
                .from("family_reminders")
                .select("id,title,starts_at,active")
                .eq("active", true)
                .order("starts_at", { ascending: true }),
            ]);

          setProperties((propertyResult.data ?? []) as Property[]);
          setBusinesses((businessResult.data ?? []) as Business[]);
          setObligations((obligationResult.data ?? []) as Obligation[]);
          setReminders((reminderResult.data ?? []) as Reminder[]);
          setReady(true);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      router.replace("/");
    })();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function markPaid(id: string) {
    setUpdatingId(id);
    const { error } = await supabase
      .from("obligations")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setObligations((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "paid" } : item,
        ),
      );
    }
    setUpdatingId(null);
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] p-8 text-sm text-slate-500">
        Loading your family dashboard...
      </main>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 45);

  const directPay = properties.filter((property) => !property.escrowed).length;
  const escrowed = properties.filter((property) => property.escrowed).length;

  const attentionItems = obligations
    .filter((obligation) => {
      const due = new Date(`${obligation.due_date}T12:00:00`);
      return due <= soon && !closedStatus(obligation.status);
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const upcomingObligations = attentionItems.filter(
    (obligation) => new Date(`${obligation.due_date}T12:00:00`) >= today,
  );

  const upcoming: UpcomingItem[] = [
    ...upcomingObligations.map((obligation) => ({
      id: obligation.id,
      kind: (obligation.business_id ? "business" : "property") as
        | "business"
        | "property",
      title: obligation.title,
      date: obligation.due_date,
      amount: obligation.amount_due,
      status: "Due soon",
    })),
    ...reminders
      .filter((reminder) => {
        const startsAt = new Date(reminder.starts_at);
        return startsAt >= today && startsAt <= soon;
      })
      .map((reminder) => ({
        id: reminder.id,
        kind: "reminder" as const,
        title: reminder.title,
        date: reminder.starts_at,
        amount: null,
        status: "Reminder",
      })),
  ]
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    .slice(0, 6);

  const visibleAttentionItems = attentionItems.slice(0, 3);
  const hiddenAttentionCount = Math.max(
    attentionItems.length - visibleAttentionItems.length,
    0,
  );

  return (
    <main className="min-h-screen text-slate-950">
      <section className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Family command center
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">
              Family overview
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              See what needs action, what is coming up, and where everything lives.
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/admin/accounts"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700"
            >
              <UserCheck size={16} /> Account approvals
            </Link>
          )}
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,.75fr)]">
          <section
            className={`overflow-hidden rounded-3xl border-2 bg-white ${
              attentionItems.length ? "border-amber-200" : "border-emerald-200"
            }`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5 ${
                attentionItems.length
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    attentionItems.length
                      ? "bg-amber-200/70 text-amber-800"
                      : "bg-emerald-200/70 text-emerald-800"
                  }`}
                >
                  {attentionItems.length ? (
                    <Clock3 size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Needs Your Attention</h2>
                    {attentionItems.length > 0 && (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        {attentionItems.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {attentionItems.length
                      ? "The closest unpaid deadlines, in order."
                      : "You’re all caught up right now."}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500">Past due + next 45 days</span>
            </div>

            {visibleAttentionItems.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5 text-sm text-slate-600">
                <CheckCircle2 className="shrink-0 text-emerald-500" size={22} />
                Nothing needs action. New deadlines will appear here automatically.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleAttentionItems.map((item) => {
                  const isBusiness = Boolean(item.business_id);
                  const isPastDue =
                    new Date(`${item.due_date}T12:00:00`) < today;
                  const Icon = isBusiness ? Building2 : Landmark;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isBusiness
                            ? "bg-violet-100 text-violet-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        <Icon size={17} />
                      </div>
                      <div className="min-w-[180px] flex-1">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.amount_due == null
                            ? isBusiness
                              ? "Business deadline"
                              : "Property deadline"
                            : money(item.amount_due)}
                        </p>
                      </div>
                      <div className="min-w-[92px] sm:text-right">
                        <p className="text-sm font-semibold">{dateLabel(item.due_date)}</p>
                        <p
                          className={`mt-0.5 text-xs font-semibold ${
                            isPastDue ? "text-red-600" : "text-amber-700"
                          }`}
                        >
                          {isPastDue ? "Past due" : "Due soon"}
                        </p>
                      </div>
                      <button
                        onClick={() => markPaid(item.id)}
                        disabled={updatingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        {updatingId === item.id ? "Saving..." : "Mark paid"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {hiddenAttentionCount > 0 && (
              <div className="border-t border-amber-100 bg-amber-50/50 px-5 py-2.5 text-xs text-amber-900">
                {hiddenAttentionCount} more item{hiddenAttentionCount === 1 ? "" : "s"}. See <Link href="/properties" className="font-semibold underline underline-offset-2">Properties</Link> or <Link href="/businesses" className="font-semibold underline underline-offset-2">Businesses</Link> for the full list.
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3" aria-label="At a glance">
            <OverviewCard icon={WalletCards} label="You Pay" value={directPay} sub="property taxes" tone="sky" href="/properties" />
            <OverviewCard icon={ShieldCheck} label="Lender Pays" value={escrowed} sub="escrowed" tone="emerald" href="/properties" />
            <OverviewCard icon={Building2} label="Businesses" value={businesses.length} sub="being tracked" tone="violet" href="/businesses" />
            <OverviewCard icon={BellRing} label="Reminders" value={reminders.length} sub="active" tone="rose" href="/reminders" />
          </section>
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl border border-blue-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <CalendarDays size={18} />
              </div>
              <div>
                <h2 className="font-semibold">Coming Up</h2>
                <p className="mt-0.5 text-xs text-slate-500">Deadlines and family reminders in one place.</p>
              </div>
            </div>
            <Link href="/reminders" className="text-xs font-semibold text-blue-700 sm:text-sm">Manage reminders →</Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Nothing scheduled in the next 45 days.</p>
          ) : (
            <div className="grid gap-px bg-slate-100 md:grid-cols-2">
              {upcoming.map((item) => <UpcomingRow key={`${item.kind}-${item.id}`} item={item} />)}
            </div>
          )}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <SnapshotSection title="Properties" subtitle="Direct-pay properties are listed first." href="/properties" icon={Landmark} tone="sky">
            {properties.length === 0 ? (
              <EmptySnapshot message="No properties added yet." />
            ) : (
              properties
                .slice()
                .sort((a, b) => Number(a.escrowed) - Number(b.escrowed))
                .slice(0, 4)
                .map((property) => (
                  <Link key={property.id} href="/properties" className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-sky-50/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{property.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[property.city, property.state].filter(Boolean).join(", ") || "Location not entered"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${property.escrowed ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
                        {property.escrowed ? "Lender pays" : "You pay"}
                      </span>
                      <p className="mt-1.5 text-xs font-medium text-slate-500">{money(property.annual_property_tax)} yearly</p>
                    </div>
                  </Link>
                ))
            )}
          </SnapshotSection>

          <SnapshotSection title="Businesses" subtitle="Entities and their next open deadlines." href="/businesses" icon={Building2} tone="violet">
            {businesses.length === 0 ? (
              <EmptySnapshot message="No businesses added yet." />
            ) : (
              businesses.slice(0, 4).map((business) => {
                const next = obligations
                  .filter((obligation) => obligation.business_id === business.id && !closedStatus(obligation.status))
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

                return (
                  <Link key={business.id} href="/businesses" className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-violet-50/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{business.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[business.entity_type, business.state].filter(Boolean).join(" · ") || "Entity details not entered"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{next ? "Next due" : "Status"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{next ? dateLabel(next.due_date) : "All clear"}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </SnapshotSection>
        </div>
      </section>
    </main>
  );
}

function OverviewCard({ icon: Icon, label, value, sub, tone, href }: { icon: typeof Landmark; label: string; value: number; sub: string; tone: "sky" | "emerald" | "violet" | "rose"; href: string }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <Link href={href} className={`group flex min-h-[116px] flex-col justify-between rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <Icon size={18} />
        <ChevronRight size={15} className="opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-0.5 text-[11px] opacity-70">{sub}</p>
      </div>
    </Link>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const Icon = item.kind === "business" ? Building2 : item.kind === "reminder" ? BellRing : Landmark;
  const colors = item.kind === "business" ? "bg-violet-100 text-violet-700" : item.kind === "reminder" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700";

  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3.5 sm:px-5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors}`}><Icon size={17} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{item.amount == null ? item.kind === "reminder" ? "Family reminder" : "Deadline" : money(item.amount)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-semibold text-slate-700">{dateLabel(item.date)}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{item.status}</p>
      </div>
    </div>
  );
}

function SnapshotSection({ title, subtitle, href, icon: Icon, tone, children }: { title: string; subtitle: string; href: string; icon: typeof Landmark; tone: "sky" | "violet"; children: React.ReactNode }) {
  const colors = tone === "sky" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-violet-200 bg-violet-50 text-violet-700";

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${colors}`}><Icon size={17} /></div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <Link href={href} className="text-xs font-semibold text-blue-700 sm:text-sm">View all →</Link>
      </div>
      <div className="border-t border-slate-100">{children}</div>
    </section>
  );
}

function EmptySnapshot({ message }: { message: string }) {
  return <p className="px-5 py-6 text-sm text-slate-500">{message}</p>;
}
