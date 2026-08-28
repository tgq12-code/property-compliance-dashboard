"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Building2, CalendarDays, CheckCircle2, Clock3, Home, Landmark, LogOut, ShieldCheck, UserCheck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Property = { id:string; name:string; city:string|null; state:string|null; escrowed:boolean; annual_property_tax:number|null };
type Business = { id:string; name:string; entity_type:string|null; state:string|null };
type Obligation = { id:string; title:string; due_date:string; status:string; amount_due:number|null; business_id:string|null; property_id:string|null };
type Reminder = { id:string; title:string; starts_at:string; active:boolean };

type UpcomingItem = {
  id:string;
  kind:"business"|"property"|"reminder";
  title:string;
  date:string;
  amount:number|null;
  status:string;
};

const money = (n:number|null) => n == null ? "—" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
const dateLabel = (iso:string) => new Date(iso.includes("T")?iso:`${iso}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const closedStatus = (status:string) => ["completed","paid","cancelled","canceled"].includes((status||"").toLowerCase());

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ready,setReady] = useState(false);
  const [isAdmin,setIsAdmin] = useState(false);
  const [properties,setProperties] = useState<Property[]>([]);
  const [businesses,setBusinesses] = useState<Business[]>([]);
  const [obligations,setObligations] = useState<Obligation[]>([]);
  const [reminders,setReminders] = useState<Reminder[]>([]);
  const [updatingId,setUpdatingId] = useState<string|null>(null);

  useEffect(()=>{ let active=true; (async()=>{
    for(let i=0;i<8;i++){ const {data}=await supabase.auth.getSession(); if(!active)return; if(data.session){
      const userId=data.session.user.id;
      const profile=await supabase.from("profiles").select("approved,is_admin").eq("id",userId).maybeSingle();
      if(!profile.data?.approved){ await supabase.auth.signOut(); router.replace("/"); return; }
      setIsAdmin(Boolean(profile.data.is_admin));
      const [p,b,o,r]=await Promise.all([
        supabase.from("properties").select("id,name,city,state,escrowed,annual_property_tax").order("created_at",{ascending:false}),
        supabase.from("businesses").select("id,name,entity_type,state").order("created_at",{ascending:false}),
        supabase.from("obligations").select("id,title,due_date,status,amount_due,business_id,property_id").order("due_date",{ascending:true}),
        supabase.from("family_reminders").select("id,title,starts_at,active").eq("active",true).order("starts_at",{ascending:true})
      ]);
      setProperties((p.data??[]) as Property[]); setBusinesses((b.data??[]) as Business[]); setObligations((o.data??[]) as Obligation[]); setReminders((r.data??[]) as Reminder[]); setReady(true); return;
    } await new Promise(res=>setTimeout(res,200)); }
    router.replace("/");
  })(); return()=>{active=false}; },[router,supabase]);

  async function signOut(){ await supabase.auth.signOut(); router.replace("/"); }

  async function markPaid(id:string){
    setUpdatingId(id);
    const {error}=await supabase.from("obligations").update({status:"paid",updated_at:new Date().toISOString()}).eq("id",id);
    if(!error){ setObligations(current=>current.map(item=>item.id===id?{...item,status:"paid"}:item)); }
    setUpdatingId(null);
  }

  if(!ready) return <main className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Loading your family command center...</main>;

  const directPay = properties.filter(p=>!p.escrowed).length;
  const escrowed = properties.filter(p=>p.escrowed).length;
  const today = new Date(); const soon = new Date(today); soon.setDate(soon.getDate()+45);
  const upcomingObligations = obligations.filter(o=>{const d=new Date(`${o.due_date}T12:00:00`); return d>=today && d<=soon && !closedStatus(o.status);});
  const upcoming:UpcomingItem[] = [
    ...upcomingObligations.map(o=>({id:o.id,kind:(o.business_id?"business":"property") as "business"|"property",title:o.title,date:o.due_date,amount:o.amount_due,status:"Due soon"})),
    ...reminders.filter(r=>{const d=new Date(r.starts_at);return d>=today&&d<=soon;}).map(r=>({id:r.id,kind:"reminder" as const,title:r.title,date:r.starts_at,amount:null,status:"Reminder"}))
  ].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).slice(0,6);

  const nav=[{href:"/dashboard",label:"Dashboard",icon:Home,active:true},{href:"/properties",label:"Properties & Taxes",icon:Landmark},{href:"/businesses",label:"Business Compliance",icon:Building2},{href:"/reminders",label:"Family Reminders",icon:BellRing},...(isAdmin?[{href:"/admin/accounts",label:"Account Approvals",icon:UserCheck}]:[])];

  return <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"><Home size={21}/></div>
          <div><p className="font-semibold">Vo Family Operations</p><p className="text-xs text-slate-500">Family Dashboard</p></div>
        </Link>
        <nav className="mt-9 space-y-2">{nav.map(({href,label,icon:Icon,active})=><Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${active?"bg-blue-50 text-blue-700":"text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={18}/>{label}</Link>)}</nav>
        <div className="mt-auto rounded-3xl border border-blue-100 bg-blue-50/70 p-5"><p className="text-sm font-semibold text-blue-950">Built for family.</p><p className="mt-1 text-xs leading-5 text-blue-700">One place for properties, LLCs, taxes and reminders.</p></div>
        <button onClick={signOut} className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={17}/> Sign out</button>
      </aside>

      <section className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">The Vo Family Command Center</p><h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl"><span className="text-blue-600">Catmy</span> brings the grand ideas. <span className="text-blue-600">Tuan</span> keeps the machine running.</h1><p className="mt-3 text-sm text-slate-500">Here’s what needs attention across your family operations.</p></div>
          <div className="flex gap-2">{isAdmin&&<Link href="/admin/accounts" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"><UserCheck size={16}/> Account approvals</Link>}<button onClick={signOut} className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><LogOut size={16}/> Sign out</button></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={Home} label="Total Properties" value={properties.length} sub="Tracked properties" tone="blue"/>
          <Metric icon={WalletCards} label="You Pay" value={directPay} sub="Direct-pay properties" tone="sky"/>
          <Metric icon={ShieldCheck} label="Escrowed" value={escrowed} sub="Lender pays" tone="green"/>
          <Metric icon={Building2} label="Entities" value={businesses.length} sub="Business entities" tone="violet"/>
          <Metric icon={Clock3} label="Due Soon" value={upcoming.length} sub="Next 45 days" tone="amber"/>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="font-semibold">Upcoming deadlines</h2><p className="mt-1 text-sm text-slate-500">Mark an obligation paid here and future reminder emails stop automatically.</p></div><CalendarDays className="text-blue-600" size={20}/></div>
              <div className="divide-y divide-slate-100">{upcoming.length===0?<p className="px-6 py-8 text-sm text-slate-500">Nothing due in the next 45 days.</p>:upcoming.map((item,i)=><div key={`${item.id}-${i}`} className="flex flex-wrap items-center gap-4 px-6 py-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.kind==="business"?"bg-violet-50 text-violet-600":item.kind==="reminder"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`}>{item.kind==="business"?<Building2 size={18}/>:item.kind==="reminder"?<BellRing size={18}/>:<Home size={18}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.amount?money(item.amount):item.kind==="reminder"?"Family reminder":"Compliance deadline"}</p></div><div className="text-right"><p className="text-sm font-medium">{dateLabel(item.date)}</p><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${item.kind==="reminder"?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700"}`}>{item.status}</span></div>{item.kind!=="reminder"&&<button onClick={()=>markPaid(item.id)} disabled={updatingId===item.id} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={15}/>{updatingId===item.id?"Saving...":"Mark paid"}</button>}</div>)}</div>
            </section>

            <section><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Properties snapshot</h2><p className="mt-1 text-sm text-slate-500">Quick view of your latest properties.</p></div><Link href="/properties" className="text-sm font-medium text-blue-600">View all properties →</Link></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{properties.slice(0,6).map(p=><Link key={p.id} href="/properties" className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Home size={20}/></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.escrowed?"bg-emerald-100 text-emerald-800":"bg-sky-100 text-sky-800"}`}>{p.escrowed?"Impounded · lender pays":"You pay"}</span></div><h3 className="mt-4 font-semibold group-hover:text-blue-700">{p.name}</h3><p className="mt-1 text-sm text-slate-500">{[p.city,p.state].filter(Boolean).join(", ")||"Location not entered"}</p><div className="mt-5 flex items-end justify-between"><div><p className="text-xs uppercase tracking-wide text-slate-400">Tax total</p><p className="mt-1 font-semibold">{money(p.annual_property_tax)}</p></div><span className="text-sm font-medium text-blue-600">Open →</span></div></Link>)}</div></section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Business Compliance</h2><p className="mt-1 text-sm text-slate-500">Your entities at a glance.</p></div><Building2 className="text-violet-600" size={20}/></div><div className="mt-5 space-y-3">{businesses.length===0?<p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No entities added yet.</p>:businesses.slice(0,5).map(b=><Link key={b.id} href="/businesses" className="block rounded-2xl border border-slate-100 bg-slate-50/70 p-4 hover:border-blue-200 hover:bg-blue-50/40"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{b.name}</p><p className="mt-1 text-xs text-slate-500">{[b.entity_type,b.state].filter(Boolean).join(" · ")}</p></div><CheckCircle2 size={17} className="text-emerald-500"/></div></Link>)}</div><Link href="/businesses" className="mt-5 flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white">Manage all entities</Link></section>
            <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-sm"><p className="text-sm font-semibold text-blue-100">Quick actions</p><div className="mt-4 grid gap-3"><Link href="/properties" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15">Review property taxes</Link><Link href="/businesses" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15">Review LLC compliance</Link><Link href="/reminders" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15">Manage reminder recipients</Link>{isAdmin&&<Link href="/admin/accounts" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15">Approve account requests</Link>}</div></section>
          </aside>
        </div>
      </section>
    </div>
  </main>;
}

function Metric({icon:Icon,label,value,sub,tone}:{icon:any;label:string;value:number;sub:string;tone:string}){
  const tones:any={blue:"bg-blue-50 text-blue-600",sky:"bg-sky-50 text-sky-600",green:"bg-emerald-50 text-emerald-600",violet:"bg-violet-50 text-violet-600",amber:"bg-amber-50 text-amber-600"};
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon size={20}/></div><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{sub}</p></div>;
}
