"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BellRing, Building2, Home, Landmark, LogOut, Search, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type SearchResult = { id: string; type: "Property" | "Business" | "Deadline"; title: string; subtitle: string; href: string };

const protectedPrefixes = ["/dashboard", "/properties", "/businesses", "/reminders", "/admin"];

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const protectedPage = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (!protectedPage) return;
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || !active) return;
      const { data: profile } = await supabase.from("profiles").select("is_admin,approved").eq("id", user.id).maybeSingle();
      if (active) setIsAdmin(Boolean(profile?.approved && profile?.is_admin));
    })();
    return () => { active = false; };
  }, [protectedPage, supabase]);

  useEffect(() => {
    if (!protectedPage || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const q = query.trim();
      const [properties, businesses, obligations] = await Promise.all([
        supabase.from("properties").select("id,name,street_address,city,state").or(`name.ilike.%${q}%,street_address.ilike.%${q}%,city.ilike.%${q}%`).limit(5),
        supabase.from("businesses").select("id,name,entity_type,state").ilike("name", `%${q}%`).limit(5),
        supabase.from("obligations").select("id,title,due_date,status,business_id,property_id").ilike("title", `%${q}%`).limit(5),
      ]);
      const next: SearchResult[] = [
        ...((properties.data ?? []).map((item: any) => ({ id: item.id, type: "Property" as const, title: item.name, subtitle: [item.street_address, item.city, item.state].filter(Boolean).join(", "), href: "/properties" }))),
        ...((businesses.data ?? []).map((item: any) => ({ id: item.id, type: "Business" as const, title: item.name, subtitle: [item.entity_type, item.state].filter(Boolean).join(" · "), href: "/businesses" }))),
        ...((obligations.data ?? []).map((item: any) => ({ id: item.id, type: "Deadline" as const, title: item.title, subtitle: item.due_date ? `Due ${new Date(`${item.due_date}T12:00:00`).toLocaleDateString()}` : "Compliance item", href: item.business_id ? "/businesses" : "/properties" }))),
      ];
      setResults(next.slice(0, 10));
      setSearching(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, protectedPage, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!protectedPage) return <>{children}</>;

  const nav = [
    { href: "/dashboard", label: "Home", icon: Home, activeClass: "border-blue-200 bg-blue-50 text-blue-700", iconClass: "text-blue-600" },
    { href: "/properties", label: "Properties", icon: Landmark, activeClass: "border-sky-200 bg-sky-50 text-sky-700", iconClass: "text-sky-600" },
    { href: "/businesses", label: "Businesses", icon: Building2, activeClass: "border-violet-200 bg-violet-50 text-violet-700", iconClass: "text-violet-600" },
    { href: "/reminders", label: "Reminders", icon: BellRing, activeClass: "border-rose-200 bg-rose-50 text-rose-700", iconClass: "text-rose-600" },
  ];

  const searchBox = (
    <div className="relative">
      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find anything..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none transition focus:border-blue-400 focus:bg-white" />
      {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={15}/></button>}
      {query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {searching ? <p className="px-4 py-4 text-sm text-slate-500">Searching...</p> : results.length === 0 ? <p className="px-4 py-4 text-sm text-slate-500">No matches found.</p> : results.map((result) => (
            <Link key={`${result.type}-${result.id}`} href={result.href} onClick={() => { setQuery(""); setMobileSearchOpen(false); }} className="block border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-blue-50/60">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{result.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{result.type}</span></div>
              <p className="mt-1 truncate text-xs text-slate-500">{result.subtitle}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-protected min-h-screen bg-[#f4f7fb] pb-20 lg:pl-64 lg:pb-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white/95 px-4 py-5 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm"><Home size={19}/></div>
          <div><p className="text-sm font-semibold text-slate-950">Vo Family Operations</p><p className="text-[11px] text-slate-500">Family command center</p></div>
        </Link>
        <div className="mt-6">{searchBox}</div>
        <nav className="mt-6 space-y-1.5">{nav.map(({ href, label, icon: Icon, activeClass, iconClass }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${active ? activeClass : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={18} className={active ? undefined : iconClass}/>{label}</Link>;
        })}</nav>
        {isAdmin && <Link href="/admin/accounts" className={`mt-1.5 flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${pathname.startsWith("/admin") ? "border-blue-200 bg-blue-50 text-blue-700" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"}`}><ShieldCheck size={18}/> Account approvals</Link>}
        <div className="mt-auto flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800"><ShieldCheck size={16}/> Private family account</div>
        <button onClick={signOut} className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"><LogOut size={17}/> Sign out</button>
      </aside>

      <div className="lg:hidden sticky top-0 z-30 border-b-2 border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3"><Link href="/dashboard" className="flex items-center gap-2 font-semibold"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white"><Home size={18}/></div>Vo Family</Link><button onClick={() => setMobileSearchOpen((v) => !v)} className="rounded-xl border border-slate-200 p-2 text-slate-600"><Search size={18}/></button></div>
        {mobileSearchOpen && <div className="mt-3">{searchBox}</div>}
      </div>

      <div className="app-page">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] lg:hidden">
        {nav.map(({ href, label, icon: Icon, activeClass, iconClass }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold ${active ? activeClass : "border-transparent text-slate-500"}`}><Icon size={19} className={active ? undefined : iconClass}/>{label}</Link>;
        })}
      </nav>
    </div>
  );
}
